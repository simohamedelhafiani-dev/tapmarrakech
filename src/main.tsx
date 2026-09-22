import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      });

      // Force a check whenever the installed app opens.
      await registration.update();

      const reloadWhenUpdated = () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      reloadWhenUpdated();

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      // Extra protection for already-installed PWAs: compare the live
      // service-worker version with the version currently controlling the app.
      // This bypasses browser HTTP caches with a cache-busting query string.
      const checkForNewAppVersion = async () => {
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

          if (liveVersion && liveVersion !== controllerVersion) {
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
