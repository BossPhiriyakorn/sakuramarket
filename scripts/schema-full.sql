-- Sakura Market — Database Schema ตัวเต็ม (ไลฟ์ตัวเต็ม: ตาราง + Index + Seed บางส่วนในไฟล์นี้)
-- รัน: node scripts/db-init.js (โหลด schema-full.sql แล้ว seed.sql; แอดมินเพิ่มจาก CMS หรือ node scripts/seed-first-admin.js)
-- หรือรัน schema-full.sql อย่างเดียวใน pgAdmin/DBeaver/psql
--
-- สรุป — Seed ที่มีในไฟล์นี้ (ไม่รวมยูส test01 / แพ็กฟรีของ test01):
--   • ref_status      — label สถานะ (order, shop_verification, document, product_status, order_item_shipping ฯลฯ)
--   • ad_price_tiers  — ช่วงวันโฆษณา (7, 14, 30, 60, 90 วัน)
--   • ad_click_pricing — ค่าคลิกละกี่เหรียญ (id=1)
--   • package_plans   — แพ็กเกจ 3 แบบ (ฟรี/พื้นฐาน/โปร) พร้อม price_credits
-- ยูส test01 และการตั้งร้าน test01 เป็นแพ็กฟรี อยู่แยกใน scripts/seed-test-user.sql
--
-- ป้องกันสร้างซ้ำ (รันซ้ำได้โดยไม่ error):
--   • ตาราง: CREATE TABLE IF NOT EXISTS
--   • Index: CREATE INDEX IF NOT EXISTS
--   • ref_status:      INSERT ... ON CONFLICT (type, code) DO NOTHING
--   • ad_price_tiers:  INSERT ... ON CONFLICT (days) DO NOTHING
--   • ad_click_pricing: INSERT ... ON CONFLICT (id) DO NOTHING
--   • package_plans:   INSERT ... ON CONFLICT (plan_key) DO UPDATE SET ...
--   • คอลัมน์ order_items (จัดส่ง), announcements.expires_at, users.status: เพิ่มเฉพาะเมื่อยังไม่มี
-- [รายงาน] ใช้ node scripts/db-init.js จะแสดงว่าตารางไหนสร้างใหม่ / มีอยู่แล้ว

-- ==================== USERS & PROFILES ====================

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'บัญชีผู้ใช้ (login/auth) — username, email, password_hash สำหรับสมัครสมาชิก';

CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  email        TEXT,
  phone        TEXT,
  avatar_url   TEXT,
  date_of_birth DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'ข้อมูลส่วนตัว (หน้าจัดการโปรไฟล์) — ชื่อ สกุล เบอร์ เมล วันเกิด';

CREATE TABLE IF NOT EXISTS wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address    TEXT NOT NULL,
  chain      TEXT NOT NULL DEFAULT 'polygon',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, address, chain)
);

COMMENT ON TABLE wallets IS 'กระเป๋าที่ผูกกับบัญชี (สำหรับชำระเงิน)';

-- ==================== ADDRESSES ====================
CREATE TABLE IF NOT EXISTS addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_address    TEXT NOT NULL DEFAULT '',
  map_url         TEXT,
  recipient_name  TEXT,
  phone           TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  sub_district    TEXT,
  district        TEXT,
  province        TEXT,
  postal_code     TEXT,
  country         TEXT NOT NULL DEFAULT 'TH',
  address_type    TEXT,
  delivery_note   TEXT,
  latitude        NUMERIC(10, 7),
  longitude       NUMERIC(10, 7),
  is_default      BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE addresses IS 'ที่อยู่แบบละเอียด — แต่ละแถวผูก user_id (เจ้าของ), รองรับ E-commerce/Delivery';
COMMENT ON COLUMN addresses.user_id IS 'เจ้าของที่อยู่ (Foreign Key) — ใช้คิวรีที่อยู่ทั้งหมดของ user';
COMMENT ON COLUMN addresses.full_address IS 'ที่อยู่แบบเต็ม (ข้อความ หรือสรุป) วางลิงก์ Google Map ในช่องนี้หรือ map_url ได้';
COMMENT ON COLUMN addresses.map_url IS 'ลิงก์ Google Map (เช่น https://maps.app.goo.gl/...)';
COMMENT ON COLUMN addresses.recipient_name IS 'ชื่อผู้รับ (สำหรับจัดส่ง)';
COMMENT ON COLUMN addresses.phone IS 'เบอร์ติดต่อที่อยู่นี้';
COMMENT ON COLUMN addresses.address_line1 IS 'บ้านเลขที่ หมู่ที่';
COMMENT ON COLUMN addresses.address_line2 IS 'ซอย ถนน ชื่ออาคาร ชั้น หมายเลขห้อง';
COMMENT ON COLUMN addresses.sub_district IS 'ตำบล/แขวง';
COMMENT ON COLUMN addresses.district IS 'อำเภอ/เขต';
COMMENT ON COLUMN addresses.province IS 'จังหวัด';
COMMENT ON COLUMN addresses.postal_code IS 'รหัสไปรษณีย์';
COMMENT ON COLUMN addresses.address_type IS 'ป้ายกำกับ: บ้าน, ที่ทำงาน, ที่อยู่จัดส่ง, ที่อยู่ออกใบกำกับภาษี ฯลฯ';
COMMENT ON COLUMN addresses.delivery_note IS 'หมายเหตุจัดส่ง เช่น ฝากป้อมยาม โทรแจ้งก่อนมา';
COMMENT ON COLUMN addresses.latitude IS 'พิกัดละติจูด — สำหรับคำนวณระยะทางจัดส่ง';
COMMENT ON COLUMN addresses.longitude IS 'พิกัดลองจิจูด';
COMMENT ON COLUMN addresses.is_default IS 'ที่อยู่เริ่มต้น (ใช้ตอนสั่งซื้อโดยไม่เลือกที่อยู่)';
COMMENT ON COLUMN addresses.deleted_at IS 'Soft Delete — ไม่ลบ record จริง เพื่อไม่กระทบประวัติออเดอร์';

