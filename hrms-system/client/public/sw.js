/* ==============================================================================
 * BSC Candidate CRM - Production Progressive Web App (PWA) Service Worker
 * ==============================================================================
 * SECURITY COMPLIANCE NOTE:
 * - Sensitive CRM data, API routes (/api/*, /api/v1/*), authentication, candidate
 *   information, employee records, phone numbers, and uploads ARE NEVER CACHED.
 * - This Service Worker caches ONLY static application shell assets, fonts, icons,
 *   manifest, and JS/CSS bundles required for standalone PWA launching and performance.
 * ============================================================================== */

const CACHE_NAME = 'bsc-crm-shell-v1.0.0';

// Core static assets required for App Shell startup
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/logo.png'
];

// Service Worker Installation: Cache essential app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell static assets...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache failed for some assets, continuing:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Service Worker Activation: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing obsolete cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for update message from the main thread (Controlled update mechanism)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Interceptor
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. NEVER CACHE API requests, authentication, DB endpoints, or uploaded candidate/employee documents
  const isApiRequest = url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/v1/');
  const isUploadRequest = url.pathname.startsWith('/uploads/') ||
                         url.pathname.startsWith('/candidate-resumes/') ||
                         url.pathname.startsWith('/candidate-photos/') ||
                         url.pathname.startsWith('/employee-documents/');
  const isDynamicCall = url.pathname === '/health' || url.pathname === '/db-status';

  if (isApiRequest || isUploadRequest || isDynamicCall || request.method !== 'GET') {
    // Network-only for all sensitive, dynamic, and non-GET requests
    return;
  }

  // 2. Navigation / SPA Route Requests (e.g., /dashboard, /candidates, /joining-call-desk)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        // If offline, return cached index.html so the SPA app shell loads gracefully
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('/index.html') || await cache.match('/');
        if (cachedIndex) {
          return cachedIndex;
        }
        return new Response('Offline: BSC Candidate CRM requires an internet connection.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
    return;
  }

  // 3. Static Assets (CSS, JS, Fonts, Images)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-While-Revalidate: Return cached copy immediately, update cache in background
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
        }).catch(() => {
          // Ignore network errors in background revalidation
        });
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache static file
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        // Cache static JS, CSS, fonts, and web assets
        if (
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.jpg') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.ico') ||
          url.pathname.endsWith('.woff') ||
          url.pathname.endsWith('.woff2')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
