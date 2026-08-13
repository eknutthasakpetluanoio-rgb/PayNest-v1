const CACHE_NAME = "paynest-pwa-v6";
const RUNTIME_CACHE = "paynest-runtime-v6";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=20260813-firebase-2",
  "./app.js?v=20260814-pwa-install-2",
  "./storage.js",
  "./firebase.js",
  "./firestore-sync.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const FIREBASE_CDN_HOSTS = new Set([
  "www.gstatic.com",
  "gstatic.com"
]);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map(key => caches.delete(key))
        )
      ),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve()
    ]).then(() => self.clients.claim())
  );
});

async function cacheRuntime(request, response) {
  if (!response || (!response.ok && response.type !== "opaque")) return response;

  const copy = response.clone();
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, copy);
  return response;
}

async function handleRequest(request, preloadResponsePromise) {
  const url = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isFirebaseCdn = FIREBASE_CDN_HOSTS.has(url.hostname);

  // Navigation: prefer the network so a new deployment becomes available
  // immediately; fall back to the cached app shell when offline.
  if (isNavigation) {
    try {
      const preload = await preloadResponsePromise;
      const response = preload || await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(request)) ||
             (await caches.match("./index.html")) ||
             Response.error();
    }
  }

  // Firebase's browser modules are loaded from gstatic. Cache successful
  // responses at runtime so the already-used app can still start offline.
  if (isFirebaseCdn) {
    const cached = await caches.match(request);
    if (cached) {
      // Refresh in the background when online.
      fetch(request)
        .then(response => cacheRuntime(request, response))
        .catch(() => {});
      return cached;
    }

    try {
      return await cacheRuntime(request, await fetch(request));
    } catch {
      return Response.error();
    }
  }

  // Local app assets: cache first for fast startup, then update the cache.
  if (url.origin === self.location.origin) {
    const cached = await caches.match(request);
    if (cached) {
      fetch(request)
        .then(async response => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
        })
        .catch(() => {});
      return cached;
    }

    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  }

  return fetch(request);
}

// Navigation preload is optional and not available in every browser.
async function eventPreload(request) {
  try {
    return await self.registration.navigationPreload?.getState()
      ? await self.registration.navigationPreload.getState() && null
      : null;
  } catch {
    return null;
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(handleRequest(event.request, event.preloadResponse));
});
