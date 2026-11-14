// Samrat Menu Orders service worker: offline app shell + cached images.
const VERSION = 'smo-v3';
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

// ── Push notifications (arrive even when the app is closed) ──────────────────
const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|android|edg/i.test(navigator.userAgent);
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Samrat', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    if (typeof d.badge === 'number' && self.navigator.setAppBadge) {
      try { d.badge > 0 ? await self.navigator.setAppBadge(d.badge) : await self.navigator.clearAppBadge(); } catch (err) { /* unsupported */ }
    }
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // App open and in front: it already shows its own alert card and sound. (Safari must always show one.)
    if (!isSafari && wins.some(c => c.focused && c.visibilityState === 'visible')) return;
    await self.registration.showNotification(d.title || 'Samrat Menu Orders', {
      body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png',
      tag: d.tag, renotify: !!d.tag, requireInteraction: !!d.requireInteraction,
      vibrate: [220, 100, 220, 100, 320], timestamp: Date.now(), data: { url: d.url || '/' },
    });
  })());
});
