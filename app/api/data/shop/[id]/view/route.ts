import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { recordShopView } from "@/lib/api/dbStore";

/** POST — บันทึกการเข้าชมร้าน (กดเข้าดูร้าน / ดูรายการสินค้า) — ไม่ต้องล็อกอิน */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shopId } = await params;
    if (!shopId) {
      return NextResponse.json({ error: "ไม่พบร้าน" }, { status: 400 });
    }
    const exists = await query<{ id: string }>("SELECT id FROM shops WHERE id = $1", [shopId]);
    if (!exists.rows[0]) {
      return NextResponse.json({ error: "ไม่พบร้าน" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const eventType = body.event_type === "product_list_view" ? "product_list_view" : "shop_view";
    const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 256) : null;
    await recordShopView(shopId, eventType, sessionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/data/shop/[id]/view:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
