const CACHE_NAME = 'habit-v3';
const OFFLINE_URL = './';

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                OFFLINE_URL,
                './index.html',
                './css/style.css',
                './js/app.js',
                './js/storage.js',
                './js/ui.js',
                './js/stats.js',
                './manifest.json',
                './icona.png',
                'https://cdn.jsdelivr.net/npm/chart.js'
            ]);
        })
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(res => {
            return res || fetch(e.request).catch(() => {
                if (e.request.mode === 'navigate') {
                    return caches.match(OFFLINE_URL);
                }
            });
        })
    );
});