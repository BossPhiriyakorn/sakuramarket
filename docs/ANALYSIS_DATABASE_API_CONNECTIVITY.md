# รายงานวิเคราะห์: ตาราง DB, API และการเชื่อมต่อ (ผู้ใช้ + CMS)

## 1. สรุปตารางและคอลัมน์ในฐานข้อมูล

จาก `scripts/schema-full.sql`:

| ตาราง | คอลัมน์หลัก | วัตถุประสงค์ |
|--------|-------------|---------------|
| **users** | id, username, password_hash, email, created_at, updated_at, status | บัญชีผู้ใช้ (ล็อกอิน) |
| **profiles** | id, user_id, first_name, last_name, display_name, email, phone, avatar_url, date_of_birth, address_id, ... | ข้อมูลส่วนตัว (โปรไฟล์) |
| **wallets** | id, user_id, address, chain, is_primary | กระเป๋า wallet ผูกบัญชี |
| **addresses** | id, user_id, full_address, map_url, recipient_name, phone, address_line1/2, sub_district, district, province, postal_code, country, ... | ที่อยู่ (จัดส่ง/ที่อยู่ร้าน) |
| **rooms** | id, name | ห้องแผนที่ (1, 2) |
| **parcels** | id, room_id, owner_id, grid_x, grid_y, width, height, title, description, image_url, is_label, ... | ล็อคบนแผนที่ (ร้าน/ป้าย) |
| **shops** | id, parcel_id, user_id, shop_name, description, logo_url, logo_background_color, cover_url, verification_status, membership_plan, ... | ข้อมูลร้าน (หลังเช่าที่แล้ว) |
| **shop_contact_channels** | id, shop_id, type, value, label | ช่องทางติดต่อร้าน (LINE, โทร) |
| **shop_verification_documents** | id, shop_id, document_type, file_url, status, ... | เอกสารยืนยันร้าน |
| **shop_registrations** | id, user_id, shop_name, description, logo_url, logo_background_color, cover_url, status, shop_id, ... | ลงทะเบียนร้าน (ก่อนเช่าที่) |
| **shop_registration_contacts** | id, registration_id, type, value, label | ช่องทางติดต่อตอนลงทะเบียนร้าน |
| **categories** | id, shop_id, name | หมวดหมู่สินค้า (ของร้าน) |
| **products** | id, shop_id, name, price, description, image_url, recommended, status, ... | สินค้าของร้าน (ร้านบนแผนที่) |
| **product_categories** | product_id, category_id | ความสัมพันธ์สินค้า–หมวด |
| **tags** | id, shop_id, name | แท็กสินค้า |
| **product_tags** | product_id, tag_id | ความสัมพันธ์สินค้า–แท็ก |
| **profile_contact_channels** | id, profile_id, type, value, label | ช่องทางติดต่อในโปรไฟล์ |
| **announcements** | id, room_id, shop_id, shop_name, message, created_at, expires_at | ประกาศแถบ Live |
| **orders** | id, user_id, status, subtotal, gas_fee, total, payer_wallet_address, ... | คำสั่งซื้อ (หัวใบสั่ง) |
| **order_items** | id, order_id, shop_id, product_id, product_name, price, quantity, line_total, shipping_status, tracking_number, ... | รายการในคำสั่งซื้อ |
| **shop_follows** | id, user_id, shop_id, created_at | การติดตามร้าน |
| **shop_reviews** | id, shop_id, user_id, rating, comment, created_at | รีวิวร้าน (ดาว + คอมเมนต์) |
| **user_verification** | user_id, verified, verified_at | ยืนยันตัวตนลูกค้า |
| **user_balances** | user_id, balance | เครดิตเหรียญในกระเป๋า |
| **admins** | id, email, password_hash, first_name, last_name, display_name | แอดมิน CMS |
| **item_shop_products** | id, name, category, image_url, price, price_unit, status, is_free, ... | สินค้า Item Shop (กรอบ/โข่ง/ป้าย) |
| **user_inventory** | id, user_id, product_id, product_name, category, image_url, purchased_at, expires_at, uses_left, status | กระเป๋าเก็บของ (โข่ง/ป้ายที่ซื้อแล้ว) |
| **promo_zones** | room_id, zone_key, is_label, image_url | โซนป้าย/โปรโมทต่อห้อง |
| **notifications** | id, type, title, message, created_at, meta | แจ้งเตือนแดชบอร์ด CMS |
| **ref_status** | type, code, label_th | ค่าอ้างอิงสถานะ (order, shipping, ฯลฯ) |

