import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUsers } from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const users = await getUsers();
    return NextResponse.json(users);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
