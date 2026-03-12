import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { upsertUserPresence, getUserLastSeenAt } from "@/lib/api/dbStore";
import { query } from "@/lib/db";

/** ดึง last_seen_at ของผู้ใช้ล็อกอิน (สำหรับแสดงสถานะออนไลน์ในหน้าโปรไฟล์) */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ last_seen_at: null });
    }
    const lastSeenAt = await getUserLastSeenAt(payload.sub);
    return NextResponse.json({ last_seen_at: lastSeenAt });
  } catch {
    return NextResponse.json({ last_seen_at: null });
  }
}

/** Heartbeat — client เรียกทุก 30 วิเพื่ออัปเดต last_seen_at */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    const userCheck = await query<{ id: string }>("SELECT id FROM users WHERE id = $1 LIMIT 1", [payload.sub]);
    if (!userCheck.rows[0]) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    await upsertUserPresence(payload.sub);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