---

## 2. API Routes และการเชื่อมต่อ DB

### 2.1 Auth (ไม่ใช้ /api/data)

| Route | Method | Auth | DB/การทำงาน |
|-------|--------|------|----------------|
| /api/auth/register | POST | - | registerUser → users, profiles, user_verification, user_balances, addresses (ถ้ามี) |
| /api/auth/login | POST | - | ค้น users, ตรวจ password, ออก cookie |
| /api/auth/logout | POST | - | ล้าง cookie |
| /api/auth/me | GET | User cookie | ตรวจ token, คืน user |
| /api/auth/request-otp | POST | - | (ถ้ามี OTP เก็บใน DB/cache) |
| /api/auth/login-admin | POST | - | findAdminByEmail, verifyAdminPassword, addNotification |
| /api/auth/demo-admin | POST | - | ออก cookie แอดมิน demo |

### 2.2 ข้อมูลสำหรับผู้ใช้ (User) — /api/data/me/*

| Route | Method | Auth | DB (dbStore) | หมายเหตุ |
|-------|--------|------|--------------|----------|
| /api/data/me/profile | PATCH | User | updateProfileByUserId (profiles) | อัปเดตชื่อ/เบอร์/อีเมล/avatar |
| /api/data/me/address | GET | User | getAddressById, profiles.address_id | อ่านที่อยู่หลักจาก profile |
| /api/data/me/shop | GET | User | getShopByUserId, getRegistrationByUserId, products COUNT | ร้าน + การลงทะเบียน + จำนวนสินค้า |
| /api/data/me/shop-registration | POST | User | upsertShopRegistration (shop_registrations) | บันทึก/อัปเดตการลงทะเบียนร้าน |
| /api/data/me/shop/verify | POST | User | (ตรวจมีร้าน+parcel), insertShopVerificationDocument | ส่งเอกสารยืนยันร้าน |
| /api/data/me/balance | GET | User | getBalanceByUserId (user_balances) | ยอดเหรียญ |
| /api/data/me/tracking | GET | User | getOrdersWithItemsForBuyer (orders, order_items) | ออเดอร์ที่ผู้ใช้เป็นผู้รับ |
| /api/data/me/shop-tracking | GET | User | getOrderItemsForShop (order_items) | รายการที่ร้านต้องจัดส่ง |
| /api/data/me/order-items/[id]/shipping | PATCH | User | updateOrderItemShipping (order_items) | อัปเดตสถานะจัดส่ง/เลขพัสดุ/proof |
| /api/data/me/inventory | GET | User | getInventoryForUser (user_inventory) | กระเป๋าโข่ง/ป้าย |
| /api/data/me/inventory | POST | User | addPurchase (user_inventory, user_balances) | ซื้อของจาก Item Shop |
| /api/data/me/inventory/[id]/use | PATCH | User | consumeInventoryItem (user_inventory, announcements INSERT) | ใช้โข่ง/ป้าย + สร้างประกาศ Live |
| /api/data/me/verification | GET | User | getUserVerification (user_verification) | สถานะยืนยันตัวตน |
| /api/data/me/verification | POST | User | setUserVerified (user_verification) | ยืนยันตัวตน (หลังอัปโหลดเอกสาร) |

### 2.3 ข้อมูลสาธารณะ/แผนที่ (ไม่ต้องแอดมิน)

| Route | Method | Auth | DB | หมายเหตุ |
|-------|--------|------|-----|----------|
| /api/data/rooms | GET | - | getRooms | รายการห้อง |
| /api/data/parcels | GET | - | getParcelsForRoom (roomId=1,2) | ล็อคต่อห้อง (แผนที่) |
| /api/data/announcements | GET | - | getAnnouncementsForRoom (มี roomId) | ประกาศแถบ Live ต่อห้อง |
| /api/data/ref-status | GET | - | getRefStatus | สถานะอ้างอิง (จัดส่ง ฯลฯ) |

