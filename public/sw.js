const CACHE_NAME = 'pco-webapp-v10';
const OFFLINE_URL = './offline.html';
const ASSETS = [
  './',
  OFFLINE_URL,
  './index.html',
  './login.html',
  './auth.js',
  './login.js',
  './dashboard.html',
  './dashboard.css',
  './dashboard.js',
  './my-learning.html',
  './my-learning.css',
  './my-learning.js',
  './presence.js',
  './v3_4/roadmap.html',
  './pwa-sample/index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './app-shell.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(new URL('./api/', self.location.href).pathname) === 0) return;
  if (url.pathname === new URL('./reports/dashboard.json', self.location.href).pathname) return;
  // 연결 확인용 요청은 캐시 응답 없이 실제 네트워크 결과를 그대로 사용합니다.
  if (url.searchParams.has('pco-probe')) return;

  // 스튜디오는 외부 CDN(Pyodide 등)이 필요해 오프라인에서 동작하지 않으므로 캐시하지 않습니다.
  if (url.pathname === new URL('./new.html', self.location.href).pathname) {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (!res.ok || /no-store/i.test(res.headers.get('Cache-Control') || '')) return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match(OFFLINE_URL);
        return Response.error();
      })
  );
});
