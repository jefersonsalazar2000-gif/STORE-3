// sw.js — MEGA STORE 360 (v10)

// Detecta el path base del sitio en GitHub Pages (p.ej. "/STORE-3/")
const SCOPE_PATH = new URL(self.registration.scope).pathname; // termina con "/"

const PREFIX = 'ms360';
const STATIC_CACHE  = `${PREFIX}-static-v10`;
const RUNTIME_CACHE = `${PREFIX}-runtime-v10`;

// App shell (solo archivos LOCALES dentro del repo)
// Nota: intencionalmente NO incluimos products.json aquí para evitar fijarlo en el estático
const CORE = [
  SCOPE_PATH,                          // "/STORE-3/"
  SCOPE_PATH + 'index.html',
  SCOPE_PATH + 'manifest.json?v=6',
  SCOPE_PATH + 'icon-192x192-v6.png',
  SCOPE_PATH + 'icon-256x256-v6.png',
  SCOPE_PATH + 'icon-512x512.png',
  SCOPE_PATH + 'icon-180x180-v6.png'
];

// Dominios de imágenes remotas (no las cacheamos con SW; se dejan pasar directo)
const REMOTE_IMG_HOSTS = new Set([
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'ws-na.amazon-adsystem.com'
]);

// Util: determinar si es la products.json dentro del scope (con o sin query)
function isProductsJson(url) {
  // Coincide exactamente con /SCOPE/products.json (ignoreSearch en los match de cache)
  return url.origin === self.location.origin &&
         url.pathname === (SCOPE_PATH + 'products.json');
}

// —— Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(CORE))
  );
  self.skipWaiting(); // toma el control inmediatamente tras instalar
});

// —— Activate
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim(); // controla clientes abiertos
  })());
});

// —— Mensajes desde la página (para forzar actualización del SW)
self.addEventListener('message', (event) => {
  if (!event || !event.data) return;
  const { type } = event.data;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// —— Fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 0) Deja pasar CUALQUIER petición de imagen remota (Amazon/CDN)
  if (req.destination === 'image' && url.origin !== self.location.origin) {
    if (REMOTE_IMG_HOSTS.has(url.hostname)) {
      event.respondWith(fetch(req));
      return;
    }
  }

  // 1) Solo gestionamos peticiones de nuestro propio origen y dentro del scope
  const isLocal = url.origin === self.location.origin && url.pathname.startsWith(SCOPE_PATH);
  if (!isLocal) return; // no interceptar (lo maneja el navegador)

  // 2) Navegaciones → network-first con fallback al shell
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, SCOPE_PATH + 'index.html'));
    return;
  }

  // 3) products.json (con o sin ?v=... / ?ts=...) → network-first (con cache fallback)
  if (isProductsJson(url)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 4) Imágenes LOCALES → cache-first
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
  // Guarda si la respuesta es OK u opaca (por si hay assets con CORS simple)
  if (res && (res.ok || res.type === 'opaque')) {
    cache.put(request, res.clone());
  }
  return res;
}

async function networkFirst(request, fallbackPath) {
  const rt = await caches.open(RUNTIME_CACHE);
  try {
    // no-store para forzar ida a red y evitar reusar caché HTTP del navegador
    const res = await fetch(request, { cache: 'no-store' });
    if (res && (res.ok || res.type === 'opaque')) {
      // Importante: ignora la query al guardar y al leer (soporta ?v=.../ ?ts=...)
      const key = new Request(request.url, { method: 'GET' });
      await rt.put(key, res.clone());
    }
    return res;
  } catch (e) {
    // Si falla red → intenta runtime cache (ignoreSearch)
    const cached = await rt.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // Fallback de navegación: index.html del estático
    if (fallbackPath) {
      const shell = await caches.open(STATIC_CACHE);
      const fb = await shell.match(fallbackPath, { ignoreSearch: true });
      if (fb) return fb;
    }
    throw e;
  }
}
