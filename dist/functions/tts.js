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

  const upstream =
    'https://dict.youdao.com/dictvoice?audio=' +
    encodeURIComponent(audio) + '&type=' + encodeURIComponent(type);

  const cache = caches.default;
  const cacheKey = new Request(upstream);

  try {
    // 1) 命中边缘缓存直接返回
    let resp = await cache.match(cacheKey);
    if (resp) return resp;

    // 2) 回源取有道音频
    resp = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WordVocabTTS/1.0)',
        'Accept': '*/*',
        'Referer': 'https://dict.youdao.com/',
      },
    });

    if (!resp.ok) {
      return new Response('upstream error ' + resp.status, { status: 502 });
    }

    // 3) 带上长缓存头回给浏览器, 并写入边缘缓存
    const headers = new Headers(resp.headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-TTS-Source', 'youdao-proxy');
    const out = new Response(resp.body, { status: 200, headers });
    // 后台写入缓存 (Pages Functions 支持 context.waitUntil)
    if (context.waitUntil) {
      context.waitUntil(cache.put(cacheKey, out.clone()));
    } else {
      await cache.put(cacheKey, out.clone());
    }
    return out;
  } catch (e) {
    return new Response('proxy error: ' + (e && e.message ? e.message : String(e)), {
      status: 502,
    });
  }
}
