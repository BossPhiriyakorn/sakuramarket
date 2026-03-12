/**
 * แอดมินอนุมัติ/ปฏิเสธการยืนยันตัวตนลูกค้า
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { setUserVerificationStatus } from "@/lib/api/dbStore";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  }
  const body = await _request.json().catch(() => ({}));
  const action = body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : null;
  if (!action) {
    return NextResponse.json({ error: "ส่ง action เป็น approve หรือ reject" }, { status: 400 });
  }
  try {
    await setUserVerificationStatus(id, action === "approve" ? "verified" : "rejected");
    return NextResponse.json({
      ok: true,
      status: action === "approve" ? "verified" : "rejected",
      message: action === "approve" ? "อนุมัติยืนยันตัวตนแล้ว" : "ปฏิเสธการยืนยันตัวตนแล้ว",
    });
  } catch (e) {
    console.error("PATCH user verification:", e);
    return NextResponse.json({ error: "ดำเนินการไม่สำเร็จ" }, { status: 500 });
  }
}