### 2.4 ข้อมูลสำหรับ CMS (แอดมิน)

| Route | Method | Auth | DB | หมายเหตุ |
|-------|--------|------|-----|----------|
| /api/data/users | GET | Admin | getUsers | รายการผู้ใช้ |
| /api/data/users/[id] | GET | User ตัวเอง หรือ Admin | getUserDetail (users, profiles, wallets, verification, shops, shop_registrations, address, payments, payouts) | รายละเอียดผู้ใช้ |
| /api/data/shop-registrations | GET | Admin | getShopRegistrationsList | รายการลงทะเบียนร้าน |
| /api/data/shops | GET | Admin | getShopsList | รายการร้าน (ที่เช่าที่แล้ว) |
| /api/data/shops/[id] | GET | Admin | getShopDetail (shop/reg, profile, productCount, payouts, rooms, parcels, verification_docs) | รายละเอียดร้าน + จองที่ |
| /api/data/book-parcel | POST | Admin | bookParcel (parcels INSERT, shops INSERT จาก shop_registrations) | จองที่ให้ร้าน |
| /api/data/orders | GET | Admin | getOrdersList, getOrderItemsList | คำสั่งซื้อ + รายการ |
| /api/data/verification-documents | GET | Admin | getVerificationDocumentsList | เอกสารยืนยันร้าน |
| /api/data/dashboard | GET | Admin | getData (นับ users, shops, parcels, orders, ...) | จำนวนสำหรับแดชบอร์ด |
| /api/data/notifications | GET | Admin | getNotifications | แจ้งเตือน CMS |
| /api/data/admins | GET | Admin | getAdminsList | รายการแอดมิน |
| /api/data/admins | POST | Admin | addAdmin | สร้างแอดมิน |
| /api/data/admins/[id] | PATCH | Admin | updateAdmin | แก้ไขแอดมิน |
| /api/data/admins/[id] | DELETE | Admin | deleteAdmin | ลบแอดมิน |
| /api/data/rooms | GET | - | getRooms | (ใช้ทั้งแผนที่และ CMS) |
| /api/data/parcels | GET | Admin (ไม่มี roomId) | getData().parcels | รายการ parcels ทั้งหมด |
| /api/data/announcements | GET | Admin (ไม่มี roomId) | getData().announcements | รายการประกาศทั้งหมด |
| /api/data/promo-zones | GET | - | getPromoZonesByRoom | โซนป้ายต่อห้อง |
| /api/data/promo-zones | POST | Admin | setPromoZones (DELETE + INSERT promo_zones) | บันทึกโซนป้าย (CMS parcels) |
| /api/data/item-shop-products | GET | Admin | getItemShopProducts | สินค้า Item Shop |
| /api/data/item-shop-products | POST | Admin | createItemShopProduct | สร้างสินค้า Item Shop |
| /api/data/item-shop-products/[id] | GET | Admin | getItemShopProductById | รายละเอียด 1 รายการ |
| /api/data/item-shop-products/[id] | PATCH | Admin | updateItemShopProduct | แก้ไขสินค้า Item Shop |
| /api/data/item-shop-products/[id] | DELETE | Admin | deleteItemShopProduct | ลบสินค้า Item Shop |

### 2.5 อัปโหลดไฟล์

| Route | Method | Auth | การทำงาน |
|-------|--------|------|----------|
| /api/upload | POST | User (หรือแอดมิน ตาม folder) | รับ file + folder (profile/shops/cms), บันทึกไฟล์, คืน URL |

---

## 3. การเชื่อมต่อฝั่งผู้ใช้ (User)

### 3.1 หน้าที่เรียก API / ใช้ข้อมูล

