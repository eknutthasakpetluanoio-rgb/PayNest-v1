const CACHE_NAME = "paynest-v20260814-pwa-2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=20260813-firebase-2",
  "./app.js?v=20260813-firebase-2",
  "./storage.js",
  "./firebase.js",
  "./firestore-sync.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Firebase / external CDN requests go directly to the network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, copy))
              .catch(error => {
                console.warn("PayNest cache update skipped:", error);
              });
          }

          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
