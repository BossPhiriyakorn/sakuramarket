# ออกแบบฐานข้อมูล Sakura Market

เอกสารนี้อธิบายตารางที่ใช้ในระบบ ณ เวลาปัจจุบัน (ตามฟีเจอร์ที่มีในแอป) และความสัมพันธ์ระหว่างตาราง

---

## สรุปตาราง

| ตาราง | เก็บอะไร |
|--------|----------|
| **users** | บัญชีผู้ใช้ (username, email, password_hash สำหรับสมัคร/ล็อกอิน) |
| **profiles** | ข้อมูลส่วนตัว (ชื่อ, สกุล, เบอร์, เมล, ยูสเนมแสดงจาก users, รูปโปร, วันเกิด) |
| **wallets** | กระเป๋าที่ผู้ใช้ผูกกับบัญชี (address, chain) สำหรับชำระเงิน |
| **rooms** | ห้อง/แผนที่ (ห้อง 1, 2, 3) ใช้จัดกลุ่มล็อค |
| **parcels** | ล็อคบนแผนที่ แต่ละล็อกมีตำแหน่ง grid_x, grid_y, ขนาด ใช้ได้ทั้งโซนป้ายและร้าน |
| **shop_registrations** | ลงทะเบียนร้าน (ชื่อ, คำอธิบาย, โลโก้, คัฟเวอร์) ก่อนเช่าที่ — ยังไม่มี parcel |
| **shop_registration_contacts** | ช่องทางติดต่อร้าน ตอนลงทะเบียน (LINE, โทร) |
| **shops** | ข้อมูลร้านที่เจ้าของตั้ง (ชื่อร้าน, โลโก้, คัฟเวอร์) ผูกกับ parcel และ user — มีเมื่อเช่าที่แล้ว |
| **categories** | หมวดหมู่สินค้า (ของใช้, ของฝาก ฯลฯ) แยกต่อร้านหรือรวมทั้งระบบ |
| **products** | สินค้าของร้าน (ชื่อ, ราคา, รูป, คำอธิบาย, แนะนำ) |
| **product_categories** | ความสัมพันธ์สินค้า–หมวด (สินค้าหนึ่งอยู่หลายหมวดได้) |
| **tags** | แท็กสินค้า (ใช้กรอง/ค้นหา แยกต่อร้านหรือร่วม) |
| **product_tags** | ความสัมพันธ์สินค้า–แท็ก (หลายต่อหลาย) |
| **shop_contact_channels** | ช่องทางติดต่อร้าน (LINE, เบอร์โทร) |
| **shop_verification_documents** | เอกสารยืนยันตัวตนร้าน (ทะเบียนพาณิชย์ บัตร ฯลฯ) |
| **profile_contact_channels** | ช่องทางติดต่อผู้ใช้ (ในโปรไฟล์) |
| **announcements** | ข้อความโฆษณา/ประกาศ แสดงในแถบ Live แยกตามห้อง |
| **orders** | คำสั่งซื้อ (ยอด, สถานะ, gas fee, ผู้ซื้อ) |
| **order_items** | รายการในคำสั่งซื้อ แยกร้าน/สินค้า จำนวน ราคา |
| **shop_follows** | การติดตามร้านค้า (user ติดตาม shop) |
| **shop_reviews** | รีวิวร้านค้า (ดาว 1–5 + คอมเมนต์) |

---

## รายละเอียดตาราง

### users
เก็บบัญชีผู้ใช้สำหรับสมัครสมาชิกและล็อกอิน
- **id** (PK): รหัสผู้ใช้
- **username**: ยูสเซอร์เนม (UNIQUE, ใช้ล็อกอิน)
- **password_hash**: รหัสผ่านที่ hash แล้ว (bcrypt/argon2)
- **email**: อีเมล (UNIQUE, ใช้ล็อกอินหรือติดต่อ)
- **created_at**, **updated_at**: เวลา

---

### profiles
เก็บข้อมูลส่วนตัวที่แสดงในหน้า "จัดการโปรไฟล์" (ชื่อ สกุล เบอร์ เมล ยูสเนมแสดงจาก users)
- **id** (PK)
- **user_id** (FK → users): เจ้าของโปรไฟล์
- **first_name**: ชื่อจริง
- **last_name**: นามสกุล
- **display_name**: ชื่อแสดง (หรือรวมชื่อ–นามสกุล สำหรับ backward compatibility)
- **email**: อีเมล (ซ้ำกับ users ได้ถ้า sync)
- **phone**: เบอร์โทร
- **avatar_url**: URL รูปโปรไฟล์
- **date_of_birth**: วันเดือนปีเกิด (DATE)
- **created_at**, **updated_at**