| หน้า | API / การเชื่อมต่อ | สถานะ |
|------|---------------------|--------|
| / (แผนที่) | /api/auth/me, /api/data/rooms, /api/data/parcels?roomId=, /api/data/announcements?roomId= | ✅ |
| /login | /api/auth/login | ✅ |
| /register | /api/auth/request-otp, /api/auth/register | ✅ |
| /profile | /api/data/me/address, /api/data/me/shop, /api/upload, /api/data/me/profile (PATCH), /api/auth/me, /api/data/users/[id] (แอดมิน) | ✅ (ที่อยู่: อ่านอย่างเดียว ไม่มี PATCH ที่อยู่) |
| /register-shop | /api/data/me/address, /api/upload, /api/data/me/shop-registration (POST) | ✅ |
| /manage-shop | fetchMyShop (/api/data/me/shop), /api/upload (รูปปก/โลโก้) | ⚠️ ดูด้านล่าง |
| /manage-shop/products | ข้อมูล products/categories จาก **store อย่างเดียว** (ไม่โหลดจาก DB) | ❌ ไม่มี API สินค้าร้าน |
| /manage-shop/packages | fetchItemShopProducts, purchaseInventoryItem | ✅ (Item Shop) |
| /shop/[id] (หน้าร้าน) | ข้อมูลจาก store (parcels + useManageShopStore) | ⚠️ สินค้า/หมวดจาก store |
| /following | useFollowStore (สถานะติดตาม) | ❌ เก็บแค่ใน memory |
| /tracking | /api/data/me/tracking, /api/data/me/shop-tracking, ref-status, /api/data/me/order-items/[id]/shipping (PATCH), /api/upload | ✅ |
| /checkout | useCartStore (ตะกร้า) | ❌ ไม่มี API สร้าง orders |
| Item Shop (packages) | fetchItemShopProducts, purchaseInventoryItem, fetchMyBalance | ✅ |

### 3.2 จุดที่ยังไม่เชื่อมต่อ / ไม่สมบูรณ์ (ฝั่งผู้ใช้)

1. **ที่อยู่ (addresses)**  
   - **GET /api/data/me/address**: อ่านที่อยู่หลักจาก profile.address_id  
   - **ไม่มี PATCH/POST /api/data/me/address**: ไม่มี API ให้ผู้ใช้สร้าง/แก้ไขที่อยู่  
   - หน้าโปรไฟล์/ลงทะเบียนร้าน ถ้ามีฟอร์มที่อยู่ จะเก็บแค่ใน store หรือส่งที่อื่น ไม่ได้บันทึกเข้า `addresses` ผ่าน API นี้

2. **สินค้าร้าน (products + categories)**  
   - ตาราง **products**, **categories**, **product_categories** (และ tags/product_tags) **ไม่มี API สำหรับร้าน (ผู้ใช้)**  
   - หน้าจัดการสินค้า (/manage-shop/products) ใช้แค่ **useManageShopStore** (products, categories) = **ไม่บันทึกเข้า DB**  
   - หน้าร้าน /shop/[id] แสดงสินค้าจาก store เหมือนกัน = หลังรีเฟรชหรือเข้าใหม่จะไม่มีสินค้า

3. **การติดตามร้าน (shop_follows)**  
   - **followStore** เก็บแค่ `followedShopIds` ใน memory  
   - **ไม่มี API อ่าน/เขียน shop_follows**  
   - หลังรีเฟรชหรือเปลี่ยนอุปกรณ์ สถานะติดตามหาย

4. **รีวิวร้าน (shop_reviews)**  
   - **reviewStore** เก็บแค่ใน memory  
   - **ไม่มี API อ่าน/เขียน shop_reviews**  
   - รีวิวไม่บันทึกใน DB หลังรีเฟรชหาย

5. **คำสั่งซื้อ (orders + order_items)**  
   - **ไม่มี API สร้างคำสั่งซื้อ (POST order)**  
   - หน้า checkout ใช้แค่ cart ใน store และมี TODO ชำระเงิน  
   - ตาราง orders/order_items จึงไม่มีข้อมูลจาก flow ช็อปจริง (มีแค่จาก seed หรือเครื่องมืออื่นถ้ามี)

