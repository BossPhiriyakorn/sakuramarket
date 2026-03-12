/**
 * OTP ใน Database (PostgreSQL) — แก้ปัญหา OTP หายเมื่อเซิร์ฟเวอร์รีสตาร์ท
 * ตั้งค่า OTP_* ใน .env
 */
import { query } from "./db";

function getExpiryMinutes(): number {
  return Math.max(1, Number(process.env.OTP_EXPIRY_MINUTES) || 10);
}

function getCooldownMinutes(): number {
  return Math.max(1, Number(process.env.OTP_COOLDOWN_MINUTES) || 5);
}

function getCodeLength(): number {
  return Math.min(8, Math.max(4, Number(process.env.OTP_CODE_LENGTH) || 6));
}

function getMaxAttempts(): number {
  return Math.max(3, Number(process.env.MAX_OTP_ATTEMPTS) || 5);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateCode(): string {
  const len = getCodeLength();
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < len; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

/** สร้างและเก็บ OTP สำหรับอีเมลนี้ คืนค่า code ที่สร้าง (สำหรับส่งอีเมล) */
export async function createOtp(email: string): Promise<{ code: string; cooldownUntil?: number }> {
  const key = normalizeEmail(email);
  const now = new Date();
  const cooldownMs = getCooldownMinutes() * 60 * 1000;

  console.log("[OTP-DB] Creating OTP for:", key);

  // ตรวจสอบ cooldown
  const existing = await query<{ last_sent_at: Date }>(
    "SELECT last_sent_at FROM otp_codes WHERE email = $1",
    [key]
  );

  if (existing.rows.length > 0) {
    const lastSentAt = new Date(existing.rows[0].last_sent_at).getTime();
    const cooldownEnd = lastSentAt + cooldownMs;
    
    if (cooldownEnd > now.getTime()) {
      console.log("[OTP-DB] ⏳ Cooldown active");
      return {
        code: "",
        cooldownUntil: cooldownEnd,
      };
    }
  }

  const code = generateCode();
  const expiryMinutes = getExpiryMinutes();
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

  console.log("[OTP-DB] ✅ Generated new OTP:", code);
  console.log("[OTP-DB] Expires in:", expiryMinutes, "minutes");
  console.log("[OTP-DB] Expires at:", expiresAt.toLocaleString());

  // บันทึกหรืออัปเดต OTP
  await query(
    `INSERT INTO otp_codes (email, code, expires_at, attempts, last_sent_at, created_at)
     VALUES ($1, $2, $3, 0, $4, $5)
     ON CONFLICT (email) 
     DO UPDATE SET 
       code = EXCLUDED.code,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       last_sent_at = EXCLUDED.last_sent_at`,
    [key, code, expiresAt, now, now]
  );

  return { code };
}

/**
 * ตรวจสอบ OTP — คืน true ถ้าถูกต้อง
 * @param consume ถ้า true (ค่าเริ่มต้น) จะลบ OTP หลังยืนยันสำเร็จ (ใช้แล้วหมด)
 *               ถ้า false จะไม่ลบ — ใช้กรณีสมัครสมาชิก เพื่อให้ลบ OTP เฉพาะเมื่อลงทะเบียนสำเร็จจริง
 */
export async function verifyOtp(
  email: string,
  code: string,
  options?: { consume?: boolean }
): Promise<boolean> {
  const consume = options?.consume !== false;
  const key = normalizeEmail(email);
  const now = new Date();

  console.log("[OTP-DB] Verifying OTP for:", key, "consume:", consume);

  const result = await query<{
    code: string;
    expires_at: Date;
    attempts: number;
  }>(
    "SELECT code, expires_at, attempts FROM otp_codes WHERE email = $1",
    [key]
  );

  if (result.rows.length === 0) {
    console.log("[OTP-DB] ❌ No OTP found for this email");
    return false;
  }

  const entry = result.rows[0];
  const expiresAt = new Date(entry.expires_at);

  if (now > expiresAt) {
    console.log("[OTP-DB] ❌ OTP expired");
    await query("DELETE FROM otp_codes WHERE email = $1", [key]);
    return false;
  }

  const maxAttempts = getMaxAttempts();
  if (entry.attempts >= maxAttempts) {
    console.log("[OTP-DB] ❌ Max attempts exceeded");
    await query("DELETE FROM otp_codes WHERE email = $1", [key]);
    return false;
  }

  await query(
    "UPDATE otp_codes SET attempts = attempts + 1 WHERE email = $1",
    [key]
  );

  const isMatch = entry.code === code.trim();
  if (!isMatch) {
    console.log("[OTP-DB] ❌ Code mismatch");
    return false;
  }

  console.log("[OTP-DB] ✅ OTP verified successfully");
  if (consume) {
    await query("DELETE FROM otp_codes WHERE email = $1", [key]);
  }
  return true;
}

/** ลบ OTP ของอีเมลนี้ (หลังใช้แล้วหรือยกเลิก) */
export async function clearOtp(email: string): Promise<void> {
  await query("DELETE FROM otp_codes WHERE email = $1", [normalizeEmail(email)]);
}

/** ตรวจว่าเหลือเวลาคูลดาวน์กี่วินาที (0 = ขอ OTP ได้) */
export async function getCooldownRemainingSeconds(email: string): Promise<number> {
  const key = normalizeEmail(email);
  const result = await query<{ last_sent_at: Date }>(
    "SELECT last_sent_at FROM otp_codes WHERE email = $1",
    [key]
  );

  if (result.rows.length === 0) return 0;

  const cooldownMs = getCooldownMinutes() * 60 * 1000;
  const lastSentAt = new Date(result.rows[0].last_sent_at).getTime();
  const end = lastSentAt + cooldownMs;
  const remaining = Math.ceil((end - Date.now()) / 1000);
  return Math.max(0, remaining);
}

/** ตรวจสอบสถานะ OTP สำหรับ debug */
export async function getOtpStatus(email: string): Promise<{
  exists: boolean;
  code?: string;
  expiresAt?: Date;
  timeRemainingSeconds?: number;
  attempts?: number;
  maxAttempts?: number;
}> {
  const key = normalizeEmail(email);
  const result = await query<{
    code: string;
    expires_at: Date;
    attempts: number;
  }>(
    "SELECT code, expires_at, attempts FROM otp_codes WHERE email = $1",
    [key]
  );

  if (result.rows.length === 0) {
    return { exists: false };
  }

  const entry = result.rows[0];
  const now = Date.now();
  const expiresAt = new Date(entry.expires_at);
  const timeRemaining = Math.ceil((expiresAt.getTime() - now) / 1000);

  return {
    exists: true,
    code: entry.code,
    expiresAt,
    timeRemainingSeconds: Math.max(0, timeRemaining),
    attempts: entry.attempts,
    maxAttempts: getMaxAttempts(),
  };
}

/** ลบ OTP ที่หมดอายุแล้วทั้งหมด (เรียกจาก cron job หรือเมื่อต้องการทำความสะอาด) */
export async function cleanupExpiredOtps(): Promise<number> {
  const result = await query(
    "DELETE FROM otp_codes WHERE expires_at < NOW()"
  );
  const count = result.rowCount || 0;
  if (count > 0) {
    console.log(`[OTP-DB] 🧹 Cleaned up ${count} expired OTP(s)`);
  }
  return count;
}
