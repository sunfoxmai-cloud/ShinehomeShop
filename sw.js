// sw.js
const CACHE = 'liteshop-v4';
const ASSETS = [
  './styles.css?v=4',
  './app.js?v=4',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE ? caches.delete(k) : 0)))
    .then(() => self.clients.claim())
  );
});

// HTML：网络优先（拿不到再用缓存）；静态资源：缓存优先
self.addEventListener('fetch', e => {
  const req = e.request;
  const isHTML = req.destination === 'document' || req.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req))
    );
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});
