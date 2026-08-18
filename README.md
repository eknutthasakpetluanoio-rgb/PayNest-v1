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
└── README.md
```

## หลักการ

- รักษา UI และ business logic เดิมของ PayNest เป็นฐาน
- LocalStorage เป็นพื้นที่ข้อมูลหลักบนเครื่อง
- รองรับ Firebase Authentication + Firestore จาก `app.js`
- รองรับ PWA ผ่าน `manifest.json` และ `sw.js`
- ไม่เพิ่มโฟลเดอร์หรือไฟล์ runtime อื่นนอกเหนือจาก 6 ไฟล์นี้
- ไม่เพิ่มฟีเจอร์ธุรกิจใหม่จากการปรับโครงสร้างครั้งนี้

## การใช้งาน

เปิด `index.html` ผ่านเว็บเซิร์ฟเวอร์หรือ GitHub Pages เพื่อให้ ES Modules, Firebase และ Service Worker ทำงานได้ตามปกติ
