import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getAddressById, upsertAddressForUser, type AddressUpsertData } from "@/lib/api/dbStore";
import { query } from "@/lib/db";

/** ดึงที่อยู่หลักของผู้ใช้ (จาก profile.address_id) — ใช้ในหน้าลงทะเบียนร้านเลือก "ใช้ที่อยู่เดียวกับตอนสมัคร" */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const profileRes = await query<{ address_id: string | null }>(
      "SELECT address_id FROM profiles WHERE user_id = $1",
      [payload.sub]
    );
    const addressId = profileRes.rows[0]?.address_id ?? null;
    if (!addressId) {
      return NextResponse.json({ address: null });
    }
    const address = await getAddressById(addressId);
    return NextResponse.json({ address: address ?? null });
  } catch (e) {
    console.error("GET /api/data/me/address:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** สร้างหรืออัปเดตที่อยู่หลักของผู้ใช้ */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const data = buildAddressData(body);
    const address = await upsertAddressForUser(payload.sub, data);
    return NextResponse.json({ address });
  } catch (e) {
    console.error("POST /api/data/me/address:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** แก้ไขที่อยู่หลักของผู้ใช้ (partial update) */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const data = buildAddressData(body);
    const hasAnyField = Object.keys(data).length > 0;
    if (!hasAnyField) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องการอัปเดต" }, { status: 400 });
    }
    const address = await upsertAddressForUser(payload.sub, data);
    return NextResponse.json({ address });
  } catch (e) {
    console.error("PATCH /api/data/me/address:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** ลบที่อยู่หลักของผู้ใช้ (soft delete) */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const profileRes = await query<{ id: string; address_id: string | null }>(
      "SELECT id, address_id FROM profiles WHERE user_id = $1",
      [payload.sub]
    );
    const profile = profileRes.rows[0];
    if (!profile?.id || !profile.address_id) {
      return NextResponse.json({ success: true });
    }
    await query(
      "UPDATE addresses SET deleted_at = NOW(), is_default = false, updated_at = NOW() WHERE id = $1 AND user_id = $2",
      [profile.address_id, payload.sub]
    );
    await query(
      "UPDATE profiles SET address_id = NULL, updated_at = NOW() WHERE id = $1",
      [profile.id]
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/data/me/address:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function buildAddressData(body: Record<string, unknown>): AddressUpsertData {
  const data: AddressUpsertData = {};
  if (typeof body.full_address === "string") data.full_address = body.full_address;
  if (body.map_url !== undefined) data.map_url = toNullableString(body.map_url);
  if (body.recipient_name !== undefined) data.recipient_name = toNullableString(body.recipient_name);
  if (body.phone !== undefined) data.phone = toNullableString(body.phone);
  if (body.address_line1 !== undefined) data.address_line1 = toNullableString(body.address_line1);
  if (body.address_line2 !== undefined) data.address_line2 = toNullableString(body.address_line2);
  if (body.sub_district !== undefined) data.sub_district = toNullableString(body.sub_district);
  if (body.district !== undefined) data.district = toNullableString(body.district);
  if (body.province !== undefined) data.province = toNullableString(body.province);
  if (body.postal_code !== undefined) data.postal_code = toNullableString(body.postal_code);
  if (body.delivery_note !== undefined) data.delivery_note = toNullableString(body.delivery_note);
  return data;
}

function toNullableString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  return null;
}
