const CACHE_NAME = 'pco-webapp-v7';
const ASSETS = [
  './',
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
  './v3_4/index.html',
  './v3_4/coach.html',
  './v3_4/roadmap.html',
  './v2.html',
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

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (!res.ok || /no-store/i.test(res.headers.get('Cache-Control') || '')) return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
