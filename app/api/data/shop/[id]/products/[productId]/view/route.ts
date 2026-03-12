import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { recordProductView } from "@/lib/api/dbStore";

/** POST — บันทึกการดูสินค้า (สำหรับอนาเลติกส์รายการสินค้าที่คนดูเยอะสุด) — ไม่ต้องล็อกอิน */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { id: shopId, productId } = await params;
    if (!shopId || !productId) {
      return NextResponse.json({ error: "ไม่พบร้านหรือสินค้า" }, { status: 400 });
    }
    const productRow = await query<{ shop_id: string }>(
      "SELECT shop_id FROM products WHERE id = $1 AND shop_id = $2",
      [productId, shopId]
    );
    if (!productRow.rows[0]) {
      return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 256) : null;
    await recordProductView(shopId, productId, sessionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/data/shop/[id]/products/[productId]/view:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
