import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import {
  updateShopByUserId,
  updateShopRegistrationByUserId,
  type ShopInfoUpdate,
} from "@/lib/api/dbStore";

/** อัปเดตข้อมูลร้าน (ชื่อ โลโก้ คัฟเวอร์ ฯลฯ) */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const data: ShopInfoUpdate = {};
    if (typeof body.shop_name === "string") data.shop_name = body.shop_name;
    if (typeof body.description === "string") data.description = body.description;
    if (body.logo_url !== undefined) data.logo_url = body.logo_url ?? null;
    if (body.logo_background_color !== undefined) data.logo_background_color = body.logo_background_color ?? null;
    if (body.cover_url !== undefined) data.cover_url = body.cover_url ?? null;
    if (body.market_display_url !== undefined) data.market_display_url = body.market_display_url ?? null;

    const [shopResult, regResult] = await Promise.all([
      updateShopByUserId(payload.sub, data),
      updateShopRegistrationByUserId(payload.sub, data),
    ]);

    if (!shopResult && !regResult) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่อัปเดต หรือยังไม่มีร้าน" }, { status: 400 });
    }
    return NextResponse.json({ shop: shopResult, registration: regResult });
  } catch (e) {
    console.error("PATCH /api/data/me/shop/info:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
