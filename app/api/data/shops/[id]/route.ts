import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getShopDetail } from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const detail = await getShopDetail(id);
    if (!detail.shop && !detail.reg) return NextResponse.json({ error: "ไม่พบร้านหรือการลงทะเบียน" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
