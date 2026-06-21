// ============================================
// SERVICE WORKER — SyncPoint
// ============================================

const CACHE_VERSION = 'v1';
const CACHE_NAME = `syncpoint-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/index.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon.ico',
];

const API_CACHE_NAME = `syncpoint-api-${CACHE_VERSION}`;
const API_ENDPOINTS = [
  '/api/v1/wallet/balance',
  '/api/v1/wallet/has-pin',
];

// Fix issue #4: the API server runs on a different origin/port than the
// client dev server (e.g. http://localhost:2000 vs http://localhost:3030).
// The original origin check silently let ALL API requests bypass the SW
// entirely, meaning the offline fallback for failed API calls never fired.
// Set this to your actual API origin, or read it from a build-time env var.
const API_ORIGIN = self.location.hostname === 'localhost'
  ? 'http://localhost:2000'
  : self.location.origin;

// ============================================
// INSTALL EVENT
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Fix issue #1 (and #8): skipWaiting() removed from install.
      // Calling it here forces every new SW version to activate immediately,
      // even while a user is mid-transaction — the old SW could still be
      // handling an in-flight fetch when the new one takes over caches.
      // skipWaiting() is now ONLY triggered by the explicit SKIP_WAITING
      // message, which the app sends after prompting the user to refresh.

      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(STATIC_ASSETS);

      // Open (but don't pre-populate) the API cache so it exists for later use
      await caches.open(API_CACHE_NAME);

      console.log('[SW] Install completed');
    })()
  );
});

// ============================================
// ACTIVATE EVENT
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(
        (name) =>
          name.startsWith('syncpoint-') &&
          name !== CACHE_NAME &&
          name !== API_CACHE_NAME
      );

      await Promise.all(oldCaches.map((name) => caches.delete(name)));

      console.log('[SW] Activate completed');
    })()
  );
});

// ============================================
// FETCH EVENT
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Fix issue #4: handle API requests regardless of origin, since the API
  // server may run on a different port/host than the client during dev
  // (and potentially in production behind a different subdomain).
  if (url.pathname.startsWith('/api/v1/') || url.origin === API_ORIGIN) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Everything else: only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Fix issue #3: networkFirstStrategy can throw on cache-miss-after-network-
  // failure. The original handler let that exception propagate uncaught to
  // the browser. Now wrapped so the SW always returns SOME response.
  event.respondWith(
    networkFirstStrategy(request).catch(() =>
      new Response('Network error', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    )
  );
});

// ============================================
// REQUEST HANDLERS
// ============================================
async function handleApiRequest(request) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    if (shouldCacheApiEndpoint(url.pathname)) {
      return apiCacheFirstStrategy(request);
    }
    return networkFirstStrategy(request).catch(() => offlineApiResponse());
  }

  // Non-GET (POST/PUT/DELETE) — try network, return a structured offline
  // error if it fails. Never throw uncaught from a fetch handler.
  try {
    return await fetch(request);
  } catch (error) {
    console.error('[SW] API request failed:', error);
    return offlineApiResponse();
  }
}

function offlineApiResponse() {
  return new Response(
    JSON.stringify({
      error: 'Network error. Please check your connection.',
      offline: true,
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] Static asset fetch failed:', request.url, error);
    if (request.destination === 'image') {
      return new Response('', { status: 404 });
    }
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }

    // Fix issue #2: previously, a non-ok network response (404, 500, etc.)
    // fell through without returning anything — the async function returned
    // `undefined`, which the browser treats as a network error rather than
    // showing the actual response or a sensible fallback.
    return response;
  } catch (error) {
    // Network failed entirely — fall back to cache
    console.warn('[SW] Navigation fetch failed, falling back to cache:', error);

    // Fix issue #7: for a SPA, navigation to routes like /dashboard or /send
    // will never have an exact cache entry (only / and /index.html were
    // cached at install). The original code went straight to OFFLINE_URL for
    // any cache miss, meaning a logged-in user who lost connectivity while
    // navigating within the app would see "you are offline" instead of the
    // app shell, which is capable of rendering the route client-side.
    //
    // New fallback order:
    //   1. Exact match for this URL (rare, but cheap to check)
    //   2. The cached SPA shell (index.html) — lets client-side routing work
    //   3. offline.html — only if even the shell isn't cached
    //   4. Inline minimal HTML — absolute last resort
    const cache = await caches.open(CACHE_NAME);

    const exactMatch = await cache.match(request);
    if (exactMatch) {
      return exactMatch;
    }

    const shellResponse = await cache.match(SHELL_URL);
    if (shellResponse) {
      return shellResponse;
    }

    const offlineResponse = await cache.match(OFFLINE_URL);
    if (offlineResponse) {
      return offlineResponse;
    }

    return new Response(
      `<html>
        <head><title>Offline</title></head>
        <body>
          <h1>You are offline</h1>
          <p>Please check your internet connection.</p>
        </body>
      </html>`,
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      if (request.method === 'GET') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    }
    throw new Error('Response not ok: ' + response.status);
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error; // caller is responsible for catching (see fetch handler)
  }
}

async function apiCacheFirstStrategy(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Fix issue #5: updateApiCache is a fire-and-forget background fetch.
    // It cannot be passed to event.waitUntil from here since we don't have
    // a reference to the originating event. This is accepted as best-effort:
    // if the SW is terminated mid-update the next request will just hit
    // network-first again. Documented rather than silently wrong.
    updateApiCache(request);
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] API cache-first fetch failed:', request.url, error);
    return offlineApiResponse();
  }
}

async function updateApiCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response);
    }
  } catch (error) {
    console.debug('[SW] Background API update failed:', request.url, error);
  }
}

// ============================================
// HELPERS
// ============================================
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.gif',
    '.ico', '.woff', '.woff2', '.ttf', '.eot',
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

function shouldCacheApiEndpoint(pathname) {
  return API_ENDPOINTS.some((endpoint) => pathname.includes(endpoint));
}

// ============================================
// BACKGROUND SYNC
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  try {
    const allClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    allClients.forEach((client) => {
      client.postMessage({ type: 'SYNC_STARTED' });
    });

    // Actual sync logic lives in the app's syncService — the SW only
    // notifies; it does not perform the encrypted sync itself since it
    // has no access to the in-memory DEK.

    allClients.forEach((client) => {
      client.postMessage({ type: 'SYNC_COMPLETED' });
    });
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      // Fix issue #10: event.data.json() throws synchronously if the push
      // payload isn't valid JSON. Inside waitUntil, an uncaught throw is
      // swallowed silently — no notification is shown and nothing is logged
      // in a way the developer would notice. Wrapped in try/catch with a
      // text() fallback so malformed payloads still produce a notification.
      //
      // `data` is declared without an initializer — every branch below
      // (JSON success, text fallback, and the unreadable-payload case)
      // assigns it exactly once before it's read. An initial `= {}` here
      // would be a dead value, since no path reads `data` before reassigning.
      let data;
      try {
        data = event.data ? event.data.json() : {};
      } catch (jsonError) {
        console.warn('[SW] Push payload was not valid JSON, using text fallback:', jsonError);
        try {
          const text = event.data ? event.data.text() : '';
          data = { title: 'SyncPoint', body: text || 'You have a new notification' };
        } catch (textError) {
          console.error('[SW] Push payload unreadable:', textError);
          data = {};
        }
      }

      const options = {
        body: data.body || 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon.ico',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/dashboard' },
        actions: [
          { action: 'open', title: 'Open App' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      };

      await self.registration.showNotification(
        data.title || 'SyncPoint Notification',
        options
      );
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// ============================================
// MESSAGE HANDLING
// ============================================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      // The only place skipWaiting() is called — triggered explicitly by
      // the app after the user agrees to update (see fix issue #1).
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearApiCache());
      break;

    case 'CLEAR_ALL_CACHE':
      event.waitUntil(clearAllCaches());
      break;

    case 'GET_CACHE_SIZE':
      getCacheSize().then((size) => {
        if (event.ports && event.ports.length > 0) {
          event.ports[0].postMessage({ type: 'CACHE_SIZE', payload: { size } });
        }
      });
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

/**
 * Fix issue #9: the original CLEAR_CACHE handler wiped every cache,
 * including CACHE_NAME (the app shell). For an offline-first payment app,
 * losing the shell cache means the next offline navigation has nothing to
 * fall back to. CLEAR_CACHE now only clears the API response cache.
 * CLEAR_ALL_CACHE is a new, separate, explicit command for a full wipe.
 */
async function clearApiCache() {
  await caches.delete(API_CACHE_NAME);
  await caches.open(API_CACHE_NAME); // recreate empty
  console.log('[SW] API cache cleared');
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('[SW] All caches cleared (including app shell)');
}

async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        // Fix issue #6: response.blob() consumes the response body. Since
        // this response comes directly from cache.match(), calling blob()
        // on it destructively reads the cached entry — the NEXT time this
        // same cache entry is matched and its body read, it will be empty
        // (already consumed). clone() first so the original cached Response
        // remains intact for actual future use.
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}