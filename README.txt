PayNest PWA FIX v2 — PWA ONLY

ยึดไฟล์ PayNest ล่าสุดเดิม ไม่แตะ UI / ข้อมูล / Firebase / app logic

แก้เฉพาะ:
1. manifest.json
2. sw.js
3. icons/icon-192.png
4. icons/icon-512.png

เหตุผลของ v2:
- manifest ระบุ id ชัดเจน
- มี prefer_related_applications=false
- มี name/short_name, start_url, display และไอคอน 192/512 ครบ
- Service Worker ไม่ pre-cache firebase/storage/firestore-sync ที่อาจทำให้ install ล้มเหลวเมื่อไฟล์ใดไฟล์หนึ่งตอบ 404
- มี offline fallback กลับไป index.html

index.html ล่าสุดของ PayNest มี manifest link และ register sw.js อยู่แล้ว จึงไม่ต้องแก้ index.html เพิ่มในรอบนี้

ให้อัปโหลดไฟล์ 4 ตัวนี้ทับของเดิมใน root ของ GitHub Pages:
manifest.json
sw.js
icons/icon-192.png
icons/icon-512.png