6. **ช่องทางติดต่อ (profile / ร้าน / การลงทะเบียน)**  
   - **profile_contact_channels**: โปรไฟล์อาจอัปเดตผ่าน PATCH profile แต่การเขียน contact channels แยกไม่ชัดจาก API ปัจจุบัน  
   - **shop_contact_channels**: ไม่เห็น API โดยตรง  
   - **shop_registration_contacts**: ลงทะเบียนร้านบันทึกแค่ shop_registrations (ชื่อ, รูป) ยังไม่เห็น API แยกสำหรับ contacts ของ registration  

7. **ข้อมูลร้านใน manage-shop (cover/โลโก้/ชื่อ)**  
   - การอัปโหลดรูป (cover/โลโก้) มีผ่าน /api/upload  
   - **ไม่มี API PATCH/PUT สำหรับ shops หรือ shop_registrations** จากฝั่งผู้ใช้ (เช่น อัปเดตชื่อร้าน/รูปจาก manage-shop โดยไม่ผ่าน register-shop)

---

## 4. การเชื่อมต่อฝั่ง CMS

### 4.1 หน้าที่เรียก API

| หน้า CMS | API | สถานะ |
|----------|-----|--------|
| /cms (แดชบอร์ด) | fetchDashboard, fetchNotifications | ✅ |
| /cms/users | /api/data/users, /api/data/shop-registrations | ✅ |
| /cms/users/[id] | /api/data/users/[id], rooms, parcels, verification-documents | ✅ |
| /cms/shops | /api/data/shop-registrations, /api/data/shops, /api/data/users | ✅ |
| /cms/shops/[id] | fetchShopDetail, bookParcel (POST /api/data/book-parcel) | ✅ |
| /cms/products | fetchItemShopProducts, create/update/delete Item Shop (item-shop-products) | ✅ (Item Shop เท่านั้น) |
| /cms/announcements | /api/data/rooms, /api/data/announcements | ✅ อ่านอย่างเดียว (ไม่มีปุ่มเพิ่ม/ลบประกาศ) |
| /cms/orders | /api/data/orders | ✅ อ่านอย่างเดียว |
| /cms/verification | /api/data/verification-documents, /api/data/shops | ✅ |
| /cms/parcels | /api/data/rooms, parcels, promo-zones (GET+POST) | ✅ |
| /cms/admins | fetchAdmins, createAdmin, updateAdminById, deleteAdminById | ✅ |
| /cms/sales | (ถ้ามี ดูประวัติขาย) | ขึ้นกับ implementation |

### 4.2 จุดที่ยังไม่เชื่อมต่อ / ไม่สมบูรณ์ (CMS)

1. **ประกาศ (announcements)**  
   - CMS แสดงรายการประกาศได้  
   - **ไม่มี API POST/PATCH/DELETE สำหรับ announcements**  
   - การสร้างประกาศมีแค่ตอน “ใช้โข่ง/ป้าย” ใน consumeInventoryItem  
   - แอดมินไม่สามารถเพิ่ม/แก้/ลบประกาศจาก CMS โดยตรง

2. **คำสั่งซื้อ (orders)**  
   - CMS อ่าน orders/order_items ได้  
   - **ไม่มี API สร้าง order จาก CMS** (เช่น สร้าง order แทนลูกค้า)  
   - การอัปเดต order (เช่น สถานะ) ไม่ชัดว่ามี route แยกหรือไม่ (มีการอัปเดต order_items ผ่าน me/order-items/[id]/shipping)

3. **สินค้าร้าน (products/categories)**  
   - **ไม่มี route /api/data/products หรือ /api/data/categories สำหรับร้านบนแผนที่**  
   - CMS จัดการได้แค่ **item_shop_products** (กรอบ/โข่ง/ป้าย)  
   - สินค้าของร้าน (products ที่ผูก shop_id) ไม่มีทั้งฝั่งผู้ใช้และฝั่ง CMS

4. **ห้อง (rooms)**  
   - อ่านได้จาก getRooms  
   - **ไม่มี API สร้าง/แก้/ลบ rooms** (ถ้าต้องการให้แอดมินจัดการห้องต้องเพิ่ม)

5. **Parcels**  
   - อ่านได้ (getParcelsForRoom หรือ getData().parcels)  
   - การสร้าง/แก้ parcel มีผ่าน **book-parcel** (สร้าง parcel + shop จาก registration)  
   - **ไม่มี API แก้/ลบ parcel โดยตรง** (เช่น ย้ายที่, ลบร้าน)

