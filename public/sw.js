// Veritext Service Worker - veritext-shell-v5
const CACHE_NAME = 'veritext-shell-v5';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.startsWith('veritext-') && key !== CACHE_NAME) {
          await caches.delete(key);
        }
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Immediately pass through all cross-origin requests
  // (huggingface.co, cdn-lfs, jsdelivr, localhost:1234, localhost:11434, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. Only handle standard GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 3. Never intercept Range requests (used by streaming, WASM, ONNX, and large model slices)
  if (request.headers.has('range')) {
    return;
  }

  // 4. Pass through Next.js API endpoints, Webpack HMR, and server actions
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/webpack-hmr')) {
    return;
  }

  // 5. Network-first strategy with cache fallback for static app assets
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok && request.method === 'GET') {
          // Cache static build assets
          if (
            url.pathname.startsWith('/_next/static/') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.ico') ||
            url.pathname.endsWith('.woff2')
          ) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
          }
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error('Network offline and asset not cached.');
      }
    })()
  );
});
