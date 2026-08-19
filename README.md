# PayNest – Smart Installment Manager

PayNest เป็นเว็บแอปสำหรับจัดการสัญญาผ่อนชำระและติดตามการรับชำระเงิน โดยยึดฐาน UI และ business logic จาก `PayNest-v1-main.zip` ที่ผู้ใช้ส่งล่าสุด แล้วรวม dependency เดิมที่จำเป็นไว้ใน `app.js` เพื่อให้โครงสร้างเหลือเพียง 6 ไฟล์ตามข้อตกลง

## โครงสร้าง

```text
PayNest/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── sw.js
├── icon-192.png
├── icon-512.png
├── products/
└── README.md
```

ไฟล์อื่นๆ ที่เคยอยู่ใน ZIP เดิม (storage.js, firebase.js, firestore-sync.js, pwa-install.js, css/rebuild.css, โฟลเดอร์ js/, โฟลเดอร์ icon/) ไม่ได้ถูก import หรือเรียกใช้จากที่ไหนเลยในแอปที่รันจริง (index.html โหลดแค่ style.css กับ app.js) จึงถูกตัดออก เหลือเฉพาะไฟล์ที่ใช้งานจริง

## หลักการ

- รักษา UI และ business logic เดิมของ PayNest เป็นฐาน
- LocalStorage เป็นพื้นที่ข้อมูลหลักบนเครื่อง
- รองรับ Firebase Authentication + Firestore จาก `app.js` (self-contained ในไฟล์เดียว)
- รองรับ PWA ผ่าน `manifest.json` และ `sw.js`
- ไม่เพิ่มฟีเจอร์ธุรกิจใหม่จากการปรับโครงสร้างครั้งนี้

## การใช้งาน

เปิด `index.html` ผ่านเว็บเซิร์ฟเวอร์หรือ GitHub Pages เพื่อให้ ES Modules, Firebase และ Service Worker ทำงานได้ตามปกติ (ห้ามเปิดแบบ `file://` เพราะ ES Modules และ Service Worker ต้องการ HTTP/HTTPS)

## แก้ไขล่าสุด (2026-08-20)

- **แก้บั๊ก**: ปุ่ม "ล้างข้อมูล" เรียกฟังก์ชัน `saveData()` ที่ไม่มีอยู่จริง ทำให้เกิด `ReferenceError` ตอนกดยืนยันล้างข้อมูล — เปลี่ยนไปเรียก `setCloudData()` ให้ตรงกับฟังก์ชันที่มีอยู่จริงในไฟล์
- **แก้ PWA installability**: เพิ่ม `icons` array ที่หายไปใน `manifest.json` (192x192 และ 512x512 ทั้งแบบ `any` และ `maskable`) ซึ่งเป็นเงื่อนไขที่ Chrome ต้องใช้ตัดสินว่าจะแสดงปุ่มติดตั้งหรือไม่
- อัปเดต `sw.js` ให้แคช icon ทั้งสองไฟล์ไว้ใน app shell ด้วย และเลื่อนเวอร์ชัน cache เป็น v6 เพื่อบังคับให้ผู้ใช้เดิมได้ไฟล์ที่แก้แล้ว
- ตัดไฟล์ที่ไม่ได้ใช้งานจริงออกทั้งหมด (ดูหัวข้อโครงสร้างด้านบน) เพื่อไม่ให้สับสนว่าไฟล์ไหน "ของจริง"


### ตรวจสอบรอบล่าสุด
- แก้โลโก้บน Top Bar จาก `<img>` ที่อาจขึ้นเป็นรูปเสีย ให้เป็น SVG ที่ฝังใน `index.html` จึงไม่พึ่งพาไฟล์รูปสำหรับการแสดงโลโก้บนหน้าเว็บ
- คง `icon-192.png` และ `icon-512.png` ไว้สำหรับ PWA/manifest
- ตัดไฟล์และโฟลเดอร์ที่ไม่ถูกเรียกใช้โดยแอปจริงออก เพื่อให้มี source of truth ชัดเจน
- คงโฟลเดอร์ `products/` เพราะ `app.js` เรียกใช้รูปสินค้าโดยตรง
