/* ツーリング記録帳 Service Worker
 * 方針:
 * - アプリ本体（シェル）: ネットワーク優先。成功したらキャッシュ更新、オフライン時はキャッシュで表示
 * - heic2any CDN (unpkg): SRI固定で不変のためキャッシュ優先
 * - 地図・天気・クラウド同期などのAPI: 介入しない（キャッシュすると同期の正しさを壊すため）
 */
const CACHE_NAME = 'touring-shell-v30';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png?v=photo-icon-20260613-full',
  './icons/icon-512.png?v=photo-icon-20260613-full',
  './icons/apple-touch-icon.png?v=photo-icon-20260613-full',
  './icons/header-photo.png?v=photo-icon-20260613-wide',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppShell(url) {
  if (url.origin !== self.location.origin) return false;
  // クエリ付きURL（?utm= 等）でも一致するよう pathname で比較する
  return APP_SHELL.some((p) => url.pathname === new URL(p, self.location.href).pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // heic2any CDN: キャッシュ優先（SRI固定）
  if (url.hostname === 'unpkg.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((hit) =>
          hit || fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
        )
      )
    );
    return;
  }

  // アプリ本体: ネットワーク優先 + オフライン時キャッシュ
  if (req.mode === 'navigate' || isAppShell(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // リダイレクト済みレスポンスはナビゲーション再利用でエラーになるため除外
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // それ以外（API等）はブラウザ既定の動作に任せる
});
