const CACHE_NAME = 'paynest-v1';
const assetsToCache = [
  './index.html',
  './style.css',
  './app.js',
  './storage.js',
  './manifest.json'
];

// ติดตั้ง Service Worker และแคชไฟล์พื้นฐาน
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// ดึงข้อมูลแคชมาแสดงผลแบบออฟไลน์
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