---

### wallets
เก็บกระเป๋าที่ผู้ใช้ผูกกับบัญชี (สำหรับชำระเงิน/เหรียญ)
- **id** (PK)
- **user_id** (FK → users)
- **address**: ที่อยู่กระเป๋า (wallet address)
- **chain**: chain ที่ใช้ (เช่น polygon, mumbai)
- **is_primary**: ใช้เป็นกระเป๋าหลักหรือไม่
- **created_at**

---

### rooms
เก็บห้อง/แผนที่ (ห้อง 1, 2, 3)
- **id** (PK): ตรงกับ room_id ในแอป (1, 2, 3)
- **name**: ชื่อห้อง (optional)

---

### parcels
เก็บล็อคบนแผนที่ แต่ละล็อคมีตำแหน่งและขนาด
- **id** (PK): รหัสล็อค (เช่น p-room2-x16-ae23)
- **room_id** (FK → rooms): อยู่ห้องไหน
- **owner_id** (FK → users): เจ้าของล็อค (หรือ system สำหรับโซนป้าย)
- **grid_x**, **grid_y**: ตำแหน่งบน grid
- **width**, **height**: ขนาดกี่ช่อง
- **title**: ชื่อ (โซนป้ายหรือร้าน)
- **description**: คำอธิบาย
- **image_url**: รูปแสดงบนแผนที่
- **color**: สี (hex หรือ number) ใช้ในโหมด sales
- **is_label**: เป็นโซนป้าย (true) หรือร้าน (false)
- **external_link**: ลิงก์ภายนอก (optional)
- **created_at**, **updated_at**

---

### shop_registrations
เก็บข้อมูลลงทะเบียนร้าน (ข้อมูล+รูป) ก่อนเช่าที่ — ไม่ต้องมี parcel
- **id** (PK)
- **user_id** (FK → users): ผู้ลงทะเบียน
- **shop_name**: ชื่อร้าน
- **description**: คำอธิบายร้าน
- **logo_url**, **logo_background_color**, **cover_url**: รูปภาพ
- **status**: draft | pending_slot | approved | rejected
- **shop_id** (FK → shops, nullable): เมื่ออนุมัติ/เช่าที่แล้ว ผูกกับร้านจริง
- **created_at**, **updated_at**

---

### shop_registration_contacts
ช่องทางติดต่อร้าน ตอนลงทะเบียน (LINE, เบอร์โทร)
- **id** (PK)
- **registration_id** (FK → shop_registrations)
- **type**, **value**, **label**

---

### shops
เก็บข้อมูลร้านที่เจ้าของตั้ง (ชื่อร้าน, โลโก้, คัฟเวอร์) — ผูกกับ parcel หนึ่งลูก (มีเมื่อเช่าที่แล้ว)
- **id** (PK)
- **parcel_id** (FK → parcels, UNIQUE): ล็อคที่ใช้เป็นร้าน
- **user_id** (FK → users): เจ้าของร้าน
- **shop_name**: ชื่อร้าน
- **description**: คำอธิบายร้าน
- **logo_url**: รูปโลโก้
- **logo_background_color**: สีพื้นหลังโลโก้
- **cover_url**: รูปคัฟเวอร์
- **market_display_url**: รูปแสดงบนแผนที่ (ถ้าไม่ตั้งใช้ logo)
- **verification_status**: สถานะยืนยันตัวตน — none | pending | verified | rejected (แบบชอบปี้/มอล)
- **verified_at**: วันที่อนุมัติยืนยันตัวตน
- **verification_notes**: หมายเหตุจากแอดมิน (ปฏิเสธ/อนุมัติ)
- **membership_plan**: แพ็กเกจสมาชิก — free | basic | premium | recommended (ร้านแนะนำ เสียค่าสมาชิก)
- **membership_expires_at**: วันหมดอายุสมาชิก (สำหรับแพ็กจ่ายรายเดือน/รายปี)
- **payout_wallet_address**: ที่อยู่กระเป๋ารับเงินร้าน (null = ใช้กระเป๋าหลักของเจ้าของ)
- **payout_chain**: chain ของกระเป๋ารับเงิน (เช่น polygon)
- **created_at**, **updated_at**

