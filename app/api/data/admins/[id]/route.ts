import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { updateAdmin, deleteAdmin, getAdminById } from "@/lib/api/dbStore";
import { hashPassword, getAdminCookieName, requireAdminPayload } from "@/lib/auth";

async function checkAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await checkAdmin();
  if (unauth) return unauth;
  try {
    const { id } = await params;
    const body = await request.json();
    const first_name = typeof body.first_name === "string" ? body.first_name.trim() : undefined;
    const last_name = typeof body.last_name === "string" ? body.last_name.trim() : undefined;
    const display_name = typeof body.display_name === "string" ? body.display_name.trim() : undefined;
    let passwordHash: string | undefined;
    if (typeof body.newPassword === "string" && body.newPassword.length >= 6) {
      passwordHash = await hashPassword(body.newPassword);
    }
    const result = await updateAdmin(id, {
      first_name,
      last_name,
      display_name,
      passwordHash,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const admin = await getAdminById(id);
    if (!admin) return NextResponse.json({ error: "ไม่พบแอดมิน" }, { status: 404 });
    return NextResponse.json({
      admin: {
        id: admin.id,
        email: admin.email,
        first_name: admin.first_name,
        last_name: admin.last_name,
        display_name: admin.display_name,
        created_at: admin.created_at,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await checkAdmin();
  if (unauth) return unauth;
  try {
    const { id } = await params;
    const result = await deleteAdmin(id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
