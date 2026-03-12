import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminsList, addAdmin } from "@/lib/api/dbStore";
import { hashPassword, getAdminCookieName, requireAdminPayload } from "@/lib/auth";

async function checkAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  return null;
}

export async function GET() {
  const unauth = await checkAdmin();
  if (unauth) return unauth;
  try {
    const list = await getAdminsList();
    return NextResponse.json({ admins: list });
  } catch (e) {
    console.error("GET /api/data/admins:", e);
    return NextResponse.json({ admins: [] });
  }
}

export async function POST(request: Request) {
  const unauth = await checkAdmin();
  if (unauth) return unauth;
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const first_name = typeof body.first_name === "string" ? body.first_name.trim() : "";
    const last_name = typeof body.last_name === "string" ? body.last_name.trim() : "";
    const display_name = typeof body.display_name === "string" ? body.display_name.trim() : "";

    if (!email) return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }
    const passwordHash = await hashPassword(password);
    const result = await addAdmin({
      email,
      passwordHash,
      first_name: first_name || undefined,
      last_name: last_name || undefined,
      display_name: display_name || undefined,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      admin: {
        id: result.id,
        email: result.email,
        first_name: result.first_name,
        last_name: result.last_name,
        display_name: result.display_name,
        created_at: result.created_at,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
