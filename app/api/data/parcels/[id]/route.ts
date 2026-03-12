import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

type ParcelRow = {
  id: string;
  room_id: number;
  grid_x: number;
  grid_y: number;
  width: number;
  height: number;
  title: string;
  description: string;
  image_url: string | null;
};

function intersects(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAdminCookieName())?.value;
    const payload = await requireAdminPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
    }

    const { id } = await params;
    const currentRes = await query<ParcelRow>(
      "SELECT id, room_id, grid_x, grid_y, width, height, title, description, image_url FROM parcels WHERE id = $1",
      [id]
    );
    const current = currentRes.rows[0];
    if (!current) {
      return NextResponse.json({ error: "ไม่พบ parcel" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const nextRoomId = body.room_id !== undefined ? Number(body.room_id) : current.room_id;
    const nextGridX = body.grid_x !== undefined ? Math.floor(Number(body.grid_x)) : current.grid_x;
    const nextGridY = body.grid_y !== undefined ? Math.floor(Number(body.grid_y)) : current.grid_y;
    const nextWidth = body.width !== undefined ? Math.max(1, Math.floor(Number(body.width))) : current.width;
    const nextHeight = body.height !== undefined ? Math.max(1, Math.floor(Number(body.height))) : current.height;
    const nextTitle = body.title !== undefined ? String(body.title ?? "").trim() : current.title;
    const nextDescription =
      body.description !== undefined ? String(body.description ?? "").trim() : current.description;
    const nextImageUrl =
      body.image_url !== undefined
        ? (body.image_url === null ? null : String(body.image_url).trim() || null)
        : current.image_url;

    if (!Number.isFinite(nextRoomId) || nextRoomId <= 0) {
      return NextResponse.json({ error: "room_id ไม่ถูกต้อง" }, { status: 400 });
    }
    if (!Number.isFinite(nextGridX) || !Number.isFinite(nextGridY)) {
      return NextResponse.json({ error: "พิกัด parcel ไม่ถูกต้อง" }, { status: 400 });
    }
    if (!nextTitle) {
      return NextResponse.json({ error: "title ห้ามว่าง" }, { status: 400 });
    }

    const roomRes = await query<{ id: number }>("SELECT id FROM rooms WHERE id = $1", [nextRoomId]);
    if (!roomRes.rows[0]) {
      return NextResponse.json({ error: "ไม่พบห้องที่เลือก" }, { status: 400 });
    }

    const othersRes = await query<{ id: string; grid_x: number; grid_y: number; width: number; height: number }>(
      "SELECT id, grid_x, grid_y, width, height FROM parcels WHERE room_id = $1 AND id != $2",
      [nextRoomId, id]
    );
    const nextRect = { x: nextGridX, y: nextGridY, w: nextWidth, h: nextHeight };
    for (const row of othersRes.rows) {
      const existsRect = { x: row.grid_x, y: row.grid_y, w: row.width, h: row.height };
      if (intersects(nextRect, existsRect)) {
        return NextResponse.json({ error: "ตำแหน่ง parcel ทับกับล็อคที่มีอยู่แล้ว" }, { status: 400 });
      }
    }

    const updated = await query<ParcelRow>(
      `UPDATE parcels
       SET room_id = $2,
           grid_x = $3,
           grid_y = $4,
           width = $5,
           height = $6,
           title = $7,
           description = $8,
           image_url = $9
       WHERE id = $1
       RETURNING id, room_id, grid_x, grid_y, width, height, title, description, image_url`,
      [id, nextRoomId, nextGridX, nextGridY, nextWidth, nextHeight, nextTitle, nextDescription, nextImageUrl]
    );

    return NextResponse.json({ parcel: updated.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
