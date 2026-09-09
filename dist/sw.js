/* ============================================================
 * Word Match · 单词碰碰乐 · Service Worker
 * 策略: cache-first (先查缓存 -> 兜底网络 -> 缓存新资源)
 * 适用于: 本地文件系统 / HTTP 服务器 两种部署
 * 注意: file:// 协议下 SW 不可用, 需通过 HTTP 访问才能离线缓存。
 *       请用 `python -m http.server 8080` 或 run.bat --server 启动。
 * ============================================================ */

const CACHE_NAME = 'wordmatch-v7';
const urlsToCache = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 安装: 预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
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

// 请求: cache-first, 失败回退网络
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // 只缓存同源 + audio/ + icons/
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isAsset = /\.(mp3|png|jpg|webmanifest|css)$/i.test(request.url) ||
                  request.mode === 'navigate';

  // 导航请求始终走 index.html 缓存（离线可用）
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
          return resp;
        });
      }).catch(() => caches.match('./index.html'))
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
        }).catch(() => caches.match('./index.html'));
      })
    );
  }
});
