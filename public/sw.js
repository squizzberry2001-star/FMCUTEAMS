const CACHE_NAME = 'fmcu-teams-pwa-v4';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/assets/pdf.min.js',
  '/assets/pdf.worker.min.js',
  '/assets/COVER1.jpg',
  '/assets/WTRMRK.png',
  '/assets/divider-qsc-observation.jpg',
  '/assets/divider-finding-evidence.jpg',
  '/assets/divider-store-assignment.jpg',
];

// Install: precache essential offline assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

// Message listener for skip waiting signal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: purge any old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Network-First for HTML/navigation so users always get fresh updates without stale cache!
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Never cache external APIs, Google Apps Script, Cloudflare Edge API, or tile layers
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('pages.dev') ||
    url.hostname.includes('googleusercontent.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('basemaps.cartocdn.com') ||
    url.hostname.includes('arcgisonline.com') ||
    url.pathname.startsWith('/api') ||
    url.search.includes('action=')
  ) {
    return;
  }

  // 1. Navigation / HTML Document -> NETWORK-FIRST (Always fetch latest deployment)
  const isNavigate =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    event.request.headers.get('accept')?.includes('text/html');

  if (isNavigate) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // 2. Static Pre-cached Assets -> Cache-First with Background Revalidation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalidate in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request));
    })
  );
});