---

## 5. สรุปตารางที่ “ไม่มี API เขียน” หรือ “ใช้ไม่ครบ”

| ตาราง | อ่าน (API) | เขียน (API) | หมายเหตุ |
|--------|------------|-------------|----------|
| users | ✅ (auth, getUserDetail) | ✅ (register) | |
| profiles | ✅ | ✅ (PATCH me/profile) | |
| wallets | ✅ (getUserDetail) | ❌ | ไม่มี API เพิ่ม/แก้ wallet |
| addresses | ✅ (me/address, getUserDetail) | ⚠️ (register มี createAddress) | ไม่มี API แก้ที่อยู่จากโปรไฟล์/ร้าน |
| rooms | ✅ | ❌ | อ่านอย่างเดียว |
| parcels | ✅ | ✅ (ผ่าน book-parcel) | ไม่มีอัปเดต/ลบ parcel โดยตรง |
| shops | ✅ | ✅ (สร้างผ่าน book-parcel), setShopVerificationStatus | ไม่มี PATCH shop (ชื่อ/รูป) จากผู้ใช้ |
| shop_contact_channels | ❌ | ❌ | ไม่มี API |
| shop_verification_documents | ✅ | ✅ (me/shop/verify) | |
| shop_registrations | ✅ | ✅ (me/shop-registration, book-parcel อ่าน) | |
| shop_registration_contacts | ❌ | ❌ | ไม่มี API (ลงทะเบียนร้านไม่บันทึก contacts ลงตารางนี้) |
| categories | ❌ | ❌ | ไม่มี API (manage-shop ใช้แค่ store) |
| products | ❌ (มีแค่ COUNT ใน getShopDetail) | ❌ | ไม่มี API สินค้าร้าน |
| product_categories | ❌ | ❌ | ไม่มี API |
| tags | ❌ | ❌ | ไม่มี API |
| product_tags | ❌ | ❌ | ไม่มี API |
| profile_contact_channels | ❌ (อาจรวมใน profile) | ❌ | ไม่ชัด |
| announcements | ✅ | ⚠️ (INSERT เฉพาะตอนใช้โข่ง/ป้าย) | CMS ไม่มีสร้าง/แก้/ลบ |
| orders | ✅ | ❌ | ไม่มี API สร้าง order (checkout ยังไม่เชื่อม) |
| order_items | ✅ | ✅ (PATCH shipping ผ่าน me/order-items/[id]/shipping) | ไม่มี API สร้าง order_items |
| shop_follows | ❌ | ❌ | ใช้แค่ followStore (memory) |
| shop_reviews | ❌ | ❌ | ใช้แค่ reviewStore (memory) |
| user_verification | ✅ | ✅ (setUserVerified, submitIdentityVerification) | |
| user_balances | ✅ | ✅ (ผ่าน addPurchase ลดเหรียญ) | ไม่มี API เติมเหรียญ/ปรับยอดโดยตรง (นอกจาก flow ซื้อของ) |
| admins | ✅ | ✅ (CRUD ครบ) | |
| item_shop_products | ✅ | ✅ (CRUD ครบ) | |
| user_inventory | ✅ | ✅ (POST ซื้อ, PATCH use) | |
| promo_zones | ✅ | ✅ (POST setPromoZones) | |
| notifications | ✅ | ✅ (addNotification ตอนล็อกอินแอดมิน) | |

---

## 6. แนะนำการเชื่อมต่อที่ควรทำเพื่อความสมบูรณ์

### 6.1 ฝั่งผู้ใช้

1. **สินค้าร้าน (products + categories)**  
   - เพิ่ม API สำหรับร้าน: เช่น GET/POST/PATCH/DELETE /api/data/me/shop/products และ /api/data/me/shop/categories (หรือเทียบเท่า)  
   - ให้ /manage-shop/products โหลดจาก API และบันทึกผ่าน API  
   - ให้ /shop/[id] โหลดสินค้าจาก API (ตาม shop_id หรือ parcel_id)

