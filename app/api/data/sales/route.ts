import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const res = await query<{
      id: string;
      user_id: string;
      username: string;
      display_name: string | null;
      product_id: string;
      product_name: string;
      category: string;
      price_unit: string;
      purchased_at: string;
      expires_at: string | null;
      uses_left: number | null;
      status: string;
    }>(
      `SELECT ui.id, ui.user_id, u.username, p.display_name,
              ui.product_id, ui.product_name, ui.category, ui.price_unit,
              ui.purchased_at, ui.expires_at, ui.uses_left, ui.status
       FROM user_inventory ui
       JOIN users u ON u.id = ui.user_id
       LEFT JOIN profiles p ON p.user_id = ui.user_id
       ORDER BY ui.purchased_at DESC`
    );
    return NextResponse.json({ sales: res.rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
