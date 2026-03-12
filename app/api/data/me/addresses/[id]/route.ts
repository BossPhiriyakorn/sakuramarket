import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { query } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const addressRes = await query<{ id: string; is_default: boolean }>(
      "SELECT id, is_default FROM addresses WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
      [id, userId]
    );
    const existing = addressRes.rows[0];
    if (!existing) return NextResponse.json({ error: "ไม่พบที่อยู่" }, { status: 404 });

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const fields = [
      "full_address",
      "map_url",
      "recipient_name",
      "phone",
      "address_line1",
      "address_line2",
      "sub_district",
      "district",
      "province",
      "postal_code",
      "delivery_note",
      "country",
    ] as const;
    for (const key of fields) {
      if (body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(body[key] ?? null);
      }
    }
    const setDefault = body.is_default === true;
    if (setDefault) {
      await query("UPDATE addresses SET is_default = false, updated_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL", [userId]);
      updates.push(`is_default = true`);
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องการอัปเดต" }, { status: 400 });
    }
    values.push(id, userId);
    const updated = await query(
      `UPDATE addresses
       SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      values
    );
    const address = updated.rows[0];
    if (setDefault && address?.id) {
      await query("UPDATE profiles SET address_id = $1, updated_at = NOW() WHERE user_id = $2", [address.id, userId]);
    }
    return NextResponse.json({ address });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await params;
    const res = await query<{ id: string; is_default: boolean }>(
      "UPDATE addresses SET deleted_at = NOW(), is_default = false, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id, is_default",
      [id, userId]
    );
    if (!res.rows[0]) return NextResponse.json({ error: "ไม่พบที่อยู่" }, { status: 404 });

    const nextDefault = await query<{ id: string }>(
      "SELECT id FROM addresses WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1",
      [userId]
    );
    const nextId = nextDefault.rows[0]?.id ?? null;
    if (nextId) {
      await query("UPDATE addresses SET is_default = true, updated_at = NOW() WHERE id = $1", [nextId]);
    }
    await query("UPDATE profiles SET address_id = $1, updated_at = NOW() WHERE user_id = $2", [nextId, userId]);
    return NextResponse.json({ success: true, next_default_id: nextId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function requireUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAuthCookieName())?.value;
  const payload = await verifyToken(token ?? "");
  return payload?.sub ?? null;
}
