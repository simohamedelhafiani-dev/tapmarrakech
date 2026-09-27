import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  console.log('[ServiceWorker] PROD bootstrap', {
    url: window.location.href,
  });
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      });

      console.log('[ServiceWorker] REGISTERED', {
        scope: registration.scope,
        active: Boolean(registration.active),
        waiting: Boolean(registration.waiting),
        installing: Boolean(registration.installing),
      });

      // Force a check whenever the installed app opens.
      console.log('[ServiceWorker] UPDATE START');
      await registration.update();
      console.log('[ServiceWorker] UPDATE COMPLETE', {
        active: Boolean(registration.active),
        waiting: Boolean(registration.waiting),
        installing: Boolean(registration.installing),
      });

      const reloadWhenUpdated = () => {
        console.log('[ServiceWorker] CHECK WAITING', {
          waiting: Boolean(registration.waiting),
        });

        if (registration.waiting) {
          console.log('[ServiceWorker] SKIP_WAITING');
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      reloadWhenUpdated();

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[ServiceWorker] CONTROLLER CHANGE -> RELOAD');
        window.location.reload();
      });

      // Extra protection for already-installed PWAs: compare the live
      // service-worker version with the version currently controlling the app.
      // This bypasses browser HTTP caches with a cache-busting query string.
      const checkForNewAppVersion = async () => {
        console.log('[ServiceWorker] VERSION CHECK START');

        try {
          const response = await fetch(`/sw.js?tm-version-check=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });
          if (!response.ok) return;

          const swSource = await response.text();
          const match = swSource.match(/const CACHE = ['"]([^'"]+)['"]/);
          const liveVersion = match?.[1];
          const controllerVersion = registration.active
            ? (await (async () => {
                try {
                  const controllerResponse = await fetch(
                    `/sw.js?tm-active-check=${Date.now()}`,
                    { cache: 'no-store' }
                  );
                  const activeSource = await controllerResponse.text();
                  return activeSource.match(/const CACHE = ['"]([^'"]+)['"]/)?.[1];
                } catch {
                  return undefined;
                }
              })())
            : undefined;

          console.log('[ServiceWorker] VERSION CHECK RESULT', {
            liveVersion,
            controllerVersion,
          });

          if (liveVersion && liveVersion !== controllerVersion) {
            console.log('[ServiceWorker] VERSION MISMATCH -> UPDATE');
            await registration.update();
            reloadWhenUpdated();
          }
        } catch {
          // Offline: keep the installed app usable.
        }
      };

      void checkForNewAppVersion();
      window.setInterval(() => void checkForNewAppVersion(), 30_000);
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
