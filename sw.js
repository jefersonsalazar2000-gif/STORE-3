// sw.js — caché pro con Stale-While-Revalidate
const CACHE_STATIC = 'ms360-static-v3';
const CACHE_RUNTIME = 'ms360-rt-v3';
const STATIC_ASSETS = [
  '/', '/index.html',
  '/icon-180x180-v6.png', '/icon-192x192-v6.png',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_STATIC).then(c=>c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>{
    if(![CACHE_STATIC,CACHE_RUNTIME].includes(k)) return caches.delete(k);
  }))));
  self.clients.claim();
});

const SWR = async (req) => {
  const cache = await caches.open(CACHE_RUNTIME);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(res=>{
    if(res && res.status===200 && res.type!=='opaque') cache.put(req, res.clone());
    return res;
  }).catch(()=> cached);
  return cached || fetchPromise;
};

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (/products\.json$/i.test(url.pathname) ||
      /\.(?:png|jpg|jpeg|gif|webp|avif)$/i.test(url.pathname) ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('raw.githubusercontent.com')) {
    e.respondWith(SWR(e.request));
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html').then(r=> r || fetch(e.request))
    );
    return;
  }
  e.respondWith(
    fetch(e.request).catch(()=> caches.match(e.request))
  );
});
