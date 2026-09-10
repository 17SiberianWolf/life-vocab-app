// ============================================================
// 同源 TTS 代理 (Cloudflare Pages Function)
// 路由: /tts?audio=<文本>&type=<1|2>
//   - 单词(无空格且<=40字符): 有道 dictvoice (快、音质最地道; 英/美双口音) ->
//                             百度翻译 TTS -> Google 翻译 TTS (兜底引擎, 可合成任意文本)
//   - 句子(含空格或较长)    : 百度翻译 TTS 整句合成 (国内, 免密钥) -> Google 翻译 TTS 备份
//   注: 有道词库对少数复合词(如 time-box / back-office / spare-parts)返回 500,
//       若单词分支只接有道, 代理会返回 502 -> 客户端弹"在线发音加载失败"并退化到
//       不可靠的本地语音(手机常无音色), 表现为"这个单词发音失败"。故必须多引擎回退。
// 作用: 手机浏览器只与本站点 (life-vocab-app.pages.dev) 通信,
//       由 Cloudflare 边缘取音频, 绕开国内运营商对外部域名的 DNS 污染 / 连接挂起。
// 缓存: 成功响应按 upstream URL 缓存 1 年 (重复词/句秒回, 不重复打上游)
// ============================================================
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const audio = url.searchParams.get('audio');
  const type = url.searchParams.get('type') || '1';

  if (!audio || audio.length > 1000) {
    return new Response('missing or too long audio param', { status: 400 });
  }

  const cache = caches.default;
  const isWord = !/\s/.test(audio) && audio.length <= 40;

  if (isWord) {
    return await youdaoProxy(audio, type, cache, context);
  }
  return await sentenceProxy(audio, type, cache, context);
}

// ---------- 单词: 有道 dictvoice 主 (英式 type=1 / 美式 type=2 双口音)
//            回退: 百度 -> Google (有道词库缺条目时保证仍能出声) ----------
async function youdaoProxy(audio, type, cache, context) {
  const primary = (type === '2') ? '2' : '1';
  const alt = (primary === '1') ? '2' : '1';

  async function fetchOne(t) {
    const up =
      'https://dict.youdao.com/dictvoice?audio=' +
      encodeURIComponent(audio) + '&type=' + t;
    const ck = new Request(up);
    const hit = await cache.match(ck);
    if (hit) return hit;
    const r = await fetch(up, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WordVocabTTS/1.0)',
        'Accept': '*/*',
        'Referer': 'https://dict.youdao.com/',
      },
    });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('audio')) return null;   // 有道对不支持的词会返回 200 但非音频
    return new Response(r.body, { status: 200, headers: r.headers });
  }

  // 1) 有道优先: 音质最地道、口音可切换; 仅当有道真的没有该词时才回退
  try {
    let resp = await fetchOne(primary);
    let used = primary;
    if (!resp) { resp = await fetchOne(alt); used = alt; }
    if (resp) {
      const headers = new Headers(resp.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('X-TTS-Source', 'youdao-proxy');
      headers.set('X-TTS-Type', used);
      const out = new Response(resp.body, { status: 200, headers });
      const up =
        'https://dict.youdao.com/dictvoice?audio=' +
        encodeURIComponent(audio) + '&type=' + used;
      if (context.waitUntil) context.waitUntil(cache.put(new Request(up), out.clone()));
      else await cache.put(new Request(up), out.clone());
      return out;
    }
  } catch (e) {
    // 有道异常 -> 继续走下面的兜底引擎, 不让单个上游故障变成"单词没声音"
  }

  // 2) 兜底引擎: 有道词库里没有的复合词(如 time-box)在这里拿到音频。
  //    百度(国内、免密钥、任意文本) -> Google(CF 边缘可达)。
  //    复用 baiduFetch/googleFetch, 与句子分支共用同一份缓存键。
  for (const eng of [
    { name: 'baidu-word', run: baiduFetch },
    { name: 'google-word', run: googleFetch },
  ]) {
    try {
      const buf = await eng.run(audio, cache, context);
      if (!buf || buf.byteLength < 300) continue;
      const headers = new Headers();
      headers.set('Content-Type', 'audio/mpeg');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('X-TTS-Source', eng.name);
      return new Response(buf, { status: 200, headers });
    } catch (e) {
      // 该引擎异常 -> 尝试下一个
    }
  }

  return new Response('no audio for this word', { status: 502 });
}

