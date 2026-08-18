PayNest — Clean Rebuild

ฐาน: PayNest-v1-main.zip ล่าสุดที่ผู้ใช้ส่ง

โครงสร้าง:
- index.html
- style.css
- app.js
- storage.js
- firebase.js
- firestore-sync.js
- manifest.json
- sw.js
- pwa-install.js
- icon/icon-192.png
- icon/icon-512.png

PWA:
- manifest + Service Worker อยู่ในชุดเดียวกัน
- registration มีจุดเดียวใน pwa-install.js
- install prompt มีจุดเดียวใน pwa-install.js
- app.js ไม่จัดการ PWA ซ้ำ
- ใช้ relative paths เพื่อรองรับ GitHub Pages project path
- Service Worker ใช้ cache version ใหม่และล้าง cache รุ่นเก่าเมื่อ activate
- รองรับ offline shell หลังเปิดเว็บออนไลน์อย่างน้อย 1 ครั้ง

ไม่เพิ่มฟีเจอร์ธุรกิจใหม่
\n\nPWA FIX 2 — 2026-08-19\n- index.html now explicitly loads pwa-install.js before app.js.\n- manifest id/start_url use index.html for a stable app identity.\n- pwa-install.js verifies the live manifest and controls the native install prompt.\n- Chrome install still requires the deployed site to be HTTPS and meet Chrome's installability rules; no ZIP can bypass that browser requirement.\n