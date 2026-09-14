/* Service worker KEZ-CERFA — version hébergée.
   L'application entière tient dans index.html (CERFA vierge compris) :
   une fois en cache, elle fonctionne sans aucune connexion. */
const CACHE = 'kez-cerfa-v1';
const BASE = new URL('./', self.location).pathname;
const ESSENTIELS = [BASE, BASE + 'index.html', BASE + 'manifest.webmanifest',
  BASE + 'icones/icone-192.png', BASE + 'icones/icone-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(ESSENTIELS.map((u) =>
      c.add(new Request(u, { cache: 'reload' })).catch(() => undefined))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((n) => Promise.all(n.filter((x) => x !== CACHE).map((x) => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then((rep) => {
      caches.open(CACHE).then((c) => c.put(BASE + 'index.html', rep.clone())).catch(() => undefined);
      return rep;
    }).catch(() => caches.match(BASE + 'index.html')
      .then((x) => x || new Response('Hors ligne', { status: 503 }))));
    return;
  }
  e.respondWith(caches.match(r).then((x) => x || fetch(r).then((rep) => {
    if (rep && rep.status === 200 && rep.type === 'basic') {
      caches.open(CACHE).then((c) => c.put(r, rep.clone())).catch(() => undefined);
    }
    return rep;
  })));
});