// ---------- 句子: 整句自然朗读 (不走逐词拆分) ----------
// 主引擎: 百度翻译 TTS (fanyi.baidu.com/gettts) —— 国内服务、免密钥、支持任意整句,
//         对国内用户最稳、最快; 备引擎: Google 翻译 TTS (client=gtx)。
// 长文本(>200字符)按词边界切片, 逐段请求后拼接 MP3 字节流返回。
async function sentenceProxy(audio, type, cache, context) {
  const segments = splitLong(audio, 200);
  const engines = [
    { name: 'baidu-sentence', run: (t) => baiduFetch(t, cache, context) },
    { name: 'google-sentence', run: (t) => googleFetch(t, cache, context) },
  ];

  for (const eng of engines) {
    try {
      const parts = [];
      let ok = true;
      for (const seg of segments) {
        const buf = await eng.run(seg);
        if (!buf) { ok = false; break; }
        parts.push(buf);
      }
      if (!ok) continue;
      const merged = concatBytes(parts);
      if (merged.byteLength < 1024) continue;
      const headers = new Headers();
      headers.set('Content-Type', 'audio/mpeg');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('X-TTS-Source', eng.name);
      headers.set('X-TTS-Segments', String(segments.length));
      return new Response(merged, { status: 200, headers });
    } catch (e) {
      // 该引擎异常 -> 尝试下一个引擎
    }
  }
  return new Response('all sentence tts engines failed', { status: 502 });
}

// 百度翻译 TTS: 免密钥, 支持任意整句
async function baiduFetch(text, cache, context) {
  const up =
    'https://fanyi.baidu.com/gettts?lan=en&spd=3&source=web&text=' +
    encodeURIComponent(text);
  const ck = new Request(up);
  const hit = await cache.match(ck);
  if (hit) return await hit.arrayBuffer();
  const r = await fetch(up, {
    headers: { 'User-Agent': UA, 'Referer': 'https://fanyi.baidu.com/', 'Accept': 'audio/mpeg,*/*' },
  });
  if (!r.ok) return null;
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('audio')) return null;
  const ab = await r.arrayBuffer();
  if (ab.byteLength < 200) return null;
  if (context.waitUntil) context.waitUntil(cache.put(ck, new Response(ab, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })));
  return ab;
}

// Google 翻译 TTS 备份: client=gtx 无需令牌
async function googleFetch(text, cache, context) {
  const up =
    'https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&q=' +
    encodeURIComponent(text) + '&tl=en';
  const ck = new Request(up);
  const hit = await cache.match(ck);
  if (hit) return await hit.arrayBuffer();
  const r = await fetch(up, {
    headers: { 'User-Agent': UA, 'Referer': 'https://translate.google.com/', 'Accept': 'audio/mpeg,audio/*,*/*' },
  });
  if (!r.ok) return null;
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('audio')) return null;
  const ab = await r.arrayBuffer();
  if (ab.byteLength < 200) return null;
  if (context.waitUntil) context.waitUntil(cache.put(ck, new Response(ab, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })));
  return ab;
}

function splitLong(text, max) {
  const t = String(text || '').trim();
  if (!t) return [];
  if (t.length <= max) return [t];
  const out = [];
  let cur = '';
  for (const w of t.split(/\s+/)) {
    if (cur && (cur.length + 1 + w.length) > max) { out.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

function concatBytes(arrs) {
  let total = 0;
  for (const a of arrs) total += a.byteLength;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(new Uint8Array(a), off); off += a.byteLength; }
  return out.buffer;
}
