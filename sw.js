const CACHE_NAME = 'studium-v1791761454';
const ASSETS = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './data.js',
  './manifest.json',
  './data/index.json',
  './data/dict/master_dict.json',
  './data/books/beiying.json',
  './data/books/tuanyuan.json',
  './data/books/rain.json',
  './data/books/chinese3.json',
  './data/books/portrait.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
