PayNest v1.2 — ใบเสร็จรับเงิน

ฟีเจอร์ใหม่:
- ปุ่ม “ใบเสร็จ” ในแต่ละรายการรับชำระ
- ใบเสร็จแสดงเลขที่ วันที่ ลูกค้า เบอร์โทร สินค้า จำนวนงวด
- แสดงยอดรับครั้งนี้ รับแล้วสะสม และคงเหลือหลังรับเงิน
- ปุ่ม “พิมพ์ / บันทึกเป็น PDF”

ติดตั้งบน GitHub Pages:
1. ใช้ไฟล์ index.html, app.js, style.css และ storage.js ชุดนี้
2. อัปโหลดทับไฟล์ชื่อเดียวกันใน repository เดิม
3. Commit changes
4. เปิดเว็บ GitHub Pages แล้วรีเฟรช
5. เข้า สัญญา > รายละเอียด > ประวัติการรับชำระ > ใบเสร็จ

หมายเหตุ: ไม่ต้องเปลี่ยน storage.js และไม่ต้องลบข้อมูล LocalStorage เดิม


PayNest Backup & Restore
- "สำรองข้อมูลลงเครื่อง" downloads a JSON backup containing contracts, customers and payment history.
- "กู้คืนข้อมูลจากไฟล์" accepts the new PayNest backup format and older plain JSON backups.
- Before restore/reset, PayNest automatically downloads a backup of the current data.
- Do not delete the downloaded backup files; keep at least one copy in a safe location.


Payment status enhancement
- เพิ่มสถานะ ถึงกำหนด, ชำระบางส่วน, ค้างชำระ, ค้างชำระบางส่วน และชำระครบ
- เพิ่มตัวกรอง ค้างชำระ และ บางส่วนในหน้าสัญญา
- Dashboard แสดงจำนวนรายการค้างกำหนดและครบกำหนดวันนี้


PayNest Latest — Firebase Cloud
- ปุ่ม ☁️ บน Topbar เปิดหน้าบัญชี PayNest Cloud
- รองรับเข้าสู่ระบบ / สร้างบัญชีด้วย Firebase Authentication (Email/Password)
- หลัง Login ระบบจะ merge ข้อมูล LocalStorage กับ Firestore และส่งข้อมูลขึ้น Cloud
- ปรับ Service Worker และ cache-busting เพื่อป้องกัน GitHub Pages ใช้ app.js รุ่นเก่า
- ไม่ต้องลบข้อมูล LocalStorage เดิม
