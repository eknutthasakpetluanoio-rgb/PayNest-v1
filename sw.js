// PayNest — Service Worker (clean rebuild)
const CACHE_NAME = "paynest-pwa-v1-clean-20260814";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./storage.js",
  "./firebase.js",
  "./firestore-sync.js",
  "./manifest.json",
  "./icon/icon-192.png",
  "./icon/icon-512.png"
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
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isFirebaseModule(url) {
  return url.hostname === "www.gstatic.com" &&
    url.pathname.includes("/firebasejs/");
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigation: use fresh HTML when online, cached HTML when offline.
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Same-origin app files: cache first, then network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request)
        .then(cached => cached || fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        }))
        .catch(() => Response.error())
    );
    return;
  }

  // Firebase's browser ES modules are fetched from gstatic.
  // Cache successful module responses so the app can start offline after
  // it has first been opened online.
  if (isFirebaseModule(url)) {
    event.respondWith(
      caches.match(request)
        .then(cached => cached || fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        }))
        .catch(() => Response.error())
    );
  }
});
