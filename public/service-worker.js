const CACHE_NAME = 'hergon-pos-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/lib/react/react.production.min.js',
  '/lib/react-dom/react-dom.production.min.js',
  '/lib/babel/babel.min.js',
  '/lib/fontawesome/css/all.min.css',
  '/lib/fontawesome/webfonts/fa-solid-900.woff2',
  '/lib/fontawesome/webfonts/fa-solid-900.ttf',
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and socket.io
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/socket.io')) return;

  // API calls: network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful API responses for offline use
          if (response.ok && (url.pathname.includes('/cache/') || url.pathname.includes('/categorias') || url.pathname.includes('/sucursales'))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || new Response(JSON.stringify({ error: 'Sin conexion', offline: true }), { headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Listen for sync events (Background Sync API)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-ventas') {
    event.waitUntil(syncVentasOffline());
  }
});

async function syncVentasOffline() {
  // Notify all clients to trigger sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_VENTAS' }));
}

// Listen for messages from main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
