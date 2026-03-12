import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getBalanceByUserId } from "@/lib/api/dbStore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ balance: 0, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    // บัญชีแอดมินไม่ใช้ user_balances — คืน 0 เสมอ
    if (payload.role === "admin") {
      return NextResponse.json({ balance: 0 });
    }
    const balance = await getBalanceByUserId(payload.sub);
    return NextResponse.json({ balance });
  } catch (e) {
    console.error("GET /api/data/me/balance:", e);
    return NextResponse.json({ balance: 0, error: "โหลดข้อมูลยอดเหรียญไม่สำเร็จ" }, { status: 500 });
  }
}
