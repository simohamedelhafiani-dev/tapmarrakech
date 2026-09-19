const CACHE = 'tapmarrakech-shell-v3';
const APP_SHELL = ['/', '/index.html', '/tapmarrakech-logo.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function getCustomerCardToken() {
  return new Promise((resolve) => {
    const request = indexedDB.open('tapmarrakech-pwa', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('settings');
    };
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('settings', 'readonly');
      const getRequest = transaction.objectStore('settings').get('customer-card-token');
      getRequest.onsuccess = () => {
        const token = typeof getRequest.result === 'string' ? getRequest.result : null;
        db.close();
        resolve(token);
      };
      getRequest.onerror = () => {
        db.close();
        resolve(null);
      };
    };
    request.onerror = () => resolve(null);
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/loyalty')) {
    event.respondWith(
      getCustomerCardToken().then((token) => {
        if (token) {
          return Response.redirect(new URL(`/loyalty/${token}`, self.location.origin).toString(), 302);
        }
        return fetch(event.request).catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});
