// sw.js — MEGA STORE 360 (v7)
const CACHE_NAME = 'ms360-v7';

const CORE = [
  './',
  './index.html',
  './manifest.json?v=6',
  './icon-192x192-v6.png',
  './icon-256x256-v6.png',
  './icon-512x512.png',
  './icon-180x180-v6.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) products.json: NETWORK-FIRST
  if (url.origin === self.location.origin && url.pathname.endsWith('/products.json')) {
    event.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: 'no-store' });
        const clone = net.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, clone);
        return net;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response('Offline y sin caché de products.json', { status: 503 });
      }
    })());
    return;
  }

  // 2) Misma-origen: stale-while-revalidate simple
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const fetchAndUpdate = fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return res;
      }).catch(() => cached);
      return cached || fetchAndUpdate;
    })());
    return;
  }

  // 3) Terceros: network-first con fallback a caché
  event.respondWith((async () => {
    try {
      const net = await fetch(req);
      const clone = net.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, clone));
      return net;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw new Error('Network error and no cache.');
    }
  })());
});
