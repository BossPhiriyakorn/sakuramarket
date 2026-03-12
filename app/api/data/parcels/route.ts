import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getParcelsForRoom, getParcelsAllForAdmin, getBlockedSlotsForRoom, roomExists } from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    // แอปแผนที่เรียกด้วย roomId — ไม่ต้องเป็นแอดมิน; ส่ง blocked_slots (ช่องที่แอดมินปิดจอง) เสมอ
    if (roomId !== null && roomId !== "") {
      const rid = parseInt(roomId, 10);
      if (Number.isInteger(rid) && rid >= 1) {
        const exists = await roomExists(rid);
        if (exists) {
          const [parcels, blocked_slots] = await Promise.all([
            getParcelsForRoom(rid),
            getBlockedSlotsForRoom(rid),
          ]);
          return NextResponse.json(
            { parcels, blocked_slots },
            { headers: { "Cache-Control": "no-store, max-age=0" } }
          );
        }
        return NextResponse.json(
          { parcels: [], blocked_slots: [] },
          { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
      }
    }
    // รายการทั้งหมด (ไม่มี roomId) — เฉพาะแอดมิน
    const cookieStore = await cookies();
    const token = cookieStore.get(getAdminCookieName())?.value;
    const payload = await requireAdminPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
    }
    const parcels = await getParcelsAllForAdmin();
    return NextResponse.json({ parcels });
  } catch (e) {
    console.error("GET /api/data/parcels:", e);
    return NextResponse.json(
      { error: "โหลดข้อมูล parcels ไม่สำเร็จ", parcels: [], blocked_slots: [] },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