---

### categories
เก็บหมวดหมู่สินค้า (ของใช้, ของฝาก ฯลฯ) — แยกต่อร้านหรือรวมทั้งระบบ
- **id** (PK)
- **shop_id** (FK → shops, nullable): ถ้า null = หมวดร่วมทั้งระบบ
- **name**: ชื่อหมวด

---

### products
เก็บสินค้าของร้าน
- **id** (PK)
- **shop_id** (FK → shops)
- **name**: ชื่อสินค้า
- **price**: ราคา (หน่วยเหรียญหรือบาทตามระบบ)
- **description**: คำอธิบาย
- **image_url**: รูปสินค้า
- **recommended**: แนะนำหรือไม่
- **status**: สถานะสินค้า — draft (แบบร่าง), active (ขายได้), out_of_stock (หมด), discontinued (เลิกขาย)
- **created_at**, **updated_at**

---

### product_categories
ความสัมพันธ์ many-to-many: สินค้าหนึ่งอยู่หลายหมวดได้
- **product_id** (FK → products)
- **category_id** (FK → categories)
- PK (product_id, category_id)

---

### tags
เก็บแท็กสำหรับกรอง/ค้นหาสินค้า
- **id** (PK)
- **shop_id** (FK → shops, nullable): ถ้า null = แท็กร่วมทั้งระบบ
- **name**: ชื่อแท็ก (เช่น ของขวัญ, ขายดี, ลดราคา)

---

### product_tags
ความสัมพันธ์ many-to-many: สินค้าหนึ่งมีหลายแท็ก แท็กหนึ่งใช้กับหลายสินค้าได้
- **product_id** (FK → products)
- **tag_id** (FK → tags)
- PK (product_id, tag_id)

---

### shop_contact_channels
ช่องทางติดต่อร้าน (LINE, เบอร์โทร ฯลฯ)
- **id** (PK)
- **shop_id** (FK → shops)
- **type**: ประเภท (line, phone, email)
- **value**: ค่า (ID, เบอร์, อีเมล)
- **label**: ข้อความแสดง (optional)

---

### shop_verification_documents
เอกสารยืนยันตัวตนร้าน (แบบชอบปี้/มอล — ส่งเอกสาร + เสียค่าสมาชิกเพื่อเพิ่มความน่าเชื่อถือ)
- **id** (PK)
- **shop_id** (FK → shops)
- **document_type**: ประเภทเอกสาร (เช่น business_registration, id_card, tax_id)
- **file_url**: URL ไฟล์ที่อัปโหลด
- **file_name**: ชื่อไฟล์ (optional)
- **status**: pending | approved | rejected
- **reviewed_at**: วันที่แอดมินตรวจ
- **review_notes**: หมายเหตุการตรวจ
- **created_at**

---

### profile_contact_channels
ช่องทางติดต่อในโปรไฟล์ผู้ใช้
- **id** (PK)
- **profile_id** (FK → profiles)
- **type**, **value**, **label**: เหมือน shop_contact_channels

---

### announcements
ข้อความโฆษณา/ประกาศ แสดงในแถบ Live แยกตามห้อง
- **id** (PK)
- **room_id** (FK → rooms): แสดงในห้องไหน
- **shop_id** (FK → shops, nullable): ร้านที่โฆษณา (ถ้ามี)
- **shop_name**: ชื่อร้าน (เก็บไว้แสดง)
- **message**: ข้อความ
- **created_at**

---

### orders
คำสั่งซื้อ (หัวข้อใบสั่ง)
- **id** (PK)
- **user_id** (FK → users): ผู้ซื้อ
- **status**: สถานะ (pending, paid, shipped, completed, cancelled)
- **subtotal**: ยอดสินค้ารวม
- **gas_fee**: ค่า gas
- **total**: ยอดรวม
- **payer_wallet_address**: กระเป๋าที่ลูกค้าใช้จ่าย (optional สำหรับ audit)
- **payer_chain**: chain ที่ใช้จ่าย (เช่น polygon)
- **created_at**, **updated_at**

---