-- ==================== ROOMS & PARCELS ====================

CREATE TABLE IF NOT EXISTS rooms (
  id             SMALLINT PRIMARY KEY,
  name           TEXT,
  background_url TEXT
);
-- เพิ่ม column สำหรับ DB ที่มีอยู่แล้ว (idempotent)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS background_url TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS slot_price_per_day NUMERIC(10,2) DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS min_rent_days INT NOT NULL DEFAULT 1;

COMMENT ON TABLE rooms IS 'ห้องแผนที่ (1, 2)';
COMMENT ON COLUMN rooms.slot_price_per_day IS 'ราคาต่อช่องต่อวัน (เหรียญ) — ตั้งต้นในเมนูจัดการห้อง; คำนวณจริงในเมนูร้านค้าเมื่อลูกค้าเลือกวัน';
COMMENT ON COLUMN rooms.min_rent_days IS 'เช่าขั้นต่ำ (วัน) สำหรับห้องนี้';

CREATE TABLE IF NOT EXISTS parcels (
  id            TEXT PRIMARY KEY,
  room_id       SMALLINT NOT NULL REFERENCES rooms(id),
  owner_id      UUID NOT NULL REFERENCES users(id),
  grid_x        INT NOT NULL,
  grid_y        INT NOT NULL,
  width         INT NOT NULL,
  height        INT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  image_url     TEXT NOT NULL DEFAULT '',
  color         INT,
  is_label      BOOLEAN NOT NULL DEFAULT false,
  external_link TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE parcels IS 'ล็อคบนแผนที่ (โซนป้ายหรือร้าน)';

-- Draft การจองช่อง (แอดมินกำลังเลือกช่อง) — แสดงสีส้ม real-time ให้แอดมินอื่นเห็น
CREATE TABLE IF NOT EXISTS parcel_booking_draft (
  admin_id   UUID NOT NULL,
  room_id    SMALLINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  slots      JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (admin_id, room_id)
);
COMMENT ON TABLE parcel_booking_draft IS 'ช่องที่แอดมินกำลังเลือกอยู่ (แสดงสีส้มให้แอดมินอื่น) — ลบเมื่อบันทึกหรือยกเลิก';

-- ช่องที่ลูกค้ากำลังเลือก (real-time สีส้ม + ล้างทั้งหมดของตัวเอง)
CREATE TABLE IF NOT EXISTS parcel_selection_hold (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id    SMALLINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  slots      JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, room_id)
);
COMMENT ON TABLE parcel_selection_hold IS 'ช่องที่ลูกค้ากำลังเลือกอยู่ (แสดงสีส้มให้คนอื่นเห็น) — ล้างทั้งหมด = ลบแถวของ user ตัวเอง';

-- ล็อกระดับห้องเวลาจอง (กันการจองชน) — ใส่แถวต่อห้องจาก rooms
CREATE TABLE IF NOT EXISTS room_booking_lock (
  room_id SMALLINT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE
);
COMMENT ON TABLE room_booking_lock IS 'แถวเดียวต่อห้อง — SELECT FOR UPDATE ตอนจอง';

-- ช่องที่แอดมินปิดจอง — ห้ามลูกค้าหรือแอดมินจองช่องเหล่านี้
CREATE TABLE IF NOT EXISTS room_blocked_slots (
  room_id SMALLINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  grid_x  INT NOT NULL,
  grid_y  INT NOT NULL,
  PRIMARY KEY (room_id, grid_x, grid_y)
);
COMMENT ON TABLE room_blocked_slots IS 'ช่องที่แอดมินปิดจอง — ห้ามจอง (แสดงเป็นช่องปิดจองบนแผนที่)';

-- ==================== SHOPS (ต้องสร้างก่อน parcel_booking_audit เพราะ audit อ้างอิง shops) ====================

