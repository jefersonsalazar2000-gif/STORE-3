// sw.js — MEGA STORE 360 (v8)

// ————— Config —————
const PREFIX = 'ms360';
const STATIC_CACHE  = `${PREFIX}-static-v8`;
const RUNTIME_CACHE = `${PREFIX}-runtime-v8`;

// Archivos del “app shell” (solo los locales de tu repo)
const CORE = [
  '/',                  // si usas GitHub Pages en subcarpeta, pon '/STORE-3/'
  '/index.html',
  '/manifest.json?v=6',
  '/icon-192x192-v6.png',
  '/icon-256x256-v6.png',
  '/icon-512x512.png',
  '/icon-180x180-v6.png'
];

// Dominios de imágenes remotas permitidos (Amazon)
const IMG_HOSTS = new Set([
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'ws-na.amazon-adsystem.com'
]);

// ————— Install —————
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(CORE))
  );
});

// ————— Activate —————
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ————— Fetch strategy —————
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Navegación: network-first con fallback al shell
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, '/index.html'));
    return;
  }

  // 2) Catálogo: products.json → network-first (si falla: cache)
  if (url.pathname.endsWith('/products.json')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 3) Imágenes (Amazon CDN) → stale-while-revalidate
  if (req.destination === 'image' || IMG_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 4) Estáticos del mismo origen (css/js/etc) → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Por defecto: intenta red, sin caching especial
  event.respondWith(fetch(req));
});

// ————— Estrategias —————
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, fallbackPath) {
  const rt = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res && res.ok) rt.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await rt.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackPath) {
      const shell = await caches.open(STATIC_CACHE);
      const fb = await shell.match(fallbackPath);
      if (fb) return fb;
    }
    throw e;
  }
}

async function staleWhileRevalidate(request) {
  const rt = await caches.open(RUNTIME_CACHE);
  const cached = await rt.match(request, { ignoreSearch: true });
  const networkPromise = fetch(request).then(res => {
    if (res && res.ok) rt.put(request, res.clone());
    return res;
  }).catch(() => cached || Response.error());
  return cached || networkPromise;
}
