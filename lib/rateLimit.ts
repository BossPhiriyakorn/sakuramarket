/**
 * Rate limit ต่อ user (in-memory) — ใช้กับ API จองล็อค / อัปเดต hold
 * หมายเหตุ: รีเซ็ตเมื่อ restart server; ถ้า deploy หลาย instance ควรใช้ Redis แทน
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

const WINDOW_MS = 60 * 1000; // 1 นาที

function getKey(userId: string, action: string): string {
  return `${action}:${userId}`;
}

/**
 * ตรวจว่า user เกินโควต้าหรือไม่
 * @param userId user id (หรือ ip ถ้าไม่มี user)
 * @param action ชื่อ action สำหรับแยกโควต้า (เช่น "book-parcel", "parcel-hold")
 * @param maxPerWindow จำนวนครั้งสูงสุดต่อ window (ต่อนาที)
 * @returns true = ผ่าน, false = เกินโควต้า
 */
export function checkRateLimit(
  userId: string,
  action: string,
  maxPerWindow: number
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const key = getKey(userId, action);
  let entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return { allowed: true, remaining: maxPerWindow - 1, resetInMs: WINDOW_MS };
  }

  entry.count += 1;
  const remaining = Math.max(0, maxPerWindow - entry.count);
  const allowed = entry.count <= maxPerWindow;
  return {
    allowed,
    remaining,
    resetInMs: Math.max(0, entry.resetAt - now),
  };
}

/** ล้าง entry เก่าที่หมด window แล้ว (เรียกเป็นระยะเพื่อไม่ให้ Map เต็ม) */
export function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) store.delete(key);
  }
}
