const CACHE_NAME = "paynest-pwa-final-20260814-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style.css",
  "./app.js",
  "./storage.js",
  "./firebase.js",
  "./firestore-sync.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Cache each resource independently.
    // One missing optional file must NOT abort the entire Service Worker install.
    await Promise.allSettled(
      APP_SHELL.map(async url => {
        try {
          const response = await fetch(new Request(url, { cache: "no-cache" }));
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (_) {
          // Keep installation resilient.
        }
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (_) {
    return false;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET" || !isSameOrigin(request)) {
    return;
  }

  // Navigation: network first, cached app shell as offline fallback.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("./index.html", response.clone());
        }

        return response;
      } catch (_) {
        const cached = await caches.match("./index.html");
        return cached || Response.error();
      }
    })());

    return;
  }

  // Same-origin static files: cache first, then network.
  event.respondWith((async () => {
    const cached = await caches.match(request);

    if (cached) {
      // Refresh in the background so future launches stay current.
      event.waitUntil((async () => {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response);
          }
        } catch (_) {}
      })());

      return cached;
    }

    try {
      const response = await fetch(request);

      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }

      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
