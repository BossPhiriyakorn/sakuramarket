/**
 * OTP ในหน่วยความจำ — ใช้สำหรับยืนยันอีเมลตอนสมัคร
 * ตั้งค่า OTP_* ใน .env
 */

const store = new Map<
  string,
  { code: string; expiresAt: number; attempts: number; lastSentAt: number }
>();

function getExpiryMinutes(): number {
  return Math.max(1, Number(process.env.OTP_EXPIRY_MINUTES) || 5);
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
export function createOtp(email: string): { code: string; cooldownUntil?: number } {
  const key = normalizeEmail(email);
  const now = Date.now();
  const cooldownMs = getCooldownMinutes() * 60 * 1000;
  const existing = store.get(key);
  
  console.log("[OTP] Creating OTP for:", key);
  
  if (existing && existing.lastSentAt + cooldownMs > now) {
    console.log("[OTP] ⏳ Cooldown active, returning existing OTP");
    return {
      code: "",
      cooldownUntil: existing.lastSentAt + cooldownMs,
    };
  }
  
  const code = generateCode();
  const expiryMinutes = getExpiryMinutes();
  const expiresAt = now + expiryMinutes * 60 * 1000;
  
  console.log("[OTP] ✅ Generated new OTP:", code);
  console.log("[OTP] Expires in:", expiryMinutes, "minutes");
  console.log("[OTP] Expires at:", new Date(expiresAt).toLocaleString());
  
  store.set(key, {
    code,
    expiresAt,
    attempts: 0,
    lastSentAt: now,
  });
  return { code };
}

/** ตรวจสอบ OTP — คืน true ถ้าถูกต้อง */
export function verifyOtp(email: string, code: string): boolean {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  
  console.log("[OTP] Verifying OTP for:", key);
  console.log("[OTP] Input code:", code.trim());
  console.log("[OTP] Entry exists:", !!entry);
  
  if (!entry) {
    console.log("[OTP] ❌ No OTP found for this email");
    return false;
  }
  
  const now = Date.now();
  const timeRemaining = Math.ceil((entry.expiresAt - now) / 1000);
  console.log("[OTP] Stored code:", entry.code);
  console.log("[OTP] Time remaining:", timeRemaining, "seconds");
  console.log("[OTP] Attempts:", entry.attempts, "/", getMaxAttempts());
  
  if (now > entry.expiresAt) {
    console.log("[OTP] ❌ OTP expired");
    store.delete(key);
    return false;
  }
  const maxAttempts = getMaxAttempts();
  if (entry.attempts >= maxAttempts) {
    console.log("[OTP] ❌ Max attempts exceeded");
    store.delete(key);
    return false;
  }
  entry.attempts += 1;
  
  const isMatch = entry.code === code.trim();
  console.log("[OTP] Code match:", isMatch);
  
  if (!isMatch) {
    console.log("[OTP] ❌ Code mismatch");
    return false;
  }
  
  console.log("[OTP] ✅ OTP verified successfully");
  store.delete(key);
  return true;
}

/** ลบ OTP ของอีเมลนี้ (หลังใช้แล้วหรือยกเลิก) */
export function clearOtp(email: string): void {
  store.delete(normalizeEmail(email));
}

/** ตรวจว่าเหลือเวลาคูลดาวน์กี่วินาที (0 = ขอ OTP ได้) */
export function getCooldownRemainingSeconds(email: string): number {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  if (!entry) return 0;
  const cooldownMs = getCooldownMinutes() * 60 * 1000;
  const end = entry.lastSentAt + cooldownMs;
  const remaining = Math.ceil((end - Date.now()) / 1000);
  return Math.max(0, remaining);
}

/** ตรวจสอบสถานะ OTP สำหรับ debug */
export function getOtpStatus(email: string): {
  exists: boolean;
  code?: string;
  expiresAt?: Date;
  timeRemainingSeconds?: number;
  attempts?: number;
  maxAttempts?: number;
} {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  
  if (!entry) {
    return { exists: false };
  }
  
  const now = Date.now();
  const timeRemaining = Math.ceil((entry.expiresAt - now) / 1000);
  
  return {
    exists: true,
    code: entry.code,
    expiresAt: new Date(entry.expiresAt),
    timeRemainingSeconds: Math.max(0, timeRemaining),
    attempts: entry.attempts,
    maxAttempts: getMaxAttempts(),
  };
}