CREATE TABLE IF NOT EXISTS shops (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id                TEXT NOT NULL UNIQUE REFERENCES parcels(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name                TEXT NOT NULL,
  description              TEXT NOT NULL DEFAULT '',
  logo_url                 TEXT,
  logo_background_color    TEXT,
  cover_url                TEXT,
  market_display_url       TEXT,
  verification_status      TEXT NOT NULL DEFAULT 'none' CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected')),
  verified_at              TIMESTAMPTZ,
  verification_notes       TEXT,
  membership_plan          TEXT DEFAULT NULL CHECK (membership_plan IS NULL OR membership_plan IN ('free', 'basic', 'premium', 'recommended', 'pro')),
  membership_expires_at    TIMESTAMPTZ,
  payout_wallet_address    TEXT,
  payout_chain             TEXT DEFAULT 'polygon',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE shops IS 'ข้อมูลร้าน (ชื่อ โลโก้ คัฟเวอร์) ผูกกับ parcel — มีเมื่อเช่าที่แล้ว';
COMMENT ON COLUMN shops.verification_status IS 'สถานะยืนยันตัวตน: none | pending | verified | rejected';
COMMENT ON COLUMN shops.membership_plan IS 'แพ็กเกจสมาชิก: NULL = ยังไม่มีแพ็กเกจ | free | basic | premium | recommended | pro';
COMMENT ON COLUMN shops.payout_wallet_address IS 'ที่อยู่กระเป๋ารับเงินร้าน — null = ใช้กระเป๋าหลักของเจ้าของ';

-- ประวัติการจองล็อค (audit) — ลูกค้าหรือแอดมินจองสำเร็จ/ล้มเหลว
CREATE TABLE IF NOT EXISTS parcel_booking_audit (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_type       TEXT NOT NULL CHECK (actor_type IN ('user', 'admin')),
  actor_id         UUID NOT NULL,
  room_id          SMALLINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  parcel_id        TEXT,
  slots            JSONB NOT NULL DEFAULT '[]',
  slot_count       INT NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(14,2) NOT NULL DEFAULT 0,
  registration_id  UUID,
  shop_id          UUID REFERENCES shops(id) ON DELETE SET NULL,
  outcome          TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_parcel_booking_audit_created ON parcel_booking_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcel_booking_audit_actor ON parcel_booking_audit(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_parcel_booking_audit_room ON parcel_booking_audit(room_id);
CREATE INDEX IF NOT EXISTS idx_parcel_booking_audit_shop ON parcel_booking_audit(shop_id);
COMMENT ON TABLE parcel_booking_audit IS 'Audit log การจองล็อค — ใคร จองเมื่อไหร่ ห้อง/parcel ยอดจ่าย ผลลัพธ์';

-- ล็อคเพิ่มของร้าน (ร้านหนึ่งมีได้หลาย parcel — ล็อคหลักที่ shops.parcel_id ไม่ใส่ตรงนี้)
CREATE TABLE IF NOT EXISTS shop_parcels (
  shop_id   UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  parcel_id TEXT NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, parcel_id),
  UNIQUE (parcel_id)
);
COMMENT ON TABLE shop_parcels IS 'ล็อคเพิ่มของร้าน (ร้านหนึ่งมีได้หลาย parcel — ล็อคหลักที่ shops.parcel_id ไม่ใส่ตรงนี้)';

CREATE TABLE IF NOT EXISTS shop_contact_channels (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id  UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type     TEXT NOT NULL,
  value    TEXT NOT NULL DEFAULT '',
  label    TEXT,
  visible  BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE shop_contact_channels IS 'ช่องทางติดต่อร้าน (LINE, โทร, เว็บไซต์, เฟสบุค, ไอจี) — visible=false ไม่แสดงให้ผู้ใช้คนอื่น';

ALTER TABLE shop_contact_channels ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS shop_verification_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url     TEXT NOT NULL,
  file_name    TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at  TIMESTAMPTZ,
  review_notes TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE shop_verification_documents IS 'เอกสารยืนยันตัวตนร้าน (ทะเบียนพาณิชย์ บัตร ฯลฯ)';

-- ==================== SHOP REGISTRATIONS ====================

CREATE TABLE IF NOT EXISTS shop_registrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name             TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  logo_url              TEXT,
  logo_background_color TEXT DEFAULT '#ec4899',
  cover_url             TEXT,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_slot', 'approved', 'rejected')),
  shop_id               UUID REFERENCES shops(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE shop_registrations IS 'ลงทะเบียนร้าน (ข้อมูล+รูป) ก่อนเช่าที่ — draft → เช่าที่ → สร้าง shops';

CREATE TABLE IF NOT EXISTS shop_registration_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES shop_registrations(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  label       TEXT
);

COMMENT ON TABLE shop_registration_contacts IS 'ช่องทางติดต่อร้าน ตอนลงทะเบียน (LINE, โทร)';

-- เพิ่มคอลัมน์ที่อยู่ให้ profiles, shop_registrations, shops (รันซ้ำได้)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_id') THEN
    ALTER TABLE profiles ADD COLUMN address_id UUID REFERENCES addresses(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_registrations' AND column_name = 'use_same_as_user_address') THEN
    ALTER TABLE shop_registrations ADD COLUMN use_same_as_user_address BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_registrations' AND column_name = 'address_id') THEN
    ALTER TABLE shop_registrations ADD COLUMN address_id UUID REFERENCES addresses(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'use_same_as_user_address') THEN
    ALTER TABLE shops ADD COLUMN use_same_as_user_address BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'address_id') THEN
    ALTER TABLE shops ADD COLUMN address_id UUID REFERENCES addresses(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_addresses_country ON addresses(country);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_deleted_at ON addresses(deleted_at);

-- ==================== CATEGORIES & PRODUCTS ====================

CREATE TABLE IF NOT EXISTS categories (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name    TEXT NOT NULL
);

COMMENT ON TABLE categories IS 'หมวดหมู่สินค้า (shop_id null = หมวดร่วม)';

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL DEFAULT '',
  recommended BOOLEAN NOT NULL DEFAULT false,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'out_of_stock', 'discontinued')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE products IS 'สินค้าของร้าน — status: draft=แบบร่าง, active=ขายได้, out_of_stock=หมด, discontinued=เลิกขาย';
COMMENT ON COLUMN products.status IS 'สถานะสินค้า: draft | active | out_of_stock | discontinued';

CREATE TABLE IF NOT EXISTS product_categories (
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

COMMENT ON TABLE product_categories IS 'ความสัมพันธ์สินค้า–หมวด (หลายหมวดต่อสินค้า)';

CREATE TABLE IF NOT EXISTS tags (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name    TEXT NOT NULL
);

COMMENT ON TABLE tags IS 'แท็กสำหรับกรอง/ค้นหาสินค้า (shop_id = แท็กของร้าน, null = แท็กร่วม)';

CREATE TABLE IF NOT EXISTS product_tags (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

COMMENT ON TABLE product_tags IS 'ความสัมพันธ์สินค้า–แท็ก (หลายต่อหลาย)';

-- ==================== PROFILE CONTACTS ====================

CREATE TABLE IF NOT EXISTS profile_contact_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  label       TEXT
);

COMMENT ON TABLE profile_contact_channels IS 'ช่องทางติดต่อในโปรไฟล์';

-- ==================== ANNOUNCEMENTS ====================

CREATE TABLE IF NOT EXISTS announcements (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   SMALLINT NOT NULL REFERENCES rooms(id),
  shop_id   UUID REFERENCES shops(id) ON DELETE SET NULL,
  shop_name TEXT NOT NULL,
  lock_label TEXT,
  message   TEXT NOT NULL,
  link_url  TEXT,
  logo_url  TEXT,
  announcement_source TEXT DEFAULT 'megaphone' CHECK (announcement_source IN ('megaphone', 'board')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE announcements IS 'ข้อความโฆษณา/ประกาศ — แถบ Live เฉพาะ megaphone (ประกาศวิ่ง), ป้ายประกาศไม่แสดงใน Live';
COMMENT ON COLUMN announcements.link_url IS 'ลิงค์ (ป้ายประกาศแบบข้อความ+ลิงค์)';
COMMENT ON COLUMN announcements.logo_url IS 'URL โลโก้ร้าน (ป้ายประกาศแบบมีโลโก้)';

-- ==================== ORDERS ====================

CREATE TABLE IF NOT EXISTS orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending',
  subtotal              NUMERIC(14,2) NOT NULL,
  gas_fee               NUMERIC(14,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(14,2) NOT NULL,
  payer_wallet_address  TEXT,
  payer_chain           TEXT DEFAULT 'polygon',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE orders IS 'คำสั่งซื้อ (หัวข้อใบสั่ง)';
COMMENT ON COLUMN orders.payer_wallet_address IS 'กระเป๋าที่ลูกค้าใช้จ่าย (optional สำหรับ audit)';

CREATE TABLE IF NOT EXISTS order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shop_id           UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name      TEXT NOT NULL,
  product_image_url TEXT NOT NULL DEFAULT '',
  price             NUMERIC(12,2) NOT NULL,
  quantity          INT NOT NULL CHECK (quantity > 0),
  line_total        NUMERIC(14,2) NOT NULL,
  shipping_status   TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (shipping_status IN ('pending_confirmation', 'preparing', 'shipped', 'received')),
  tracking_number   TEXT,
  shipping_notes    TEXT,
  shipped_at        TIMESTAMPTZ,
  received_at       TIMESTAMPTZ,
  proof_url         TEXT
);

COMMENT ON TABLE order_items IS 'รายการในคำสั่งซื้อ แยกร้าน/สินค้า';

-- เพิ่มคอลัมน์จัดส่งถ้าตารางมีอยู่แล้ว (จาก schema เก่า)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'shipping_status') THEN
    ALTER TABLE order_items ADD COLUMN shipping_status TEXT NOT NULL DEFAULT 'pending_confirmation'
      CHECK (shipping_status IN ('pending_confirmation', 'preparing', 'shipped', 'received'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'tracking_number') THEN
    ALTER TABLE order_items ADD COLUMN tracking_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'shipped_at') THEN
    ALTER TABLE order_items ADD COLUMN shipped_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'received_at') THEN
    ALTER TABLE order_items ADD COLUMN received_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'proof_url') THEN
    ALTER TABLE order_items ADD COLUMN proof_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'shipping_notes') THEN
    ALTER TABLE order_items ADD COLUMN shipping_notes TEXT;
  END IF;
END $$;

COMMENT ON COLUMN order_items.shipping_status IS 'pending_confirmation | preparing | shipped | received';
COMMENT ON COLUMN order_items.tracking_number IS 'เลขติดตามพัสดุ หรือลิงค์ติดตาม';
COMMENT ON COLUMN order_items.proof_url IS 'รูปหลักฐานการรับสินค้า';
COMMENT ON COLUMN order_items.shipping_notes IS 'รายละเอียดการจัดส่งที่ผู้ส่งกรอก (ผู้รับดูและคัดลอกได้)';

-- รายการที่ต้องจ่ายจากการเช่าพื้นที่ (ใบแจ้งชำระ/ค่าธรรมเนียมร้าน)
CREATE TABLE IF NOT EXISTS parcel_rental_invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  due_date    DATE,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE parcel_rental_invoices IS 'รายการที่ต้องจ่ายจากการเช่าพื้นที่ (ค่าธรรมเนียมร้าน)';

-- รายได้ร้านจากคำสั่งซื้อ (เมื่อลูกค้ารับสินค้าแล้ว = received) — หนึ่งแถวต่อ order_item ที่ received
CREATE TABLE IF NOT EXISTS shop_payouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id     UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  paid_at           TIMESTAMPTZ,
  payout_method     TEXT,
  transaction_ref   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_payouts_shop ON shop_payouts(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_payouts_status ON shop_payouts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_payouts_order_item ON shop_payouts(order_item_id);
COMMENT ON TABLE shop_payouts IS 'รายได้ร้านจาก order_item ที่ลูกค้ารับแล้ว (received) — จ่ายแล้ว = status completed + paid_at';

-- รายได้แพลตฟอร์ม (Item Shop + แพ็กเกจ) — ยอดเข้าแอป ไม่โอนให้ร้าน
CREATE TABLE IF NOT EXISTS platform_revenue_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('item_shop', 'package')),
  amount     NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  product_id TEXT,
  product_name TEXT,
  plan_key   TEXT,
  quantity   INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_log_user ON platform_revenue_log(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_log_type ON platform_revenue_log(type);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_log_created ON platform_revenue_log(created_at DESC);
COMMENT ON TABLE platform_revenue_log IS 'รายได้แพลตฟอร์ม: Item Shop และการซื้อแพ็กเกจ — ไม่มี shop_payouts';

-- ==================== SHOP FOLLOWS & REVIEWS ====================

CREATE TABLE IF NOT EXISTS shop_follows (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, shop_id)
);

COMMENT ON TABLE shop_follows IS 'การติดตามร้านค้าที่สนใจ (user ติดตาม shop)';

CREATE TABLE IF NOT EXISTS shop_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE shop_reviews IS 'รีวิวร้านค้า (ดาว 1–5 + คอมเมนต์)';

-- ==================== PRODUCT REVIEWS ====================
-- รีวิวสินค้ารายชิ้น — ผูกกับ order_item เพื่อยืนยันว่าซื้อจริงและรับแล้ว
CREATE TABLE IF NOT EXISTS product_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment       TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_item_id)
);

COMMENT ON TABLE product_reviews IS 'รีวิวสินค้ารายชิ้น — ผูกกับ order_item (ต้องรับสินค้าแล้วถึงรีวิวได้, รีวิวได้ 1 ครั้งต่อ order_item)';
COMMENT ON COLUMN product_reviews.order_item_id IS 'FK ไปยัง order_items เพื่อยืนยันว่าผู้รีวิวซื้อจริงและ shipping_status=received';

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_parcels_room ON parcels(room_id);
CREATE INDEX IF NOT EXISTS idx_parcels_owner ON parcels(owner_id);
CREATE INDEX IF NOT EXISTS idx_room_blocked_slots_room ON room_blocked_slots(room_id);
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_tags_shop ON tags(shop_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_product ON product_tags(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_tag ON product_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_parcel_rental_invoices_user ON parcel_rental_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shop ON order_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_announcements_room ON announcements(room_id);
CREATE INDEX IF NOT EXISTS idx_announcements_room_created ON announcements(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_follows_user ON shop_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_follows_shop ON shop_follows(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_reviews_shop ON shop_reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_reviews_user ON shop_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_item ON product_reviews(order_item_id);
CREATE INDEX IF NOT EXISTS idx_shop_registrations_user ON shop_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_registration_contacts_reg ON shop_registration_contacts(registration_id);
CREATE INDEX IF NOT EXISTS idx_shop_verification_documents_shop ON shop_verification_documents(shop_id);
CREATE INDEX IF NOT EXISTS idx_shops_verification_status ON shops(verification_status);
CREATE INDEX IF NOT EXISTS idx_shops_membership_plan ON shops(membership_plan);
CREATE INDEX IF NOT EXISTS idx_shop_parcels_shop ON shop_parcels(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_parcels_parcel ON shop_parcels(parcel_id);

-- ==================== schema-additions ====================

-- ยืนยันตัวตนลูกค้า
CREATE TABLE IF NOT EXISTS user_verification (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verified   BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ
);
COMMENT ON TABLE user_verification IS 'สถานะยืนยันตัวตนลูกค้า (บัตรประชาชน ฯลฯ)';

-- เครดิตเหรียญในกระเป๋า
CREATE TABLE IF NOT EXISTS user_balances (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0)
);
COMMENT ON TABLE user_balances IS 'เครดิตเหรียญในกระเป๋าลูกค้า';

-- เครดิตโฆษณา (แยกจากเหรียญใช้จ่าย)
CREATE TABLE IF NOT EXISTS user_ad_credits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  credits NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credits >= 0)
);
COMMENT ON TABLE user_ad_credits IS 'เครดิตโฆษณาของผู้ใช้/ร้าน — ใช้เปิดแคมเปญโฆษณาเท่านั้น';

-- แอดมิน — เพิ่มจากเมนู จัดการแอดมิน ใน CMS หรือ node scripts/seed-first-admin.js
CREATE TABLE IF NOT EXISTS admins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE admins IS 'แอดมิน — เพิ่ม/แก้ไขจากเมนู จัดการแอดมิน ใน CMS';

-- Item Shop — สินค้า (กรอบ/โข่ง/ป้าย)
CREATE TABLE IF NOT EXISTS item_shop_products (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL CHECK (category IN ('frame', 'megaphone', 'board', 'other')),
  image_url          TEXT NOT NULL DEFAULT '',
  price              NUMERIC(12,2) NOT NULL,
  price_unit         TEXT NOT NULL DEFAULT 'เหรียญ',
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  is_free            BOOLEAN NOT NULL DEFAULT false,
  allow_logo         BOOLEAN NOT NULL DEFAULT false,
  board_format       TEXT NOT NULL DEFAULT 'text_link' CHECK (board_format IN ('text_only', 'text_link', 'text_link_logo')),
  dimension_width_px  INT,
  dimension_height_px INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE item_shop_products IS 'สินค้า Item Shop (กรอบ/โข่ง/ป้าย) สำหรับ CMS จัดการ';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'item_shop_products' AND column_name = 'is_free') THEN
    ALTER TABLE item_shop_products ADD COLUMN is_free BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
COMMENT ON COLUMN item_shop_products.is_free IS 'ติ๊กฟรี = รับได้โดยไม่เสียเหรียญ (เฉพาะโข่ง/ป้ายที่เปิดขาย)';

-- กระเป๋าเก็บของ (โข่ง/ป้ายที่ซื้อแล้ว)
CREATE TABLE IF NOT EXISTS user_inventory (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL REFERENCES item_shop_products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('megaphone', 'board')),
  image_url    TEXT NOT NULL DEFAULT '',
  price_unit   TEXT NOT NULL DEFAULT '',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  uses_left    INT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired'))
);
COMMENT ON TABLE user_inventory IS 'ของที่ซื้อจาก Item Shop เก็บในกระเป๋า (โข่ง/ป้าย)';
CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(user_id);

-- โซนป้าย/โปรโมท (CMS)
CREATE TABLE IF NOT EXISTS promo_zones (
  room_id   SMALLINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  zone_key  TEXT NOT NULL,
  is_label  BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  PRIMARY KEY (room_id, zone_key)
);
COMMENT ON TABLE promo_zones IS 'โซนป้าย/โปรโมทต่อห้อง (zone_key = parcel id หรือ cell:x,y)';

-- แจ้งเตือนแดชบอร์ด CMS
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta       JSONB
);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
COMMENT ON TABLE notifications IS 'แจ้งเตือนแดชบอร์ด CMS';

-- แจ้งเตือนต่อผู้ใช้ (ผู้ซื้อ/ผู้ขาย) — กระดิ่งในแอป
CREATE TABLE IF NOT EXISTS user_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  link_path  TEXT,
  link_meta  JSONB,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read_at ON user_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created ON user_notifications(user_id, created_at DESC);
COMMENT ON TABLE user_notifications IS 'แจ้งเตือนผู้ใช้ (คำสั่งซื้อใหม่, สถานะจัดส่ง, เงินเข้า, ซื้อไอเทม/แพ็กเกจ ฯลฯ) — กระดิ่งในแอป';

-- เก็บเวลาที่ผู้ใช้เข้าไปอ่านประวัติประกาศล่าสุด (สำหรับจุดแดงไอคอนประกาศ)
CREATE TABLE IF NOT EXISTS user_announcement_reads (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE user_announcement_reads IS 'เวลาที่ผู้ใช้เปิดประวัติประกาศล่าสุด — มีประกาศใหม่หลัง last_read_at = แสดงจุดแดง';

-- ==================== REF สถานะ (ตาราง + ข้อมูลรวมในไฟล์เดียว) ====================
-- ใช้แสดง label ใน UI (type/code ตรงกับ CHECK ในคอลัมน์ที่อ้างอิง)
CREATE TABLE IF NOT EXISTS ref_status (
  type    TEXT NOT NULL,
  code    TEXT NOT NULL,
  label_th TEXT NOT NULL,
  PRIMARY KEY (type, code)
);
COMMENT ON TABLE ref_status IS 'ค่าอ้างอิงสถานะสำหรับแสดง label (order, shop_verification, document, product_status, shop_registration, order_item_shipping)';

INSERT INTO ref_status (type, code, label_th) VALUES
  -- สถานะคำสั่งซื้อ (orders.status)
  ('order', 'pending', 'รอชำระ'),
  ('order', 'paid', 'ชำระแล้ว'),
  ('order', 'completed', 'เสร็จสิ้น'),
  ('order', 'cancelled', 'ยกเลิก'),
  -- สถานะยืนยันตัวตนร้าน (shops.verification_status)
  ('shop_verification', 'none', 'ยังไม่ส่ง'),
  ('shop_verification', 'pending', 'รอตรวจ'),
  ('shop_verification', 'verified', 'ยืนยันแล้ว'),
  ('shop_verification', 'rejected', 'ไม่อนุมัติ'),
  -- สถานะเอกสารยืนยัน (shop_verification_documents.status)
  ('document', 'pending', 'รอตรวจ'),
  ('document', 'approved', 'อนุมัติ'),
  ('document', 'rejected', 'ไม่อนุมัติ'),
  -- สถานะสินค้า (products.status)
  ('product_status', 'draft', 'แบบร่าง'),
  ('product_status', 'active', 'ขายได้'),
  ('product_status', 'out_of_stock', 'หมด'),
  ('product_status', 'discontinued', 'เลิกขาย'),
  -- สถานะลงทะเบียนร้าน (shop_registrations.status)
  ('shop_registration', 'draft', 'แบบร่าง'),
  ('shop_registration', 'pending_slot', 'รอช่อง'),
  ('shop_registration', 'approved', 'อนุมัติ'),
  ('shop_registration', 'rejected', 'ไม่อนุมัติ'),
  -- สถานะจัดส่งรายการสั่งซื้อ (order_items.shipping_status)
  ('order_item_shipping', 'pending_confirmation', 'รอยืนยันออเดอร์'),
  ('order_item_shipping', 'preparing', 'เตรียมจัดส่ง'),
  ('order_item_shipping', 'shipped', 'จัดส่ง'),
  ('order_item_shipping', 'received', 'ได้รับสินค้าแล้ว'),
  ('order_item_shipping', 'completed', 'สำเร็จ'),
  ('order_item_shipping', 'cancelled', 'ยกเลิก'),
  -- ประเภทแจ้งเตือนผู้ใช้ (user_notifications.type)
  ('user_notification', 'order_new', 'คำสั่งซื้อใหม่'),
  ('user_notification', 'order_paid', 'ชำระสินค้าแล้ว'),
  ('user_notification', 'order_preparing', 'กำลังจัดเตรียมสินค้า'),
  ('user_notification', 'order_shipped', 'กำลังจัดส่ง'),
  ('user_notification', 'order_received', 'ได้รับสินค้าแล้ว'),
  ('user_notification', 'order_received_seller', 'ลูกค้ารับสินค้าแล้ว'),
  ('user_notification', 'payout_completed', 'เงินเข้าแล้ว'),
  ('user_notification', 'item_shop_purchased', 'ซื้อไอเทมสำเร็จ'),
  ('user_notification', 'package_subscribed', 'ซื้อแพ็กเกจแล้ว')
ON CONFLICT (type, code) DO NOTHING;

-- announcements.expires_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE announcements ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- announcements.link_url, logo_url (ป้ายประกาศ: ข้อความ+ลิงค์ และแบบมีโลโก้)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'link_url') THEN
    ALTER TABLE announcements ADD COLUMN link_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'logo_url') THEN
    ALTER TABLE announcements ADD COLUMN logo_url TEXT;
  END IF;
END $$;

-- announcements.lock_label, announcement_source (ชื่อร้าน+ล็อค; Live เฉพาะ megaphone)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'lock_label') THEN
    ALTER TABLE announcements ADD COLUMN lock_label TEXT;
    COMMENT ON COLUMN announcements.lock_label IS 'ล็อคที่ร้านอยู่ (เช่น ห้อง1 (1,2))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'announcement_source') THEN
    ALTER TABLE announcements ADD COLUMN announcement_source TEXT DEFAULT 'megaphone';
    ALTER TABLE announcements ADD CONSTRAINT announcements_source_check CHECK (announcement_source IN ('megaphone', 'board'));
    COMMENT ON COLUMN announcements.announcement_source IS 'megaphone=แสดงในแถบ Live (ประกาศวิ่ง), board=ป้ายประกาศไม่แสดงใน Live';
  END IF;
