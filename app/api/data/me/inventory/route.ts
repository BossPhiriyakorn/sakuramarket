import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getInventoryForUser, getItemShopProductById, addNotification, addUserNotification, getDisplayNameByUserId, purchaseInventoryItems } from "@/lib/api/dbStore";

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAuthCookieName())?.value;
  const payload = await verifyToken(token ?? "");
  return payload?.sub ?? null;
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", items: [] }, { status: 401 });
    }
    const items = await getInventoryForUser(userId);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e), items: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json();
    const productId = typeof body.product_id === "string" ? body.product_id.trim() : "";
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(body.quantity) || 1)));
    if (!productId) {
      return NextResponse.json({ error: "ไม่ระบุ product_id" }, { status: 400 });
    }
    const product = await getItemShopProductById(productId);
    if (!product) {
      return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });
    }
    if (product.status !== "active") {
      return NextResponse.json({ error: "สินค้านี้ปิดขายแล้ว" }, { status: 400 });
    }
    if (product.category !== "megaphone" && product.category !== "board") {
      return NextResponse.json({ error: "ซื้อได้เฉพาะโข่งประกาศหรือป้ายประกาศ" }, { status: 400 });
    }
    const { items: rows, totalPrice } = await purchaseInventoryItems(userId, product, quantity);
    if (rows.length === 0) {
      return NextResponse.json({ error: "ไม่สามารถซื้อได้" }, { status: 400 });
    }
    const displayName = await getDisplayNameByUserId(userId);
    const priceLabel = totalPrice === 0 ? "ฟรี" : `${totalPrice} เหรียญ`;
    await addNotification(
      "purchase",
      "การซื้อของจากไอเทมช็อบ",
      `ผู้ใช้ ${displayName || userId} ซื้อ "${product.name}" x ${quantity} (${priceLabel})`,
      {
        user_id: userId,
        product_id: product.id,
        product_name: product.name,
        quantity,
        total_price: totalPrice,
        is_free: !!product.is_free,
      }
    );
    await addUserNotification(
      userId,
      "item_shop_purchased",
      "ซื้อไอเทมสำเร็จ",
      `คุณซื้อ "${product.name}" x ${quantity} แล้ว — ใช้ได้จากกระเป๋าในโปรไฟล์`,
      "/profile",
      { product_id: product.id, product_name: product.name, quantity }
    ).catch((err) => console.error("addUserNotification item_shop_purchased:", err));
    return NextResponse.json({ items: rows, count: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isBusinessError = msg.includes("เหรียญไม่เพียงพอ") || msg.includes("ไม่สามารถซื้อได้");
    return NextResponse.json({ error: msg }, { status: isBusinessError ? 400 : 500 });
  }
}
