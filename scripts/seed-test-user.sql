-- Seed ผู้ใช้ทดสอบ (แยกจาก seed.sql — ไม่รันใน db-init)
-- รันเองเมื่อต้องการ: psql -U postgres -d sakuramarket -f scripts/seed-test-user.sql
--
-- สรุป: สร้าง/อัปเดต users + profiles (testuser, testuser1) และตั้งร้านของยูส test01 เป็นแพ็กฟรี
-- ป้องกันซ้ำ: INSERT ใช้ ON CONFLICT DO UPDATE
-- รหัสผ่านทั้งสองคน: test1234

-- ผู้ใช้ทดสอบ 1 — อีเมล: test@user.com
INSERT INTO users (username, password_hash, email)
VALUES (
  'testuser',
  '$2b$10$JiadopHUKzloxAUZC8UXaOqU.FAO7.dMnsUEXK3yAaz2PLQZsGUA.',
  'test@user.com'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  username = EXCLUDED.username,
  updated_at = now();

-- โปรไฟล์สำหรับผู้ใช้ทดสอบ 1
INSERT INTO profiles (user_id, display_name)
SELECT id, 'ผู้ใช้ทดสอบ' FROM users WHERE email = 'test@user.com'
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  updated_at = now();

-- ผู้ใช้ทดสอบ 2 — อีเมล: test1@user.com (รหัสผ่านเดียวกัน: test1234)
INSERT INTO users (username, password_hash, email)
VALUES (
  'testuser1',
  '$2b$10$JiadopHUKzloxAUZC8UXaOqU.FAO7.dMnsUEXK3yAaz2PLQZsGUA.',
  'test1@user.com'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  username = EXCLUDED.username,
  updated_at = now();

-- โปรไฟล์สำหรับผู้ใช้ทดสอบ 2
INSERT INTO profiles (user_id, display_name)
SELECT id, 'ผู้ใช้ทดสอบ 2' FROM users WHERE email = 'test1@user.com'
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  updated_at = now();

-- ตั้งร้านของยูส test01 เป็นแพ็กฟรีเท่านั้น (ถ้ามี user username = test01 และมีร้าน)
UPDATE shops SET membership_plan = 'free' WHERE user_id = (SELECT id FROM users WHERE username = 'test01' LIMIT 1);
