// Service worker: precaches the app shell, serves it offline and triggers background sync.
const CACHE_VERSION = '__SW_BUILD_ID__';
const CACHE_NAME = `syncpoint-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/index.html';

const HASHED_ASSETS = "__PRECACHE_ASSETS__";

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon.ico',
  '/icons/new-logo.png',
  ...(Array.isArray(HASHED_ASSETS) ? HASHED_ASSETS : []),
];

const API_CACHE_NAME = `syncpoint-api-${CACHE_VERSION}`;
const API_ENDPOINTS = [
  '/api/v1/wallet/balance',
];

const API_ORIGIN = self.location.hostname === 'localhost'
  ? 'http://localhost:2000'
  : self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] Failed to precache', url, err))
        )
      );

      await caches.open(API_CACHE_NAME);

      console.log('[SW] Install completed. Precached', STATIC_ASSETS.length, 'assets.');
    })()
  );
});

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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname === '/version.json') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  const isCrossOriginApi = API_ORIGIN !== self.location.origin && url.origin === API_ORIGIN;
  if (url.pathname.startsWith('/api/v1/') || isCrossOriginApi) {
    event.respondWith(handleApiRequest(request));
    return;
  }

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

  event.respondWith(
    networkFirstStrategy(request).catch(() =>
      new Response('Network error', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    )
  );
});

async function handleApiRequest(request) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    if (shouldCacheApiEndpoint(url.pathname)) {
      return apiCacheFirstStrategy(request);
    }
    return networkFirstStrategy(request).catch(() => offlineApiResponse());
  }

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

    return response;
  } catch (error) {
    console.warn('[SW] Navigation fetch failed, falling back to cache:', error);

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
    throw error;
  }
}

async function apiCacheFirstStrategy(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
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

function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.gif',
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.json',
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

function shouldCacheApiEndpoint(pathname) {
  return API_ENDPOINTS.some((endpoint) => pathname.includes(endpoint));
}

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

    allClients.forEach((client) => {
      client.postMessage({ type: 'SYNC_COMPLETED' });
    });
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
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

self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
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

async function clearApiCache() {
  await caches.delete(API_CACHE_NAME);
  await caches.open(API_CACHE_NAME);
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
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}
