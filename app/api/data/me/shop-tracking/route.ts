import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getShopByUserId, getOrderItemsForShop } from "@/lib/api/dbStore";

/** ผู้ส่ง: รายการสั่งซื้อที่ร้านของฉันต้องจัดส่ง */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const shop = await getShopByUserId(payload.sub);
    if (!shop) {
      return NextResponse.json({ items: [], shop: null });
    }
    const items = await getOrderItemsForShop(shop.id);
    return NextResponse.json({ shop: { id: shop.id, shop_name: shop.shop_name }, items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
