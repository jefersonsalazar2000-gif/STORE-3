// sw.js — MEGA STORE 360 (v11)

// Detecta el path base del sitio en GitHub Pages (p.ej. "/STORE-3/")
const SCOPE_PATH = new URL(self.registration.scope).pathname; // termina con "/"

const PREFIX = 'ms360';
const STATIC_CACHE  = `${PREFIX}-static-v11`;
const RUNTIME_CACHE = `${PREFIX}-runtime-v11`;

// App shell (solo archivos LOCALES dentro del repo)
// OJO: NO precacheamos products.json para no “clavarlo” en el estático
const CORE = [
  SCOPE_PATH,                          // "/STORE-3/"
  SCOPE_PATH + 'index.html',
  SCOPE_PATH + 'manifest.json?v=6',
  SCOPE_PATH + 'icon-192x192-v6.png?v=6',
  SCOPE_PATH + 'icon-256x256-v6.png',
  SCOPE_PATH + 'icon-512x512.png',
  SCOPE_PATH + 'icon-180x180-v6.png?v=6'
];

// Dominios de imágenes remotas (dejarlas pasar directo, sin cache SW)
const REMOTE_IMG_HOSTS = new Set([
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'ws-na.amazon-adsystem.com'
]);

function isProductsJson(url) {
  return url.origin === self.location.origin &&
         url.pathname === (SCOPE_PATH + 'products.json');
}

// —— Install
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});

// —— Activate
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// —— Fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 0) Imágenes remotas (Amazon/CDN) → siempre a red
  if (req.destination === 'image' && url.origin !== self.location.origin) {
    if (REMOTE_IMG_HOSTS.has(url.hostname)) {
      event.respondWith(fetch(req));
      return;
    }
  }

  // 1) Solo gestionar peticiones locales dentro del scope
  const isLocal = url.origin === self.location.origin && url.pathname.startsWith(SCOPE_PATH);
  if (!isLocal) return;

  // 2) Navegaciones → network-first con fallback al shell
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, SCOPE_PATH + 'index.html'));
    return;
  }

  // 3) products.json (con o sin ?v=...) → network-first
  if (isProductsJson(url)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 4) Imágenes locales → cache-first
  if (req.destination === 'image') {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 5) Estáticos locales (css/js/etc) → cache-first
  event.respondWith(cacheFirst(req));
});

// —— Estrategias
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, fallbackPath) {
  const rt = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res && (res.ok || res.type === 'opaque')) {
      await rt.put(request, res.clone());
    }
    return res;
  } catch (e) {
    const cached = await rt.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackPath) {
      const shell = await caches.open(STATIC_CACHE);
      const fb = await shell.match(fallbackPath, { ignoreSearch: true });
      if (fb) return fb;
    }
    throw e;
  }
}