END $$;

-- item_shop_products.allow_logo (ป้ายประกาศแบบใส่ได้แค่ตัวหนังสือ+ลิงค์ หรือแบบมีโลโก้)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'item_shop_products' AND column_name = 'allow_logo') THEN
    ALTER TABLE item_shop_products ADD COLUMN allow_logo BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- item_shop_products.board_format (รูปแบบป้ายประกาศ: ข้อความอย่างเดียว / +ลิงค์ / +โลโก้)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'item_shop_products' AND column_name = 'board_format') THEN
    ALTER TABLE item_shop_products ADD COLUMN board_format TEXT NOT NULL DEFAULT 'text_link';
    ALTER TABLE item_shop_products ADD CONSTRAINT item_shop_products_board_format_check
      CHECK (board_format IN ('text_only', 'text_link', 'text_link_logo'));
    UPDATE item_shop_products SET board_format = CASE WHEN allow_logo = true THEN 'text_link_logo' ELSE 'text_link' END WHERE category IN ('board', 'megaphone');
    COMMENT ON COLUMN item_shop_products.board_format IS 'รูปแบบป้าย/โข่ง: text_only=ข้อความอย่างเดียว, text_link=ข้อความ+ลิงค์, text_link_logo=ข้อความ+ลิงค์+โลโก้ร้าน';
  END IF;
