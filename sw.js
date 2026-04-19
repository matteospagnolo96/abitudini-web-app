const CACHE_NAME = 'habit-v4';
const OFFLINE_URL = './';

self.addEventListener('install', e => {
    self.skipWaiting(); // Forza il Service Worker a installarsi subito, senza aspettare la chiusura dei tab
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

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim()) // Prende il controllo immediato delle pagine aperte
    );
});

self.addEventListener('fetch', e => {
    // Ignoriamo le chiamate ai database REST come Supabase o chiamate non-GET
    if (e.request.method !== 'GET' || e.request.url.includes('supabase.co')) {
        return;
    }

    // Strategia: Network First, Fallback to Cache
    e.respondWith(
        fetch(e.request)
            .then(networkResponse => {
                // Se la rete risponde correttamente, aggiorniamo la cache in background!
                const resClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(e.request, resClone);
                });
                return networkResponse;
            })
            .catch(() => {
                // Se sei OFFLINE (o rete troppo debole), pesca il file dalla cache locale
                return caches.match(e.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    
                    // Fallback di navigazione: se cerchi un url generico, vai all'index offline
                    if (e.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                });
            })
    );
});