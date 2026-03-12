import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getUnreadUserNotificationCount } from "@/lib/api/dbStore";

/** GET — จำนวนแจ้งเตือนที่ยังไม่อ่าน (สำหรับจุดแดงกระดิ่ง) */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ unreadCount: 0 });
    }
    const unreadCount = await getUnreadUserNotificationCount(payload.sub);
    return NextResponse.json({ unreadCount });
  } catch (_e) {
    return NextResponse.json({ unreadCount: 0 });
  }
}