END $$;

-- users.status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- users.terms_accepted_at / privacy_accepted_at (บันทึกเวลายอมรับข้อกำหนดและนโยบายความเป็นส่วนตัวตอนสมัคร)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'terms_accepted_at') THEN
    ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'privacy_accepted_at') THEN
    ALTER TABLE users ADD COLUMN privacy_accepted_at TIMESTAMPTZ;
  END IF;
END $$;

-- user_verification: สถานะรอแอดมินตรวจสอบ (pending) / ยืนยันแล้ว (verified) / ไม่อนุมัติ (rejected) + เก็บ URL เอกสาร
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_verification' AND column_name = 'status') THEN
    ALTER TABLE user_verification ADD COLUMN status TEXT DEFAULT 'pending';
    UPDATE user_verification SET status = 'verified' WHERE verified = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_verification' AND column_name = 'document_url') THEN
    ALTER TABLE user_verification ADD COLUMN document_url TEXT;
  END IF;
END $$;

-- shops: อนุญาต parcel_id เป็น NULL สำหรับร้านแบบร่าง (จัดการสินค้าได้ก่อนจองที่)
-- เมื่อแอดมินจองที่ให้ จะอัปเดตร้านร่างนี้ให้มี parcel_id แทนการสร้างร้านใหม่
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'parcel_id' AND is_nullable = 'NO') THEN
    ALTER TABLE shops ALTER COLUMN parcel_id DROP NOT NULL;
  END IF;
