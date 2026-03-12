-- =============================================================================
-- ล้างข้อมูลการยืนยันตัวตนของผู้ใช้ (user_verification)
-- ใช้สำหรับทดสอบฟังก์ชันยืนยันตัวตนใหม่ โดยไม่ต้องสมัครผู้ใช้ใหม่
-- =============================================================================
-- รัน: psql -f scripts/db-clear-verification.sql หรือ execute ใน pgAdmin
-- หลังรัน: ทุก user จะอยู่ในสถานะยังไม่ยืนยัน/ไม่มีเอกสาร — สามารถอัปโหลดเอกสารและทดสอบ flow รอแอดมินอนุมัติได้ใหม่
-- =============================================================================

-- รีเซ็ต verified, verified_at (มีในทุก schema)
UPDATE user_verification
SET verified = false, verified_at = NULL;

-- รีเซ็ต status, document_url ถ้ามีคอลัมน์ (หลังรัน migration แล้ว)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_verification' AND column_name = 'status') THEN
    UPDATE user_verification SET status = 'pending';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_verification' AND column_name = 'document_url') THEN
    UPDATE user_verification SET document_url = NULL;
  END IF;
END $$;
