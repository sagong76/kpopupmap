// 간단한 서비스워커: 페이지는 네트워크 우선(오프라인 시 캐시), 정적 자산은 캐시 우선
const C = 'kpm-v1';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/_astro/') || u.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(C).then((c) => c.put(e.request, copy)); return res;
    })));
  } else if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(C).then((c) => c.put(e.request, copy)); return res;
    }).catch(() => caches.match(e.request)));
  }
});
