import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { setUserAnnouncementLastRead } from "@/lib/api/dbStore";

/** POST — บันทึกว่าผู้ใช้เปิดประวัติประกาศแล้ว (จุดแดงหาย) */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    await setUserAnnouncementLastRead(payload.sub);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/data/me/announcements/mark-read:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
