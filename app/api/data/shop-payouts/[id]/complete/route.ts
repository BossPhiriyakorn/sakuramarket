import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { completeShopPayout } from "@/lib/api/dbStore";

/** POST — แอดมิน: จ่ายให้ร้าน (อัปเดต payout เป็น completed + เพิ่ม balance ให้เจ้าของร้าน) */
export async function POST(
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
  if (!id) {
    return NextResponse.json({ error: "ไม่มี id" }, { status: 400 });
  }
  try {
    const result = await completeShopPayout(id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/data/shop-payouts/[id]/complete:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
