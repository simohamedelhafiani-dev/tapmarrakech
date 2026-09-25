const CACHE = 'tapmarrakech-shell-v12';
const APP_SHELL = ['/', '/index.html', '/tapmarrakech-logo.svg', '/manifest.webmanifest'];

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text?.() || '' }; }
    await self.registration.showNotification(payload.title || 'Tap Marrakech', {
      body: payload.body || 'Une nouvelle offre est disponible.',
      icon: payload.icon || '/tapmarrakech-logo.svg',
      badge: payload.badge || '/tapmarrakech-logo.svg',
      tag: payload.tag || 'tapmarrakech-notification',
      data: payload.data || {},
      renotify: true,
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => 'focus' in client);
    if (existing) { await existing.navigate(targetUrl); await existing.focus(); return; }
    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      )
    )
  ).then(async () => {
    await self.clients.claim();
    // Reload already-open installed PWAs after the new worker takes control.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(
      clients.map((client) => client.navigate(client.url).catch(() => undefined))
    );
  });
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Always fetch HTML/app navigation fresh so installed loyalty cards receive
  // new React bundles and UI changes without requiring a reinstall.
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Never serve JavaScript/CSS from the old PWA cache. Vite assets are hashed,
  // so fetching them from the network is safe and guarantees new UI code.
  const isAppAsset = url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  if (isAppAsset) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => response)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached || caches.match('/index.html')
        )
      )
  );
});
