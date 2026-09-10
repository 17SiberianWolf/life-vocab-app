// ============================================================
// 同源 TTS 代理 (Cloudflare Pages Function)
// 路由: /tts?audio=<文本>&type=<1|2>
// 作用: 手机浏览器只与本站点 (life-vocab-app.pages.dev) 通信,
//       由 Cloudflare 边缘去取有道发音, 绕开国内运营商对
//       dict.youdao.com 等外部域名的 DNS 污染 / 连接挂起。
// 缓存: 成功响应按 upstream URL 缓存 1 年 (重复词秒回, 不重复打上游)
// ============================================================
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const audio = url.searchParams.get('audio');
  const type = url.searchParams.get('type') || '1';

  if (!audio || audio.length > 300) {
    return new Response('missing or too long audio param', { status: 400 });
  }

  // 主口音 + 备选口音 (英式 type=1 / 美式 type=2), 任一命中即可, 提升生僻词覆盖率
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

  const cache = caches.default;
  try {
    // 1) 主口音
    let resp = await fetchOne(primary);
    let used = primary;
    // 2) 备选口音回退
    if (!resp) {
      resp = await fetchOne(alt);
      used = alt;
    }
    if (!resp) {
      return new Response('no audio for this word', { status: 502 });
    }

    // 3) 带上长缓存头回给浏览器, 并写入边缘缓存
    const headers = new Headers(resp.headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-TTS-Source', 'youdao-proxy');
    headers.set('X-TTS-Type', used);
    const out = new Response(resp.body, { status: 200, headers });
    const up =
      'https://dict.youdao.com/dictvoice?audio=' +
      encodeURIComponent(audio) + '&type=' + used;
    if (context.waitUntil) {
      context.waitUntil(cache.put(new Request(up), out.clone()));
    } else {
      await cache.put(new Request(up), out.clone());
    }
    return out;
  } catch (e) {
    return new Response('proxy error: ' + (e && e.message ? e.message : String(e)), {
      status: 502,
    });
  }
}
