import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getNotifications, getNotificationsTodayCount, clearAllNotifications } from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const todayOnly = searchParams.get("todayOnly");
    if (todayOnly === "1" || todayOnly === "true") {
      const count = await getNotificationsTodayCount();
      return NextResponse.json({ count });
    }
    const list = await getNotifications();
    return NextResponse.json({ notifications: list });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** ล้างการแจ้งเตือนของ CMS ทั้งหมด — เฉพาะแอดมิน */
export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const deleted = await clearAllNotifications();
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
