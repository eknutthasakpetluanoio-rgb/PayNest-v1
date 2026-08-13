PayNest PWA FIX — 2026-08-14

วางไฟล์ตามโครงสร้างนี้ใน root ของ GitHub Pages:

manifest.json
sw.js
icons/icon-192.png
icons/icon-512.png

index.html รุ่นล่าสุดมี <link rel="manifest" href="manifest.json">
และมีการ register ./sw.js อยู่แล้ว จึงไม่ต้องเพิ่ม manifest link ซ้ำ

หลังอัปโหลด ให้เปิด PayNest ใหม่ด้วย Chrome แล้วตรวจเมนู ⋮
ต้องมีตัวเลือกติดตั้งแอป/เพิ่มไปยังหน้าจอหลักเมื่อ Chrome ประเมินว่า installable แล้ว

Patch นี้ทำเฉพาะ PWA ไม่แตะ UI ข้อมูล หรือฟังก์ชันธุรกิจของ PayNest
