// Service worker mínimo: torna o sistema instalável como aplicativo. Não guarda dados em cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
