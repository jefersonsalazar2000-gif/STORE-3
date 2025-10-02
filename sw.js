// sw.js — MEGA STORE 360 (v6)
const CACHE_NAME = 'ms360-v6';

const CORE = [
  './',
  './index.html',
  './manifest.json?v=6',
  './icon-192x192-v6.png',
  './icon-256x256-v6.png',
  './icon-512x512-v6.png',
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
  const url = new URL(req.url);
  if (req.method !== 'GET') return;

  const isDoc = req.destination === 'document' || (req.headers.get('accept')||'').includes('text/html');
  const isIcon = /icon-.*-v6\.png$/.test(url.pathname);
  const isManifest = url.pathname.endsWith('/manifest.json');

  if (isDoc) event.respondWith(staleWhileRevalidate(req));
  else if (isIcon || isManifest || ['image','style','script','font'].includes(req.destination))
    event.respondWith(cacheFirst(req));
  else event.respondWith(networkFirst(req));
});

async function cacheFirst(request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch:true });
  if (cached) return cached;
  const fresh = await fetch(request).catch(()=>null);
  if (fresh) cache.put(request, fresh.clone());
  return fresh || new Response('Offline', { status:503 });
}

async function networkFirst(request){
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch:true });
    return cached || new Response('Offline', { status:503 });
  }
}

async function staleWhileRevalidate(request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch:true });
  const network = fetch(request).then(r => { cache.put(request, r.clone()); return r; }).catch(()=>null);
  return cached || network || new Response('Offline', { status:503 });
}
