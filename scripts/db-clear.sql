-- =============================================================================
-- ล้างฐานข้อมูล: ลบข้อมูลผู้ใช้ทั้งหมด + ข้อมูล CMS ทั้งหมด
-- ยกเว้น: admins (ข้อมูลเข้าใช้งานแอดมิน), ref_status (ค่าอ้างอิง label ใน UI)
-- =============================================================================
-- หลังล้างจะใส่ห้องเดียว (id=1, ชื่อว่าง) กลับ
-- รัน: ผ่าน node scripts/db-clear.js หรือ psql/pgAdmin
-- =============================================================================

-- -----------------------------------------------------------------------------
-- สรุปตารางทั้งหมดใน schema (วิเคราะห์)
-- -----------------------------------------------------------------------------
-- [ต้องลบ — ข้อมูลผู้ใช้และที่เกี่ยวกัน]
--   users, profiles, wallets, addresses,
--   user_verification, user_balances, user_ad_credits, profile_contact_channels,
--   shop_registrations, shop_registration_contacts,
--   parcels, shops, shop_contact_channels, shop_verification_documents,
--   categories, products, product_categories, tags, product_tags,
--   orders, order_items, shop_follows, shop_reviews,
--   user_inventory
--   → ลบได้ด้วย TRUNCATE users CASCADE (ลบ users แล้ว CASCADE ไปตารางที่อ้างอิง users)
--
-- [ต้องลบ — ข้อมูล CMS / แผนที่ / แจ้งเตือน]
--   rooms, announcements, promo_zones, item_shop_products, notifications, otp_codes
--   → rooms CASCADE จะลบ promo_zones, parcels ที่อ้าง room, announcements
--   → ลบแยก: item_shop_products, notifications, otp_codes
--
-- [ไม่ลบ]
--   admins       — ข้อมูลเข้าใช้งานแอดมิน (ล็อกอิน CMS)
--   ref_status   — ค่าอ้างอิงสถานะสำหรับแสดง label ใน UI (order, shop_verification, ...)
-- -----------------------------------------------------------------------------

-- (1) ลบข้อมูลผู้ใช้ทั้งหมด (รวมลงทะเบียนร้าน ร้าน คำสั่งซื้อ โปรไฟล์ ที่อยู่ กระเป๋า ยืนยันตัวตน รีวิว ติดตามร้าน ฯลฯ)
-- CASCADE จะลบ: profiles, addresses, wallets, parcels, shops, shop_registrations, shop_registration_contacts,
--   shop_contact_channels, shop_verification_documents, categories, products, product_categories, tags, product_tags,
--   orders, order_items, user_verification, user_balances, user_ad_credits, user_inventory, shop_follows, shop_reviews,
--   profile_contact_channels, announcements (อ้างอิง shops)
TRUNCATE users RESTART IDENTITY CASCADE;

-- (2) ลบข้อมูล CMS และที่เหลือ: ห้องแผนที่, สินค้า Item Shop, แจ้งเตือน, OTP สมัคร
-- rooms CASCADE → promo_zones, parcels (ที่อ้าง rooms), announcements (ที่อ้าง rooms)
TRUNCATE rooms, item_shop_products, notifications, otp_codes RESTART IDENTITY CASCADE;

-- ใส่ห้องเดียวกลับ (ชื่อว่าง แก้ไขได้ในระบบ)
INSERT INTO rooms (id, name) VALUES (1, '');
