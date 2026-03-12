-- =============================================================================
-- ล้างเฉพาะข้อมูลผู้ใช้: บัญชีผู้ใช้ ลงทะเบียนร้าน ส่งเอกสาร จองล็อคในแผนที่ ฯลฯ
-- ไม่ลบ: ref_status, admins, rooms (ห้องและแผนที่), item_shop_products (CMS), notifications (CMS)
-- =============================================================================
-- รัน: node scripts/db-clear-users.js หรือ psql -f scripts/db-clear-users.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (1) ลบข้อมูลผู้ใช้ทั้งหมด (CASCADE ลบตารางที่อ้างอิง users)
-- -----------------------------------------------------------------------------
-- รวมถึง:
--   • บัญชี/โปรไฟล์: users, profiles, addresses, wallets, profile_contact_channels
--   • ยืนยันตัวตน/ส่งเอกสาร: user_verification, shop_verification_documents (ผ่าน shops)
--   • ลงทะเบียนร้าน/ร้าน: shop_registrations, shop_registration_contacts, shops,
--     shop_contact_channels, categories, products, product_categories, tags, product_tags
--   • จองล็อคในแผนที่: parcels (owner_id), shop_parcels, parcel_selection_hold, parcel_booking_draft
--   • คำสั่งซื้อ: orders, order_items
--   • อื่นๆ: user_balances, user_ad_credits, user_inventory, shop_follows, shop_reviews
--   • ประกาศที่อ้างร้าน: announcements (shop_id -> shops จะถูกลบตาม CASCADE)
-- -----------------------------------------------------------------------------
TRUNCATE users RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- (2) ลบ OTP สมัครสมาชิก/ลืมรหัส (ตารางไม่มี FK ไป users จึงลบแยก)
-- -----------------------------------------------------------------------------
TRUNCATE otp_codes;

-- -----------------------------------------------------------------------------
-- ไม่ลบ (เก็บไว้)
--   admins             — เข้าใช้งานแอดมิน CMS
--   ref_status         — ค่าอ้างอิงสถานะ (order, shop_verification, ...)
--   rooms              — ห้องแผนที่ (รวม room_blocked_slots, promo_zones)
--   item_shop_products  — สินค้า Item Shop (จัดการโดยแอดมิน)
--   notifications      — แจ้งเตือนแดชบอร์ด CMS
-- -----------------------------------------------------------------------------
