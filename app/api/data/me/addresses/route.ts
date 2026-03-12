import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { getAddressesByUserId, type AddressUpsertData, upsertAddressForUser } from "@/lib/api/dbStore";

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const addresses = await getAddressesByUserId(userId);
    return NextResponse.json({ addresses });
  } catch (e) {
    return NextResponse.json({ error: String(e), addresses: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const setDefault = body.is_default === true;

    const data = buildAddressData(body);
    const hasAddressData =
      Boolean(data.full_address?.trim()) ||
      Boolean(data.map_url?.trim()) ||
      Boolean(data.address_line1?.trim()) ||
      Boolean(data.recipient_name?.trim()) ||
      Boolean(data.phone?.trim());
    if (!hasAddressData) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลที่อยู่" }, { status: 400 });
    }

    // ใช้ flow เดิมเมื่อยังไม่มีที่อยู่เลย
    const existing = await getAddressesByUserId(userId);
    if (existing.length === 0) {
      const address = await upsertAddressForUser(userId, data);
      return NextResponse.json({ address });
    }

    if (setDefault) {
      await query("UPDATE addresses SET is_default = false, updated_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL", [userId]);
    }
    const cols = [
      "user_id",
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
      "is_default",
    ];
    const values = [
      userId,
      data.full_address ?? "",
      data.map_url ?? null,
      data.recipient_name ?? null,
      data.phone ?? null,
      data.address_line1 ?? null,
      data.address_line2 ?? null,
      data.sub_district ?? null,
      data.district ?? null,
      data.province ?? null,
      data.postal_code ?? null,
      data.delivery_note ?? null,
      "TH",
      setDefault,
    ];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    const inserted = await query(
      `INSERT INTO addresses (${cols.join(", ")})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );
    const address = inserted.rows[0];
    if (setDefault && address?.id) {
      await query("UPDATE profiles SET address_id = $1, updated_at = NOW() WHERE user_id = $2", [address.id, userId]);
    }
    return NextResponse.json({ address });
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
