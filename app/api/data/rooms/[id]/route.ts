import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { updateRoom } from "@/lib/api/dbStore";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const roomId = parseInt(id, 10);
    if (isNaN(roomId)) {
      return NextResponse.json({ error: "room id ไม่ถูกต้อง" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() || undefined : undefined;
    let background_url: string | null | undefined =
      body.background_url === null
        ? null
        : typeof body.background_url === "string"
          ? body.background_url.trim() || null
          : undefined;
    // ไม่บันทึก URL Drive ที่ตัดหรือไม่สมบูรณ์ (ไม่มี id=)
    if (
      typeof background_url === "string" &&
      background_url.includes("drive.google.com") &&
      !/[\?&]id=[^&]/.test(background_url) &&
      (background_url.includes("/uc?i") || background_url.includes("/uc?export"))
    ) {
      background_url = null;
    }
    const slot_price_per_day =
      typeof body.slot_price_per_day === "number"
        ? Math.max(0, body.slot_price_per_day)
        : typeof body.slot_price_per_day === "string"
          ? Math.max(0, parseFloat(body.slot_price_per_day) || 0)
          : undefined;
    const min_rent_days =
      typeof body.min_rent_days === "number"
        ? Math.max(1, Math.floor(body.min_rent_days))
        : typeof body.min_rent_days === "string"
          ? Math.max(1, Math.floor(parseInt(body.min_rent_days, 10) || 1))
          : undefined;

    await updateRoom(roomId, { name, background_url, slot_price_per_day, min_rent_days });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
