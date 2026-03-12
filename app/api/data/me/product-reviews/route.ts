import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { addProductReview, getUnreviewedReceivedItems } from "@/lib/api/dbStore";

/** รายการสินค้าที่รับแล้วและยังไม่ได้รีวิว (สำหรับแสดงปุ่มรีวิวในหน้า tracking) */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", items: [] }, { status: 401 });
    }
    const items = await getUnreviewedReceivedItems(payload.sub);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e), items: [] }, { status: 500 });
  }
}

/** เพิ่มรีวิวสินค้า (ต้องรับสินค้าแล้วเท่านั้น) */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const product_id = typeof body.product_id === "string" ? body.product_id.trim() : "";
    const order_item_id = typeof body.order_item_id === "string" ? body.order_item_id.trim() : "";
    const rating = typeof body.rating === "number" ? body.rating : Number(body.rating) || 5;
    const comment = typeof body.comment === "string" ? body.comment : "";
    if (!product_id || !order_item_id) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }
    const review = await addProductReview(payload.sub, { product_id, order_item_id, rating, comment });
    return NextResponse.json({ review });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isDuplicate = msg.includes("duplicate key") || msg.includes("unique");
    const isBusinessError =
      isDuplicate ||
      msg.includes("ข้อมูลไม่ครบถ้วน") ||
      msg.includes("ไม่พบ") ||
      msg.includes("ไม่ได้รับสินค้า");
    return NextResponse.json(
      { error: isDuplicate ? "คุณรีวิวสินค้านี้ไปแล้ว" : msg },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}
