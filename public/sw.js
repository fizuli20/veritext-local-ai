// Retire the legacy cache-first app shell. Never delete model caches.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('veritext-v2-cache-')) await caches.delete(key);
  await self.registration.unregister();
  await self.clients.claim();
})()));
