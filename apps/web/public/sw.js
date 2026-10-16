// Minimal offline shell: network first, fall back to the last cached copy of same-origin GETs.
// API calls (other origins) and non-GET requests are never cached.
const CACHE = 'skillpilot-shell-v2';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('message', (e) => { if (e.data?.type === 'SKILLPILOT_LOGOUT') e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('/')))
  );
});
