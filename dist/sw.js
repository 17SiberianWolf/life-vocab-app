/* ============================================================
 * Word Match · 单词碰碰乐 · Service Worker
 * 策略: 导航 network-first (在线取最新, 离线回退缓存) + 静态资源 cache-first
 * 适用于: 本地文件系统 / HTTP 服务器 两种部署
 * 注意: file:// 协议下 SW 不可用, 需通过 HTTP 访问才能离线缓存。
 *       请用 `python -m http.server 8080` 或 run.bat --server 启动。
 * ============================================================ */

const CACHE_NAME = 'wordmatch-v17';
const urlsToCache = [
  './',
  './index.html',
  './supabase.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 安装: 预缓存核心资源
// 注意: 逐项 add 并忽略单项失败 —— 任一项失败不应导致整个 SW 装不上
// (曾出现: 整包 addAll 失败 -> SW 不激活 -> 离线能力全丢)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        urlsToCache.map((u) => cache.add(u).catch(() => null))
      ))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

// 激活: 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// 请求处理
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isAsset = /\.(mp3|png|jpg|jpeg|svg|webmanifest|css|js)$/i.test(request.url);

  // 导航请求: 网络优先 (始终取最新 index.html), 离线才回退缓存。
  // 旧实现用 stale-while-revalidate, 会先返回旧缓存 HTML, 导致用户要手动刷两次
  // 才能拿到含新逻辑的页面 (TTS 修了多次却像没生效的元凶之一)。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
          }
          return resp;
        })
        .catch(() =>
          caches.match('./index.html').then((c) => c || fetch(request))
        )
    );
    return;
  }

  if (isSameOrigin && isAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return resp;
        });
      })
    );
    return;
  }

  // 跨域请求 (如在线发音接口) 不拦截, 走浏览器默认网络
});
