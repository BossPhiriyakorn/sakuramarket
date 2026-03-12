import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getData, getNotificationsTodayCount } from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const store = await getData();
    const notificationsTodayCount = await getNotificationsTodayCount();
    return NextResponse.json({
      usersCount: store.users.length,
      shopRegistrationsCount: store.shopRegistrations.length,
      shopsCount: store.shops.length,
      verificationDocumentsCount: store.verificationDocuments.length,
      announcementsCount: store.announcements.length,
      ordersCount: store.orders.length,
      parcelsCount: store.parcels.length,
      notificationsTodayCount,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
