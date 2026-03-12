import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { updateProfileByUserId, type ProfileUpdate } from "@/lib/api/dbStore";

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const data: ProfileUpdate = {};
    if (typeof body.first_name === "string") data.first_name = body.first_name;
    if (typeof body.last_name === "string") data.last_name = body.last_name;
    if (typeof body.email === "string") data.email = body.email;
    if (typeof body.phone === "string") data.phone = body.phone;
    if (typeof body.avatar_url === "string") data.avatar_url = body.avatar_url;
    const profile = await updateProfileByUserId(payload.sub, data);
    if (!profile) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่แก้ไข" }, { status: 400 });
    }
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
