import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import {
  getUserNotifications,
  getUnreadUserNotificationCount,
  markUserNotificationRead,
  markAllUserNotificationsRead,
} from "@/lib/api/dbStore";

/** GET — รายการแจ้งเตือน + จำนวนที่ยังไม่อ่าน */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", notifications: [], unreadCount: 0 }, { status: 401 });
    }
    const limit = Math.min(100, Math.max(10, Number(request.nextUrl.searchParams.get("limit")) || 50));
    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(payload.sub, limit),
      getUnreadUserNotificationCount(payload.sub),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (e) {
    console.error("GET /api/data/me/notifications:", e);
    return NextResponse.json({ error: String(e), notifications: [], unreadCount: 0 }, { status: 500 });
  }
}

/** POST — ทำเครื่องหมายว่าอ่านแล้ว (body: { id?: string } ถ้าไม่มี id = อ่านทั้งหมด) */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.trim() : undefined;
    if (id) {
      const ok = await markUserNotificationRead(id, payload.sub);
      return NextResponse.json({ ok, marked: ok ? 1 : 0 });
    }
    const marked = await markAllUserNotificationsRead(payload.sub);
    return NextResponse.json({ ok: true, marked });
  } catch (e) {
    console.error("POST /api/data/me/notifications:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
