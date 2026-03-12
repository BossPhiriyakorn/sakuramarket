import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getAdCreditsByUserId } from "@/lib/api/dbStore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ credits: 0, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    if (payload.role === "admin") {
      return NextResponse.json({ credits: 0 });
    }
    const credits = await getAdCreditsByUserId(payload.sub);
    return NextResponse.json({ credits });
  } catch (e) {
    console.error("GET /api/data/me/ad-credits:", e);
    return NextResponse.json({ credits: 0, error: "โหลดเครดิตโฆษณาไม่สำเร็จ" }, { status: 500 });
  }
}
