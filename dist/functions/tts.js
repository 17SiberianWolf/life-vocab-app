// ============================================================
// 同源 TTS 代理 (Cloudflare Pages Function)
// 路由:
//   /tts?audio=<文本>&type=<1|2>
//   - 单词(无空格且<=40字符): 走有道 dictvoice (快、覆盖好)
//   - 句子(含空格或较长)    : 走 Google 翻译 TTS, 整句自然朗读, 不再逐词拆分
// 作用: 手机浏览器只与本站点 (life-vocab-app.pages.dev) 通信,
//       由 Cloudflare 边缘去取发音, 绕开国内运营商对
//       dict.youdao.com / translate.google.com 等外部域名的 DNS 污染 / 连接挂起。
// 缓存: 成功响应按 upstream URL 缓存 1 年 (重复词/句秒回, 不重复打上游)
// ============================================================
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const audio = url.searchParams.get('audio');
  const type = url.searchParams.get('type') || '1';

  if (!audio || audio.length > 1000) {
    return new Response('missing or too long audio param', { status: 400 });
  }

  const cache = caches.default;
  // 单词: 无空格且较短 -> 走有道(对单词支持最好); 其余一律当句子走 Google 整句合成
  const isWord = !/\s/.test(audio) && audio.length <= 40;

  if (isWord) {
    return await youdaoProxy(audio, type, cache, context);
  }
  return await googleSentenceProxy(audio, type, cache, context);
}

// ---------- 单词: 有道 dictvoice (英式 type=1 / 美式 type=2 双口音回退) ----------
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

  try {
    let resp = await fetchOne(primary);
    let used = primary;
    if (!resp) { resp = await fetchOne(alt); used = alt; }
    if (!resp) return new Response('no audio for this word', { status: 502 });

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
  } catch (e) {
    return new Response('proxy error: ' + (e && e.message ? e.message : String(e)), { status: 502 });
  }
}

// ---------- 句子: Google 翻译 TTS, 整句自然朗读 (不走逐词拆分) ----------
// 关键点: Google 对整句合成自然、带语调; client=gtx 无需令牌即可使用。
// 长句(>200字符)按词边界切片, 逐个请求后拼接 MP3 字节流返回。
async function googleSentenceProxy(audio, type, cache, context) {
  const tl = (type === '2') ? 'en' : 'en';   // Google 翻译 TTS 英式/美式差异不大, 统一 en
  // 切片: 单段 <=200 字符, 在空格处断, 避免 Google 长度限制
  const chunks = splitLong(audio, 200);
  try {
    const parts = [];
    for (const c of chunks) {
      const buf = await googleFetch(c, tl, cache, context);
      if (!buf) return new Response('google tts failed for segment', { status: 502 });
      parts.push(buf);
    }
    const merged = concatBytes(parts);
    if (merged.byteLength < 1024) return new Response('google returned empty audio', { status: 502 });
    const headers = new Headers();
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-TTS-Source', 'google-sentence');
    headers.set('X-TTS-Segments', String(chunks.length));
    return new Response(merged, { status: 200, headers });
  } catch (e) {
    return new Response('google proxy error: ' + (e && e.message ? e.message : String(e)), { status: 502 });
  }
}

async function googleFetch(text, tl, cache, context) {
  const q = encodeURIComponent(text);
  const up = 'https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&q=' + q + '&tl=' + tl;
  const ck = new Request(up);
  const hit = await cache.match(ck);
  if (hit) {
    const ab = await hit.arrayBuffer();
    return ab;
  }
  const r = await fetch(up, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/',
      'Accept': 'audio/mpeg,audio/*,*/*',
    },
  });
  if (!r.ok) return null;
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('audio')) return null;
  const ab = await r.arrayBuffer();
  if (ab.byteLength < 200) return null;
  if (context.waitUntil) context.waitUntil(cache.put(ck, new Response(ab.slice(0), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })));
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
