/**
 * Service Worker — Offline/PWA support for Global Political Dashboard.
 * Caches the app shell and last-known API responses.
 * Government offices may have restricted or intermittent connectivity.
 */

const CACHE_NAME = 'gpd-v8-20260620-shellfix-2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/pmua-logo.webp',
    '/Logo depa-01.png',
    '/smart-city-thailand-logo.svg',
    '/axiom-logo.png'
];

// Cache static assets on install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Clean old caches on activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

const cacheResponse = async (request, response) => {
    if (!response || !response.ok) return response;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    return response;
};

// Network-first for API and navigations; cache fallback only when offline.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and all cross-origin requests. API routes are same-origin
    // on globalmonitor.pages.dev via Pages Functions; only third-party fetches
    // should bypass this service worker.
    if (request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    // Always fetch the HTML shell from the network first. A cache-first shell can
    // trap users on a bad deployment even after Cloudflare has been corrected.
    if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
        event.respondWith(
            fetch(request)
                .then(response => cacheResponse(request, response))
                .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
        );
        return;
    }

    // API requests: network-first with cache fallback
    if (url.pathname.startsWith('/api')) {
        event.respondWith(
            fetch(request)
                .then(response => cacheResponse(request, response))
                .catch(() => caches.match(request))
        );
        return;
    }

    // Static assets: cache-first with network fallback
    event.respondWith(
        caches.match(request)
            .then(cached => cached || fetch(request).then(response => cacheResponse(request, response)))
    );
});
