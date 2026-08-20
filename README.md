# PAYPREMINIQ – Smart Payment Intelligence

โครงสร้างนี้เป็นชุดไฟล์ที่ใช้งานจริงของ PAYPREMINIQ โดยตัดไฟล์ซ้ำ ไฟล์เก่า และไฟล์ที่ไม่ได้ถูกเรียกใช้ออกจาก ZIP แล้ว

## โครงสร้าง

```text
PAYPREMINIQ/
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

## Data Safety Fix

- ป้องกัน Cloud/Firebase ที่ว่างไม่ให้เขียนทับฐานข้อมูล LocalStorage ที่มีข้อมูลอยู่
- หากเครื่องมีข้อมูลแต่ Cloud ว่าง ระบบจะใช้ข้อมูลจากเครื่องและซ่อม Cloud ให้กลับมาตามข้อมูลเดิม
- หากเครื่องว่างแต่ Cloud มีข้อมูล ระบบจะกู้ข้อมูลจาก Cloud ลงเครื่อง
- เก็บฐานข้อมูล LocalStorage ก่อนหน้าไว้ใน recovery slot เมื่อมีข้อมูลจริง เพื่อช่วยกู้คืนกรณีข้อมูลถูกแทนที่โดยไม่ตั้งใจ

## หมายเหตุ

- รูปสินค้าใน `products/` ยังถูกใช้งานโดย `app.js` จึงเก็บไว้
- ไอคอน PWA ที่ใช้งานจริงคือ `icon-192.png` และ `icon-512.png` ที่ root
- ไม่ได้เปลี่ยนข้อมูลธุรกิจหรือโครงสร้างข้อมูลของผู้ใช้ในรอบการตัดไฟล์นี้


## PAYPREMINIQ Core Revision

This revision introduces a single `PayNestCore` calculation layer in `app.js` for installment dates, installment status, payment-to-installment mapping, outstanding balances, due-soon/overdue classification, and payment validation.

Existing UI code remains in place so the revision can be tested incrementally without replacing the existing Firebase/data workflow.
