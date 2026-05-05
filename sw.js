// Idle Ball Escape — service worker for offline PWA play.
// Strategy:
//   - Static shell (index.html, icon, manifest, three.js): cache-first; precached on install
//   - Sample files (samples-opus/...): cache-first, populated on first request, persisted forever
//   - Bump VERSION to force a fresh cache after a deploy with breaking changes.

const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const SAMPLE_CACHE = `samples-${VERSION}`;

const STATIC_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  // Three.js CDN — pinned so offline play doesn't 404
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // addAll fails atomically — fall back to individual adds so a single 404 doesn't kill the install
      Promise.all(STATIC_FILES.map((url) => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    // Last resort: cached fallback to root (for navigation requests)
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Samples — cache forever (their filenames already encode their identity)
  if (url.pathname.includes('/samples-opus/') || url.pathname.includes('/samples/')) {
    event.respondWith(cacheFirst(event.request, SAMPLE_CACHE));
    return;
  }
  // Same-origin and Three.js CDN — static-cache-first, fall through to network
  if (url.origin === self.location.origin || url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }
  // Everything else (Google Fonts, etc.) — let the network handle it
});
