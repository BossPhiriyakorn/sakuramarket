import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getShopByUserId, setShopVerificationStatus, insertShopVerificationDocument } from "@/lib/api/dbStore";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const shop = await getShopByUserId(payload.sub);
    if (!shop) {
      return NextResponse.json({ error: "ยังไม่มีร้านที่จองที่ — จองที่ก่อนแล้วจึงยืนยันร้านค้าได้" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const documentUrl = typeof body.document_url === "string" ? body.document_url.trim() : "";
    if (!documentUrl) {
      return NextResponse.json({ error: "กรุณาอัปโหลดเอกสารยืนยันร้านหรือระบุ URL" }, { status: 400 });
    }
    await insertShopVerificationDocument({ shop_id: shop.id, document_type: "business_registration", file_url: documentUrl });
    await setShopVerificationStatus(shop.id, "pending");
    return NextResponse.json({
      verification_status: "pending",
      message: "ส่งเอกสารยืนยันร้านค้าสำเร็จ — รอแอดมินตรวจสอบและอนุมัติ",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
