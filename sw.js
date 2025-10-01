// sw.js — MEGA STORE 360 (versión corta y compatible con tu estilo actual)
const CACHE_NAME = 'ms360-v4'; // súbele el número cuando cambies íconos/manifest

// Archivos base a precachear (ajustados a tus nombres)
const CORE = [
  '/',                 // si tu hosting no sirve index en raíz, cámbialo a '/index.html'
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-256x256.png',
  '/icon-512x512.png',
  '/icon-180x180.png'  // iOS Home Screen (si no existe, quita esta línea)
];

// Instala y guarda en caché el "app shell"
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE))
  );
});

// Activa y borra cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Estrategia simple:
// - Documentos (HTML): stale-while-revalidate (rápido + refresco en bg)
// - Íconos/manifest: cache-first
// - Resto: network-first con fallback a caché
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  const isDoc = req.destination === 'document' || (req.headers.get('accept') || '').includes('text/html');
  const isIcon = /icon-(180x180|192x192|256x256|512x512)\.png$/.test(url.pathname);
  const isManifest = url.pathname.endsWith('/manifest.json');

  if (isDoc) {
    event.respondWith(staleWhileRevalidate(req));
  } else if (isIcon || isManifest) {
    event.respondWith(cacheFirst(req));
  } else if (['image', 'style', 'script', 'font'].includes(req.destination)) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});

// Helpers
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const fresh = await fetch(request).catch(() => null);
  if (fresh) cache.put(request, fresh.clone());
  return fresh || new Response('Offline', { status: 503, statusText: 'Offline' });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then(res => { cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached || network || new Response('Offline', { status: 503, statusText: 'Offline' });
}
