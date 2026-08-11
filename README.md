# PayNest v1 Final

ชุดนี้ออกแบบใหม่ให้ Data / Storage / Logic / UI / UX ใช้โครงสร้างเดียวกัน

## หลักสำคัญ
- สร้างสัญญาได้ทันทีโดย **ไม่ต้องสร้างลูกค้าก่อน**
- ถ้าพิมพ์ชื่อลูกค้า ระบบจะสร้าง/ผูกลูกค้าให้อัตโนมัติ
- ถ้าเลือกจากลูกค้าที่มีอยู่ ระบบจะผูก customerId ให้
- ใช้ LocalStorage ชุดเดียว: `paynest_v1_data`
- รองรับเพิ่มเงินรับชำระและคำนวณยอดคงเหลือ
- Export / Import JSON
- Mobile-first และไม่ใช้ framework/build step

## Deploy
วาง `index.html`, `app.js`, `storage.js`, `style.css` ไว้ที่ root ของ GitHub Pages repository แล้ว deploy จาก `main / (root)`.

## หมายเหตุ
อย่าอัปโหลดเฉพาะ `storage.js` หรือเฉพาะไฟล์ใดไฟล์หนึ่งแทนชุดนี้ เพราะไฟล์ทั้งหมดถูกออกแบบให้ทำงานร่วมกัน
