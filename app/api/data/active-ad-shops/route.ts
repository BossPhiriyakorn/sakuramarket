import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { getShopsWithActiveAdForAdmin } from "@/lib/api/dbStore";

/** GET — รายการร้านที่เปิดโฆษณาอยู่ (แอดมินเท่านั้น) — สำหรับตารางใน CMS */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAdminCookieName())?.value;
    const payload = await requireAdminPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
    }
    const list = await getShopsWithActiveAdForAdmin();
    return NextResponse.json({ shops: list });
  } catch (e) {
    console.error("GET /api/data/active-ad-shops:", e);
    return NextResponse.json({ error: String(e), shops: [] }, { status: 500 });
  }
}
