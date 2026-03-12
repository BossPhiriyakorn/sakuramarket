import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getInventoryItemById, consumeInventoryItem } from "@/lib/api/dbStore";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { id } = await params;
    const item = await getInventoryItemById(id);
    if (!item) {
      return NextResponse.json({ error: "ไม่พบรายการในกระเป๋า" }, { status: 404 });
    }
    if (item.user_id !== payload.sub) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ใช้รายการนี้" }, { status: 403 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง (JSON)" }, { status: 400 });
    }
    const payloadBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message = typeof payloadBody.message === "string" ? payloadBody.message.trim() : "";
    const roomId = payloadBody.room_id != null ? Number(payloadBody.room_id) : 1;
    if (!Number.isInteger(roomId) || roomId <= 0) {
      return NextResponse.json({ error: "room_id ไม่ถูกต้อง" }, { status: 400 });
    }
    const linkUrl = typeof payloadBody.link_url === "string" ? payloadBody.link_url : undefined;
    const logoUrl = typeof payloadBody.logo_url === "string" ? payloadBody.logo_url : undefined;
    const result = await consumeInventoryItem(id, message, roomId, linkUrl, logoUrl);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "ใช้รายการไม่สำเร็จ" }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      announcement: result.announcement ?? undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
