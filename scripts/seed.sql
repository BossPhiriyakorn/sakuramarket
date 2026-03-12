-- Sakura Market — Seed ตัวเต็ม (ไลฟ์) สำหรับข้อมูลอ้างอิงและแพ็กเกจ
-- รันอัตโนมัติเมื่อรัน node scripts/db-init.js (หลัง schema-full.sql)
--
-- สรุปเนื้อหาใน seed นี้:
--   • rooms          — ห้องแผนที่ (1 ห้อง, ชื่อว่าง)
--   • package_plans  — แพ็กเกจ 3 แบบ (ฟรี/พื้นฐาน/โปร) สำหรับ CMS
--   • ref_status     — label สถานะต่างๆ (คำสั่งซื้อ, ยืนยันตัวตน, สินค้า, จัดส่ง ฯลฯ)
--
-- ไม่รวมใน seed นี้:
--   • ยูส test01 / แพ็กฟรีของ test01 — อยู่แยกใน scripts/seed-test-user.sql (รันเองเมื่อต้องการ)
--
-- ป้องกันการสร้างซ้ำ: ทุก INSERT ใช้ ON CONFLICT (DO NOTHING หรือ DO UPDATE) ไม่สร้างรายการซ้ำ
-- ไม่ seed users, shops, parcels หรือข้อมูลปลอม

-- ห้องแผนที่ — สร้างห้องเดียว (ชื่อว่าง แก้ไขได้ในระบบ)
INSERT INTO rooms (id, name) VALUES (1, '')
ON CONFLICT (id) DO NOTHING;

-- แพ็กเกจสมาชิก (ฟรี/พื้นฐาน/โปร) — ให้ CMS แสดงรายการได้ (ไม่ใส่ price_credits เพื่อให้รันได้แม้ยังไม่รัน migration)
-- ราคาเหรียญตั้งได้ใน CMS หรือรัน scripts/migration-package-price-and-cms.sql
INSERT INTO package_plans (plan_key, name_th, duration_days, max_categories, max_products_visible, map_expansion_limit, ad_credits_granted, sort_order)
VALUES ('free', 'ฟรี', 7, 3, 10, 0, 5, 0), ('basic', 'พื้นฐาน', 15, 5, 10, 3, 15, 1), ('pro', 'โปร', 30, 10, 999999, 5, 50, 2)
ON CONFLICT (plan_key) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  duration_days = EXCLUDED.duration_days,
  max_categories = EXCLUDED.max_categories,
  max_products_visible = EXCLUDED.max_products_visible,
  map_expansion_limit = EXCLUDED.map_expansion_limit,
  ad_credits_granted = EXCLUDED.ad_credits_granted,
  sort_order = EXCLUDED.sort_order;

-- Ref สถานะ — แสดง label ใน UI เท่านั้น
INSERT INTO ref_status (type, code, label_th) VALUES
  -- สถานะคำสั่งซื้อ (orders.status)
  ('order', 'pending', 'รอชำระ'),
  ('order', 'paid', 'ชำระแล้ว'),
  ('order', 'completed', 'เสร็จสิ้น'),
  ('order', 'cancelled', 'ยกเลิก'),
  -- สถานะยืนยันตัวตนร้าน
  ('shop_verification', 'none', 'ยังไม่ส่ง'),
  ('shop_verification', 'pending', 'รอตรวจ'),
  ('shop_verification', 'verified', 'ยืนยันแล้ว'),
  ('shop_verification', 'rejected', 'ไม่อนุมัติ'),
  -- สถานะเอกสารยืนยัน
  ('document', 'pending', 'รอตรวจ'),
  ('document', 'approved', 'อนุมัติ'),
  ('document', 'rejected', 'ไม่อนุมัติ'),
  -- สถานะสินค้า
  ('product_status', 'draft', 'แบบร่าง'),
  ('product_status', 'active', 'ขายได้'),
  ('product_status', 'out_of_stock', 'หมด'),
  ('product_status', 'discontinued', 'เลิกขาย'),
  -- สถานะลงทะเบียนร้าน
  ('shop_registration', 'draft', 'แบบร่าง'),
  ('shop_registration', 'pending_slot', 'รอช่อง'),
  ('shop_registration', 'approved', 'อนุมัติ'),
  ('shop_registration', 'rejected', 'ไม่อนุมัติ'),
  -- สถานะจัดส่งรายการสั่งซื้อ (order_items.shipping_status)
  ('order_item_shipping', 'pending_confirmation', 'รอยืนยันออเดอร์'),
  ('order_item_shipping', 'preparing', 'เตรียมส่ง'),
  ('order_item_shipping', 'shipped', 'จัดส่งแล้ว'),
  ('order_item_shipping', 'received', 'รับแล้ว')
ON CONFLICT (type, code) DO NOTHING;