### order_items
รายการในคำสั่งซื้อ แยกร้าน/สินค้า
- **id** (PK)
- **order_id** (FK → orders)
- **shop_id** (FK → shops): ร้านนี้
- **product_id** (FK → products)
- **product_name**, **product_image_url**: snapshot ตอนซื้อ
- **price**: ราคาต่อหน่วยตอนซื้อ
- **quantity**: จำนวน
- **line_total**: price * quantity

---

### shop_follows
การติดตามร้านค้าที่สนใจ
- **id** (PK)
- **user_id** (FK → users): ผู้ติดตาม
- **shop_id** (FK → shops): ร้านที่ติดตาม
- **created_at**
- UNIQUE(user_id, shop_id): ติดตามร้านเดียวกันได้ครั้งเดียว

---

### shop_reviews
รีวิวร้านค้า (ให้ดาว + คอมเมนต์)
- **id** (PK)
- **shop_id** (FK → shops): ร้านที่ถูกรีวิว
- **user_id** (FK → users): ผู้รีวิว
- **rating**: คะแนนดาว 1–5
- **comment**: ข้อความรีวิว
- **created_at**

*(ใช้คำนวณเฉลี่ยดาวต่อร้าน และเฉลี่ยดาวจากการรีวิวทั้งหมดของ user ในโปรไฟล์)*

---

## ความสัมพันธ์ (สรุป)

- **users** ← profiles, wallets, parcels (owner), shop_registrations, shops, orders, shop_follows, shop_reviews
- **rooms** ← parcels, announcements
- **parcels** ← shops (1:1)
- **shop_registrations** ← shop_registration_contacts; → shops (เมื่อเช่าที่แล้ว)
- **shops** ← categories, products, tags, shop_contact_channels, shop_verification_documents, order_items, shop_follows, shop_reviews
- **products** ← product_categories ↔ categories; ← product_tags ↔ tags
- **orders** ← order_items
- **profiles** ← profile_contact_channels

---

## การชำระเงินและกระเป๋า (จ่าย vs รับ)

- **ลูกค้าจ่าย (ชำระเงิน)**: ใช้ตาราง **wallets** ที่ผูกกับ **user_id** อยู่แล้ว — ลูกค้าเลือกกระเป๋าที่ผูกกับบัญชีใช้จ่าย ไม่จำเป็นต้องเก็บ “เลขกระเป๋าตอนจ่าย” แยกใน orders ถ้าตอนชำระดึงจาก wallet ที่ user เลือกแล้วส่งธุรกรรมบน chain; ถ้าต้องการ audit ว่า “คำสั่งนี้จ่ายจากกระเป๋าไหน” ค่อยเพิ่มคอลัมน์ใน orders เช่น `payer_wallet_address`, `payer_chain` (optional).
- **ร้านรับเงิน**: เก็บใน **shops** แล้ว — **payout_wallet_address** และ **payout_chain**. ถ้า null ระบบใช้กระเป๋าหลักของเจ้าของร้าน (จาก **wallets** ที่ `user_id = shops.user_id` และ `is_primary = true`). ดังนั้นไม่ต้องมีตารางแยกเก็บ “เลขกระเป๋าลูกค้า” สำหรับการรับเงินของร้าน; ร้านรับที่กระเป๋าของร้าน/เจ้าของร้านเท่านั้น.

สรุป: **เก็บเลขกระเป๋าลูกค้า (จ่าย)** — ถ้าต้องการบันทึกว่าคำสั่งนั้นจ่ายจาก address ไหน ให้เพิ่มใน orders (optional). **เก็บเลขกระเป๋าร้าน (รับ)** — เก็บแล้วที่ shops.payout_wallet_address (หรือใช้กระเป๋าเจ้าของร้านถ้า null).

---

## หมายเหตุ

- ไฟล์ SQL สำหรับสร้างตาราง: **scripts/schema-full.sql** (รันผ่าน `npm run db:init`)
- ตารางนี้ออกแบบให้สอดคล้องกับฟีเจอร์ปัจจุบัน (แผนที่, ร้าน, สินค้า, ตะกร้า, สรุปการชำระ, โปรไฟล์, กระเป๋า, โฆษณา, ยืนยันตัวตนร้าน, สมาชิกร้าน)
- เมื่อเชื่อม wallet / blockchain อาจเพิ่มตาราง `transactions` หรือ sync กับ chain
