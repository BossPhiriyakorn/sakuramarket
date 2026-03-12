import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { getParcelBookingAudit } from "@/lib/api/dbStore";

/** GET — เฉพาะแอดมิน: รายการ audit การจองล็อค (filter ได้) */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const actorType = searchParams.get("actorType") as "user" | "admin" | null;
    const actorId = searchParams.get("actorId") ?? undefined;
    const shopId = searchParams.get("shopId") ?? undefined;
    const fromDate = searchParams.get("fromDate") ?? undefined;
    const toDate = searchParams.get("toDate") ?? undefined;
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const list = await getParcelBookingAudit({
      room_id: roomId != null && roomId !== "" ? Number(roomId) : undefined,
      actor_type: actorType === "user" || actorType === "admin" ? actorType : undefined,
      actor_id: actorId,
      shop_id: shopId,
      from_date: fromDate,
      to_date: toDate,
      limit: limit != null ? parseInt(limit, 10) : undefined,
      offset: offset != null ? parseInt(offset, 10) : undefined,
    });
    return NextResponse.json({ items: list });
  } catch (e) {
    console.error("GET /api/data/parcel-booking-audit:", e);
    return NextResponse.json({ error: String(e), items: [] }, { status: 500 });
  }
}