2. **การติดตามร้าน (shop_follows)**  
   - GET /api/data/me/follows (หรือเทียบเท่า) โหลดรายการร้านที่ติดตาม  
   - POST/DELETE (หรือ PATCH) เพื่อ toggle การติดตาม  
   - หน้า following โหลดจาก API และเรียก API เมื่อกดติดตาม/ยกเลิก

3. **รีวิวร้าน (shop_reviews)**  
   - GET รีวิวต่อร้าน (และถ้าต้องการ GET รีวิวของ user)  
   - POST เพิ่มรีวิว  
   - หน้า shop/[id] และ reviewStore ใช้ API แทน memory

4. **ที่อยู่ (addresses)**  
   - PATCH /api/data/me/address หรือ POST/PATCH สำหรับหลายที่อยู่  
   - หน้าโปรไฟล์/ลงทะเบียนร้าน ให้บันทึกที่อยู่ผ่าน API นี้และผูก profile/registration กับ address_id ถ้าออกแบบไว้

5. **ช่องทางติดต่อ**  
   - ถ้าต้องการเก็บ profile_contact_channels / shop_registration_contacts จริงใน DB ให้มี API อ่าน/เขียน (หรือรวมใน payload profile / shop-registration แล้วให้ backend เขียนตาราง contacts)

6. **คำสั่งซื้อ (orders + order_items)**  
   - เมื่อ flow ชำระเงินพร้อม: เพิ่ม POST /api/data/me/orders (หรือเทียบเท่า) รับ cart, สร้าง order + order_items, อัปเดต stock/balance ตามที่ออกแบบ  
   - หน้า checkout เรียก API นี้หลังชำระเงินสำเร็จ

### 6.2 ฝั่ง CMS

1. **ประกาศ (announcements)**  
   - POST/PATCH/DELETE /api/data/announcements (หรือ /api/data/announcements/[id])  
   - หน้า CMS announcements ให้ปุ่มเพิ่ม/แก้/ลบและเรียก API

2. **สินค้าร้าน (products/categories)**  
   - ถ้าให้ CMS จัดการสินค้าร้านได้: เพิ่ม API อ่าน/เขียน products, categories (ตาม shop_id) และให้หน้า CMS เรียกใช้

3. **ห้อง (rooms)**  
   - ถ้าต้องการให้แอดมินสร้าง/แก้ห้อง: เพิ่ม API สำหรับ rooms

4. **Parcels**  
   - ถ้าต้องการให้แอดมินแก้/ย้าย/ลบที่ร้าน: เพิ่ม PATCH/DELETE สำหรับ parcels (และอาจกระทบ shops)

---

## 7. สรุปภาพรวม

- **ส่วนที่เชื่อมครบแล้ว**: Auth, ลงทะเบียนร้าน (shop_registrations), จองที่ (book-parcel → parcels + shops), Item Shop + กระเป๋า, ยืนยันร้าน/ตัวตน, ติดตามสินค้า (order_items shipping), แอดมิน, แดชบอร์ด, ผู้ใช้/ร้านใน CMS, โซนป้าย (promo_zones), อัปโหลดไฟล์  
- **ส่วนที่ยังไม่เชื่อมหรือไม่สมบูรณ์**:  
  - สินค้าร้าน (products, categories) ทั้งผู้ใช้และ CMS  
  - การติดตามร้าน (shop_follows)  
  - รีวิวร้าน (shop_reviews)  
  - การสร้างคำสั่งซื้อ (orders/order_items) จาก checkout  
  - ที่อยู่ (addresses) การแก้จากโปรไฟล์/ร้าน  
  - ประกาศ (announcements) การสร้าง/แก้/ลบจาก CMS  
  - ช่องทางติดต่อ (profile/shop/registration contacts) ถ้าต้องการเก็บใน DB  

ถ้าต้องการให้ระบบ “ครบ” ตาม schema และ flow ที่ออกแบบ ควรเรียงลำดับทำตามหัวข้อในข้อ 6 ตามความสำคัญของฟีเจอร์ (เช่น สินค้าร้าน + orders ก่อน แล้วตามด้วย follows/reviews และที่อยู่/ประกาศ/CMS ให้ครบตามต้องการ)
