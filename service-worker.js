// service-worker.js
const CACHE_NAME = ‘convocacoes-v2’;
const ASSETS = [
‘/gestor-convocacoes/’,
‘/gestor-convocacoes/index.html’,
‘/gestor-convocacoes/login.html’,
‘/gestor-convocacoes/manifest.json’
];

self.addEventListener(‘install’, e => {
e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(()=>{})));
self.skipWaiting();
});

self.addEventListener(‘activate’, e => {
e.waitUntil(caches.keys().then(keys =>
Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))
));
self.clients.claim();
});

self.addEventListener(‘fetch’, e => {
e.respondWith(
fetch(e.request).then(res => {
const clone = res.clone();
caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
return res;
}).catch(() => caches.match(e.request))
);
});
