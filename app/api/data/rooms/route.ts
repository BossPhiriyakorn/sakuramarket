import { NextResponse } from "next/server";
import { getRooms } from "@/lib/api/dbStore";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

export async function GET() {
  try {
    const rooms = await getRooms();
    return NextResponse.json(rooms);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAdminCookieName())?.value;
    const payload = await requireAdminPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
    }

    const nextIdRes = await query<{ next_id: number }>(
      "SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM rooms"
    );
    const nextId = Number(nextIdRes.rows[0]?.next_id ?? 0);
    if (!Number.isFinite(nextId) || nextId <= 0 || nextId > 32767) {
      return NextResponse.json({ error: "ไม่สามารถสร้างห้องใหม่ได้" }, { status: 400 });
    }
    const name = `ห้อง ${nextId}`;
    const inserted = await query<{
      id: number;
      name: string;
      background_url: string | null;
      slot_price_per_day: string;
      min_rent_days: number;
    }>(
      `INSERT INTO rooms (id, name, background_url, slot_price_per_day, min_rent_days)
       VALUES ($1, $2, NULL, 0, 1)
       RETURNING id, name, background_url, COALESCE(slot_price_per_day, 0)::text AS slot_price_per_day, COALESCE(min_rent_days, 1) AS min_rent_days`,
      [nextId, name]
    );
    const row = inserted.rows[0];
    return NextResponse.json({
      room: {
        id: row.id,
        name: row.name,
        background_url: row.background_url,
        slot_price_per_day: Number(row.slot_price_per_day) || 0,
        min_rent_days: Number(row.min_rent_days) || 1,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
