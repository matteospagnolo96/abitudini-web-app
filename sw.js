const CACHE_NAME = 'habit-tracker-v1';
const ASSETS = [
  'index.html',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Installazione e salvataggio file in cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Recupero file dalla cache (funzionamento offline)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
