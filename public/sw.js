const CACHE_NAME = 'estudar-v10';
const ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/data.js',
  '/js/planner.js',
  '/js/learning.js',
  '/js/logsheet.js',
  '/js/setup.js',
  '/js/timer.js',
  '/js/storage.js',
  '/js/focus.js',
  '/manifest.json',
  '/icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (response && response.ok) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
  }
  return response;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  // Supabase SDK from the CDN: serve cached copy instantly (so the app opens offline), refresh in background.
  if (url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(r => putInCache(e.request, r)).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  if (!url.startsWith(self.location.origin)) return;
  // API answers must be live (status, config); the app caches /api/config itself for offline starts.
  if (new URL(url).pathname.startsWith('/api/')) return;

  // App files: network first so deploys show up immediately; cache only as offline fallback.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => putInCache(e.request, r))
      .catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html')))
  );
});
