import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import {
  createOrder,
  getOrdersWithItemsForBuyer,
  getShopOwnerIdsByOrderId,
  getShopOwnersByShopIds,
  getWalletsByUserId,
  addUserNotification,
  type CreateOrderItem,
} from "@/lib/api/dbStore";
import { CHECKOUT_GAS_FEE } from "@/constants";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", orders: [] }, { status: 401 });
    }
    const { orders } = await getOrdersWithItemsForBuyer(payload.sub);
    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json({ error: String(e), orders: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "ไม่มีสินค้าในคำสั่งซื้อ" }, { status: 400 });
    }
    const items: CreateOrderItem[] = [];
    for (const raw of body.items) {
      if (!raw.shopId || !raw.productId || !raw.productName || typeof raw.price !== "number" || typeof raw.quantity !== "number") {
        return NextResponse.json({ error: "ข้อมูลสินค้าไม่ครบถ้วน" }, { status: 400 });
      }
      items.push({
        shopId: String(raw.shopId),
        productId: String(raw.productId),
        productName: String(raw.productName),
        productImageUrl: typeof raw.productImageUrl === "string" ? raw.productImageUrl : "",
        price: Number(raw.price),
        quantity: Number(raw.quantity),
      });
    }

    // ผู้ซื้อต้องผูกกระเป๋าก่อนจึงจะซื้อได้
    const buyerWallets = await getWalletsByUserId(payload.sub);
    if (buyerWallets.length === 0) {
      return NextResponse.json(
        { error: "กรุณาผูกกระเป๋าก่อนทำการซื้อ" },
        { status: 400 }
      );
    }

    // เจ้าของร้านทุกร้านในตะกร้าต้องผูกกระเป๋า จึงจะรับการชำระได้
    const shopIds = [...new Set(items.map((i) => i.shopId))];
    const shopOwners = await getShopOwnersByShopIds(shopIds);
    const ownersWithoutWallet: string[] = [];
    for (const so of shopOwners) {
      const ownerWallets = await getWalletsByUserId(so.user_id);
      if (ownerWallets.length === 0) ownersWithoutWallet.push(so.shop_name);
    }
    if (ownersWithoutWallet.length > 0) {
      return NextResponse.json(
        {
          error:
            ownersWithoutWallet.length === 1
              ? `ร้าน「${ownersWithoutWallet[0]}」ยังไม่ได้ผูกกระเป๋า จึงไม่สามารถรับการชำระเงินได้ กรุณาติดต่อร้านหรือเลือกซื้อร้านอื่น`
              : "ร้านบางร้านในตะกร้ายังไม่ได้ผูกกระเป๋า จึงไม่สามารถรับการชำระเงินได้ กรุณาติดต่อร้านหรือเลือกซื้อร้านอื่น",
        },
        { status: 400 }
      );
    }

    const subtotal = 0;
    const gas_fee = CHECKOUT_GAS_FEE;
    const total = 0;
    const order = await createOrder(payload.sub, { subtotal, gas_fee, total, items });
    const shopOwnerIds = await getShopOwnerIdsByOrderId(order.id);
    for (const ownerId of shopOwnerIds) {
      await addUserNotification(
        ownerId,
        "order_new",
        "คำสั่งซื้อใหม่",
        "มีคำสั่งซื้อใหม่ในร้านของคุณ — ไปที่เมนูคำสั่งซื้อเพื่อยืนยันและจัดส่ง",
        "/tracking?tab=sender",
        { orderId: order.id }
      ).catch((err) => console.error("addUserNotification order_new:", err));
    }
    await addUserNotification(
      payload.sub,
      "order_paid",
      "ชำระสินค้าแล้ว",
      "คุณชำระเงินแล้ว — รอร้านยืนยันและจัดส่ง ติดตามได้ที่เมนูติดตามสินค้า",
      "/tracking",
      { orderId: order.id }
    ).catch((err) => console.error("addUserNotification order_paid:", err));
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isBalance = msg.includes("เหรียญไม่เพียงพอ");
    return NextResponse.json({ error: msg }, { status: isBalance ? 402 : 500 });
  }
}
