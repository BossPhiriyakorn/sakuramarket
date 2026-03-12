import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { hasUnreadAnnouncementsForUser } from "@/lib/api/dbStore";

/** GET — มีประกาศใหม่ที่ยังไม่ได้อ่านหรือไม่ (สำหรับจุดแดงไอคอนประกาศ) */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ hasUnread: false });
    }
    const hasUnread = await hasUnreadAnnouncementsForUser(payload.sub);
    return NextResponse.json({ hasUnread });
  } catch (_e) {
    return NextResponse.json({ hasUnread: false });
  }
}
