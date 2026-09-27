const CACHE_NAME = 'estudar-v19';
const ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/data.js',
  '/js/planner.js',
  '/js/learning.js',
  '/js/logsheet.js',
  '/js/curriculum.js',
  '/js/percurso.js',
  '/js/backup.js',
  '/js/i18n.js',
  '/js/i18n-en.js',
  '/js/setup.js',
  '/js/timer.js',
  '/js/storage.js',
  '/js/roles.js',
  '/vendor/supabase.js',
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

  // Only this app's own files. Never other origins, never the API (live and per-user), and never URLs with a
  // query string (e.g. a sign-in ?code=…), so nothing personal ends up in the cache.
  const u = new URL(url);
  if (u.origin !== self.location.origin || u.pathname.startsWith('/api/') || u.search) return;

  // App files: network first so deploys show up immediately; cache only as offline fallback.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => putInCache(e.request, r))
      .catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html')))
  );
});
