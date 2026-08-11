# PayNest v1

PayNest v1 เป็นเว็บแอปจัดการสัญญาผ่อนชำระแบบ PWA สำหรับใช้งานบนมือถือและ GitHub Pages

## โครงสร้าง
- `index.html` จุดเริ่มต้น
- `css/style.css` UI Piano Black + Glass
- `js/app.js` Logic ของแอป
- `js/storage.js` ระบบจัดเก็บข้อมูล
- `manifest.json` PWA
- `sw.js` Service Worker

## ข้อมูล
ข้อมูลถูกเก็บใน LocalStorage ด้วย key เดียว:
`paynest_v1_data`

มีระบบ:
- เพิ่มสัญญา
- เพิ่ม/ผูกลูกค้าอัตโนมัติ
- รับชำระ
- Progress การชำระ
- ดูสัญญา/ลูกค้า
- ส่งออก JSON
- นำเข้า JSON
- ล้างข้อมูล

## GitHub Pages
อัปโหลดไฟล์ทั้งหมดโดยคงโครงสร้างโฟลเดอร์ แล้วเปิด Settings > Pages และเลือก Deploy from a branch

> แนะนำให้ใช้ Backup JSON ก่อนล้าง browser data หรือเปลี่ยนอุปกรณ์
