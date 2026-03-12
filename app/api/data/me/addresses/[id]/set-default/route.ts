import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    const userId = payload?.sub ?? null;
    if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const { id } = await params;
    const check = await query<{ id: string }>(
      "SELECT id FROM addresses WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
      [id, userId]
    );
    if (!check.rows[0]) return NextResponse.json({ error: "ไม่พบที่อยู่" }, { status: 404 });

    await query("UPDATE addresses SET is_default = false, updated_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL", [userId]);
    await query("UPDATE addresses SET is_default = true, updated_at = NOW() WHERE id = $1 AND user_id = $2", [id, userId]);
    await query("UPDATE profiles SET address_id = $1, updated_at = NOW() WHERE user_id = $2", [id, userId]);
    return NextResponse.json({ success: true, default_id: id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
