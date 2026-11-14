// Samrat Menu Orders service worker: offline app shell + cached images.
const VERSION = 'smo-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/assets/samrat-logo.svg', '/icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('/index.html', copy)); return r; }).catch(() => caches.match('/index.html')));
    return;
  }
  // Static assets: cache first, then network.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const same = list.find(c => new URL(c.url).pathname === new URL(url, self.location.origin).pathname);
    if (same) return same.focus();
    if (list[0]) { list[0].focus(); return list[0].navigate ? list[0].navigate(url) : null; }
    return self.clients.openWindow(url);
  }));
});