END $$;

-- products: จำนวนในคลัง + สถานะ hidden (ไม่แสดง)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock_quantity') THEN
    ALTER TABLE products ADD COLUMN stock_quantity INT NOT NULL DEFAULT 0;
    COMMENT ON COLUMN products.stock_quantity IS 'จำนวนสินค้าในคลัง — เมื่อขายจะหักอัตโนมัติ; เหลือ 0 จะเปลี่ยนเป็นไม่แสดง (out_of_stock)';
  END IF;
  -- เพิ่มค่า 'hidden' ใน status (แสดง/ไม่แสดงด้วยมือ)
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
  ALTER TABLE products ADD CONSTRAINT products_status_check CHECK (status IN ('draft', 'active', 'out_of_stock', 'discontinued', 'hidden'));
END $$;

-- ==================== OTP CODES ====================
-- ตาราง OTP ใช้ร่วมกัน: (1) ยืนยันอีเมลตอนสมัครสมาชิก (2) ยืนยันอีเมลตอนลืมรหัสผ่าน
-- เก็บใน database เพื่อไม่หายเมื่อเซิร์ฟเวอร์รีสตาร์ท และใช้ได้ทั้งสอง flow
CREATE TABLE IF NOT EXISTS otp_codes (
  email VARCHAR(255) PRIMARY KEY,
  code VARCHAR(8) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INT DEFAULT 0 NOT NULL,
  last_sent_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_codes(expires_at);

COMMENT ON TABLE otp_codes IS 'เก็บ OTP — ใช้สำหรับสมัครสมาชิกและลืมรหัสผ่าน (key = email)';
COMMENT ON COLUMN otp_codes.email IS 'อีเมลที่ขอ OTP (Primary Key)';
COMMENT ON COLUMN otp_codes.code IS 'รหัส OTP (6-8 หลัก)';
COMMENT ON COLUMN otp_codes.expires_at IS 'เวลาหมดอายุ OTP';
COMMENT ON COLUMN otp_codes.attempts IS 'จำนวนครั้งที่ลองใส่รหัส (เกินกำหนดจะถูกลบ)';
COMMENT ON COLUMN otp_codes.last_sent_at IS 'เวลาที่ส่ง OTP ล่าสุด (สำหรับ cooldown)';
COMMENT ON COLUMN otp_codes.created_at IS 'เวลาที่สร้าง OTP ครั้งแรก';

-- ==================== USER PRESENCE ====================
-- บันทึก last_seen_at ทุกครั้งที่ client ส่ง heartbeat (ทุก 30 วิ)
-- แยกตารางออกจาก users เพื่อป้องกัน lock contention บนตาราง users หลัก
CREATE TABLE IF NOT EXISTS user_presence (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen_at DESC);
COMMENT ON TABLE user_presence IS 'สถานะออนไลน์ล่าสุดของผู้ใช้ — อัปเดตทุก heartbeat (30 วิ) จาก client';

-- ==================== SHOP ADS & ANALYTICS ====================
-- โฆษณาร้าน: เลือกจำนวนวันและยอดจ่าย → ร้านอยู่บนรายการ; อนาเลติกส์ = การกดเข้าดูร้าน / ดูรายการสินค้า / จำนวนผู้เข้าชม
CREATE TABLE IF NOT EXISTS shop_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid >= 0),
  days        INT NOT NULL CHECK (days >= 1 AND days <= 365),
  start_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at      TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_ads_shop ON shop_ads(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_ads_end_at ON shop_ads(end_at DESC);
COMMENT ON TABLE shop_ads IS 'แคมเปญโฆษณาร้าน — จำนวนวันและยอดจ่าย; end_at = start_at + days';

CREATE TABLE IF NOT EXISTS shop_analytics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('shop_view', 'product_list_view')),
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_analytics_shop ON shop_analytics(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_analytics_created ON shop_analytics(shop_id, created_at DESC);
COMMENT ON TABLE shop_analytics IS 'บันทึกการเข้าชมร้าน — shop_view=กดเข้าดูร้าน, product_list_view=ดูรายการสินค้า; session_id สำหรับนับผู้เข้าชมไม่ซ้ำ';

CREATE TABLE IF NOT EXISTS product_analytics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_analytics_shop_product ON product_analytics(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_analytics_created ON product_analytics(shop_id, created_at DESC);
COMMENT ON TABLE product_analytics IS 'บันทึกการดูสินค้า — นับรายการสินค้าที่คนดูเยอะสุด';

-- ราคาโฆษณา (ขั้นต่ำ/เริ่มต้น) ต่อจำนวนวัน — จัดการใน CMS
CREATE TABLE IF NOT EXISTS ad_price_tiers (
  days       INT PRIMARY KEY CHECK (days >= 1 AND days <= 365),
  min_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_amount >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ad_price_tiers IS 'ราคาโฆษณา: ขั้นต่ำ (เหรียญ) ต่อจำนวนวัน — แอดมินตั้งใน CMS';

INSERT INTO ad_price_tiers (days, min_amount) VALUES (7, 0), (14, 0), (30, 0), (60, 0), (90, 0)
ON CONFLICT (days) DO NOTHING;

-- โฆษณาตามคลิก: คลิกละกี่เหรียญ (ตั้งใน CMS)
CREATE TABLE IF NOT EXISTS ad_click_pricing (
  id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  coins_per_click NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (coins_per_click >= 0),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO ad_click_pricing (id, coins_per_click) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;
COMMENT ON TABLE ad_click_pricing IS 'ราคาต่อคลิก (เหรียญ) สำหรับโฆษณาแบบจำนวนคลิก — แอดมินตั้งใน CMS';

-- shop_ads: รองรับโฆษณาตามวัน (days) และตามคลิก (clicks)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_ads' AND column_name = 'ad_type') THEN
    ALTER TABLE shop_ads ADD COLUMN ad_type TEXT NOT NULL DEFAULT 'days' CHECK (ad_type IN ('days', 'clicks'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_ads' AND column_name = 'clicks_purchased') THEN
    ALTER TABLE shop_ads ADD COLUMN clicks_purchased INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_ads' AND column_name = 'clicks_used') THEN
    ALTER TABLE shop_ads ADD COLUMN clicks_used INT NOT NULL DEFAULT 0;
  END IF;
  -- ผ่อนปรน days เป็น NULL ได้เมื่อ ad_type = 'clicks'
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_ads' AND column_name = 'days' AND is_nullable = 'NO') THEN
    ALTER TABLE shop_ads ALTER COLUMN days DROP NOT NULL;
  END IF;
END $$;
COMMENT ON COLUMN shop_ads.ad_type IS 'days=โฆษณาตามวัน, clicks=โฆษณาตามจำนวนคลิก';

-- ==================== แพ็กเกจสมาชิก (ฟรี / พื้นฐาน / โปร) ====================
CREATE TABLE IF NOT EXISTS package_plans (
  plan_key              TEXT PRIMARY KEY CHECK (plan_key IN ('free', 'basic', 'pro')),
  name_th               TEXT NOT NULL,
  duration_days         INT NOT NULL DEFAULT 7,
  max_categories        INT NOT NULL DEFAULT 3,
  max_products_visible  INT NOT NULL DEFAULT 10,
  map_expansion_limit   INT NOT NULL DEFAULT 0,
  ad_credits_granted    INT NOT NULL DEFAULT 0,
  sort_order            INT NOT NULL DEFAULT 0,
  price_credits         INT NOT NULL DEFAULT 0
);
COMMENT ON TABLE package_plans IS 'กำหนดสิทธิ์แต่ละแพ็กเกจ: ฟรี 7 วัน, พื้นฐาน 15 วัน, โปร 30 วัน';
COMMENT ON COLUMN package_plans.price_credits IS 'ราคาเป็นเหรียญ (0 = ฟรี) — ผู้ใช้ชำระเองได้';
INSERT INTO package_plans (plan_key, name_th, duration_days, max_categories, max_products_visible, map_expansion_limit, ad_credits_granted, sort_order, price_credits) VALUES
  ('free', 'ฟรี', 7, 3, 10, 0, 5, 0, 0),
  ('basic', 'พื้นฐาน', 15, 5, 10, 3, 15, 1, 50),
  ('pro', 'โปร', 30, 10, 999999, 5, 50, 2, 150)
ON CONFLICT (plan_key) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  duration_days = EXCLUDED.duration_days,
  max_categories = EXCLUDED.max_categories,
  max_products_visible = EXCLUDED.max_products_visible,
  map_expansion_limit = EXCLUDED.map_expansion_limit,
  ad_credits_granted = EXCLUDED.ad_credits_granted,
  sort_order = EXCLUDED.sort_order,
  price_credits = EXCLUDED.price_credits;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'map_expansions_used') THEN
    ALTER TABLE shops ADD COLUMN map_expansions_used INT NOT NULL DEFAULT 0;
  END IF;
END $$;
COMMENT ON COLUMN shops.map_expansions_used IS 'จำนวนครั้งที่ขยายล็อคในแผนที่แล้ว (เทียบกับ package_plans.map_expansion_limit)';

-- อนุญาตค่า membership_plan เป็น 'pro' และ NULL (ยังไม่มีแพ็กเกจ)
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_membership_plan_check;
ALTER TABLE shops ADD CONSTRAINT shops_membership_plan_check CHECK (membership_plan IS NULL OR membership_plan IN ('free', 'basic', 'premium', 'recommended', 'pro'));
COMMENT ON COLUMN shops.membership_plan IS 'แพ็กเกจ: NULL = ยังไม่มีแพ็กเกจ | free | basic | pro | premium | recommended';
