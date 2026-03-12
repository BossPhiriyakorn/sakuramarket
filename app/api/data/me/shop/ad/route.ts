import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getShopByUserId, getShopAdAndAnalytics, createShopAd } from "@/lib/api/dbStore";
type CreateAdBody = { ad_type?: "clicks"; clicks_count?: number };

/** GET — ข้อมูลโฆษณา + อนาเลติกส์ของร้านฉัน */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const shop = await getShopByUserId(payload.sub);
    if (!shop?.id) {
      return NextResponse.json({ error: "ยังไม่มีร้านค้า", activeAd: null, totalAdSpend: 0, shop_views: 0, product_list_views: 0, total_visitors: 0, most_viewed_products: [] }, { status: 200 });
    }
    const data = await getShopAdAndAnalytics(shop.id);
    return NextResponse.json({
      ...data,
      most_viewed_products: data.most_viewed_products ?? [],
    });
  } catch (e) {
    console.error("GET /api/data/me/shop/ad:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** POST — เปิดใช้งานโฆษณา: แบบคลิกเท่านั้น (clicks_count) */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const shop = await getShopByUserId(payload.sub);
    if (!shop?.id) {
      return NextResponse.json({ error: "ยังไม่มีร้านค้า" }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as CreateAdBody;
    const clicksCount = Math.max(1, Math.min(99999, Math.floor(Number(body.clicks_count) || 1)));
    const result = await createShopAd(shop.id, payload.sub, { ad_type: "clicks", clicks_count: clicksCount });
    return NextResponse.json({ ok: true, id: result.id, end_at: result.end_at });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("POST /api/data/me/shop/ad:", e);
    const isBusinessError =
      msg.includes("เหรียญ") ||
      msg.includes("เครดิตโฆษณา") ||
      msg.includes("ยังไม่มีร้านค้า") ||
      msg.includes("ยอดขั้นต่ำ") ||
      msg.includes("ไม่มีสิทธิ์");
    return NextResponse.json({ error: msg }, { status: isBusinessError ? 400 : 500 });
  }
}
