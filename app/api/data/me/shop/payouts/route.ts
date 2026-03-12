import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getPayoutsByUserId } from "@/lib/api/dbStore";

/** GET — รายการรายได้ร้านของเจ้าของร้าน (สำหรับหน้า ตรวจสอบรายรับ) */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", payouts: [] }, { status: 401 });
    }
    const payouts = await getPayoutsByUserId(payload.sub);
    return NextResponse.json({ payouts });
  } catch (e) {
    console.error("GET /api/data/me/shop/payouts:", e);
    return NextResponse.json({ error: String(e), payouts: [] }, { status: 500 });
  }
}
