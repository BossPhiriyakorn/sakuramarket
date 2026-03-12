import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getPurchaseHistoryForUser } from "@/lib/api/dbStore";

/** ประวัติการซื้อจากแอป (Item Shop) ทั้งหมด ไม่ว่าจะฟรีหรือเสียเงิน */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", purchases: [] }, { status: 401 });
    }
    const purchases = await getPurchaseHistoryForUser(payload.sub);
    return NextResponse.json({ purchases });
  } catch (e) {
    return NextResponse.json({ error: String(e), purchases: [] }, { status: 500 });
  }
}
