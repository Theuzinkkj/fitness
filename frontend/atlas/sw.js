/* ===== ATLAS SERVICE WORKER ===== */
const CACHE_VERSION = 'atlas-v2.1.16';
const CORE_ASSETS = [
  '/atlas', '/atlas/', '/atlas/index.html',
  '/atlas/css/app.css',
  '/atlas/js/storage.js', '/atlas/js/crypto.js', '/atlas/js/api.js',
  '/atlas/js/auth.js', '/atlas/js/app.js',
  '/atlas/js/modules/dashboard.js', '/atlas/js/modules/vault.js',
  '/atlas/js/modules/notes.js', '/atlas/js/modules/todos.js',
  '/atlas/js/modules/goals.js', '/atlas/js/modules/calendar.js',
  '/atlas/js/modules/diary.js', '/atlas/js/modules/study.js',
  '/atlas/js/modules/links.js', '/atlas/js/modules/library.js',
  '/atlas/js/modules/files.js', '/atlas/js/modules/tools.js',
  '/atlas/js/modules/assistant.js',
  '/atlas/manifest.json', '/atlas/icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(CORE_ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  if (url.hostname.includes('fonts.g') || url.hostname.includes('cdnjs')) {
    e.respondWith(caches.open('atlas-cdn').then(c => c.match(request).then(r => r || fetch(request).then(res => { if (res.ok) c.put(request, res.clone()); return res; }))));
    return;
  }

  e.respondWith(caches.open(CACHE_VERSION).then(c => {
    return fetch(request)
      .then(res => {
        if (res?.status === 200) c.put(request, res.clone());
        return res;
      })
      .catch(() => c.match(request, { ignoreSearch: true }).then(cached => cached || new Response('Offline', { status: 503 })));
  }));
});
