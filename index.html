/* J_A MEGA STORE 360 — Service Worker con actualización instantánea */
const CACHE_NAME = 'ms360-cache-v3';
const NEVER_CACHE = [
  'https://raw.githubusercontent.com/jefersonsalazar2000-gif/STORE-3/refs/heads/main/products.json'
];

// Tomar control inmediato
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Limpiar caches viejos y reclamar clientes
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

// Mensaje desde la página para saltar espera
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Estrategias:
// - Navegación/HTML: network-first (si falla, cache)
// - Imágenes/CSS/JS: stale-while-revalidate
// - products.json y cualquier URL en NEVER_CACHE: siempre network, sin cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Nunca cachear ciertos recursos (productos.json)
  if (NEVER_CACHE.some(x => url.startsWith(x))) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // HTML y navegaciones
  const isHTML = request.mode === 'navigate' ||
                 (request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(()=>{});
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Otros: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((networkResp) => {
        // No guardes respuestas opacas o errores
        if (networkResp && networkResp.ok && networkResp.type !== 'opaque') {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResp.clone())).catch(()=>{});
        }
        return networkResp;
      }).catch(() => cached || fetch(request, { cache: 'force-cache' }));
      return cached || fetchPromise;
    })
  );
});
