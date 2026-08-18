const CACHE_NAME = 'paynest-v1';
const urlsToCache = [
  './index.html',
  './style.css',
  './app.js'
];

// ติดตั้ง Service Worker และแคชไฟล์หลัก
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// เปิดใช้งานและเคลียร์แคชเก่า
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// สำคัญมาก: ต้องมี fetch event นี้เพื่อให้ Chrome มือถือมองว่าเป็น PWA สมบูรณ์
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
