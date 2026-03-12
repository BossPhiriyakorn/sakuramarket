import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getOrderItemById, updateOrderItemShipping, addUserNotification } from "@/lib/api/dbStore";

/** ยืนยันออเดอร์ (ร้าน) / จัดส่ง + เลขติดตาม (ร้าน) / รับสินค้า + อัปโหลดหลักฐาน (ผู้ซื้อ) */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { id: itemId } = await params;
    const body = await _request.json().catch(() => ({}));
    const action = body.action as string;
    const tracking_number = typeof body.tracking_number === "string" ? body.tracking_number : undefined;
    const shipping_notes = typeof body.shipping_notes === "string" ? body.shipping_notes : undefined;
    const proof_url = typeof body.proof_url === "string" ? body.proof_url : undefined;

    const doc = await getOrderItemById(itemId);
    if (!doc) {
      return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
    }
    const orderUserId = doc.order.user_id as string;
    const shopUserId = doc.shop.user_id as string;
    const currentUserId = payload.sub;

    if (action === "confirm") {
      if (shopUserId !== currentUserId) {
        return NextResponse.json({ error: "เฉพาะร้านที่ขายเท่านั้นที่ยืนยันได้" }, { status: 403 });
      }
      const currentStatus = (doc.item.shipping_status as string) ?? "pending_confirmation";
      if (currentStatus !== "pending_confirmation") {
        return NextResponse.json({ error: "ยืนยันได้เฉพาะรายการที่รอยืนยัน" }, { status: 400 });
      }
      const updated = await updateOrderItemShipping(itemId, { shipping_status: "preparing" });
      await addUserNotification(
        orderUserId,
        "order_preparing",
        "กำลังจัดเตรียมสินค้า",
        "ร้านกำลังจัดเตรียมสินค้าของคุณ — ติดตามได้ที่เมนูติดตามสินค้า",
        "/tracking",
        { orderItemId: itemId }
      ).catch((err) => console.error("addUserNotification order_preparing:", err));
      return NextResponse.json({ item: updated });
    }

    if (action === "ship") {
      if (shopUserId !== currentUserId) {
        return NextResponse.json({ error: "เฉพาะร้านที่ขายเท่านั้นที่กดจัดส่งได้" }, { status: 403 });
      }
      const currentStatus = (doc.item.shipping_status as string) ?? "pending_confirmation";
      if (currentStatus !== "preparing") {
        return NextResponse.json({ error: "กดจัดส่งได้เฉพาะรายการที่เตรียมส่งแล้ว" }, { status: 400 });
      }
      const updated = await updateOrderItemShipping(itemId, {
        shipping_status: "shipped",
        tracking_number: tracking_number ?? (doc.item.tracking_number as string) ?? "",
        shipping_notes: shipping_notes ?? (doc.item.shipping_notes as string) ?? undefined,
      });
      await addUserNotification(
        orderUserId,
        "order_shipped",
        "กำลังจัดส่ง",
        "ร้านจัดส่งสินค้าแล้ว — เมื่อได้รับของแล้วกดรับสินค้าได้ที่เมนูติดตามสินค้า",
        "/tracking",
        { orderItemId: itemId, tracking_number: tracking_number ?? doc.item.tracking_number }
      ).catch((err) => console.error("addUserNotification order_shipped:", err));
      return NextResponse.json({ item: updated });
    }

    if (action === "receive") {
      if (orderUserId !== currentUserId) {
        return NextResponse.json({ error: "เฉพาะผู้ซื้อเท่านั้นที่กดรับสินค้าได้" }, { status: 403 });
      }
      const currentStatus = (doc.item.shipping_status as string) ?? "pending_confirmation";
      if (currentStatus !== "shipped") {
        return NextResponse.json({ error: "กดรับสินค้าได้เมื่อร้านจัดส่งแล้ว" }, { status: 400 });
      }
      const updated = await updateOrderItemShipping(itemId, {
        shipping_status: "received",
        proof_url: proof_url ?? (doc.item.proof_url as string) ?? undefined,
      });
      await addUserNotification(
        shopUserId,
        "order_received_seller",
        "ลูกค้ารับสินค้าแล้ว",
        "ลูกค้ากดรับสินค้าแล้ว — รายการจะเข้าสู่รายได้รอจ่าย ตรวจสอบได้ที่เมนูตรวจสอบรายรับ",
        "/tracking?tab=sender",
        { orderItemId: itemId }
      ).catch((err) => console.error("addUserNotification order_received_seller:", err));
      return NextResponse.json({ item: updated });
    }

    return NextResponse.json({ error: "action ไม่ถูกต้อง (confirm | ship | receive)" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
