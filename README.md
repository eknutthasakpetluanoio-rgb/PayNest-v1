# PayNest – Smart Installment Manager

โครงสร้างนี้เป็นชุดไฟล์ที่ใช้งานจริงของ PayNest โดยตัดไฟล์ซ้ำ ไฟล์เก่า และไฟล์ที่ไม่ได้ถูกเรียกใช้ออกจาก ZIP แล้ว

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
└── products/
    ├── redmi-watch-5-lite.svg
    ├── soundcore-r60i-nc.svg
    └── vivo-v70.svg
```

## ไฟล์ที่ตัดออก

- `firebase.js`
- `firestore-sync.js`
- `storage.js`
- `pwa-install.js`
- โฟลเดอร์ `js/`
- โฟลเดอร์ `css/`
- โฟลเดอร์ `icon/` ที่มีไอคอนซ้ำ
- `README.txt`
- `INDEX-PWA-INTEGRATION.txt`
- `PWA-FINAL-AUDIT.txt`
- `PWA-VALIDATION.txt`

Firebase, LocalStorage และ PWA ที่ใช้งานจริงถูกรวมอยู่ใน `app.js` และ `sw.js` แล้ว จึงไม่จำเป็นต้องเก็บไฟล์ helper รุ่นเก่าไว้ซ้ำอีก

## หมายเหตุ

- รูปสินค้าใน `products/` ยังถูกใช้งานโดย `app.js` จึงเก็บไว้
- ไอคอน PWA ที่ใช้งานจริงคือ `icon-192.png` และ `icon-512.png` ที่ root
- ไม่ได้เปลี่ยนข้อมูลธุรกิจหรือโครงสร้างข้อมูลของผู้ใช้ในรอบการตัดไฟล์นี้
