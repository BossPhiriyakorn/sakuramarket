import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAnnouncementsForRoom, getAnnouncementsHistoryForRoom, roomExists } from "@/lib/api/dbStore";
import { query } from "@/lib/db";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const history = searchParams.get("history") === "1";
    // แอปแผนที่เรียกด้วย roomId — ไม่ต้องเป็นแอดมิน; คืน { announcements } เสมอเป็น JSON
    if (roomId !== null && roomId !== "") {
      const rid = parseInt(roomId, 10);
      if (Number.isInteger(rid) && rid >= 1) {
        const exists = await roomExists(rid);
        if (exists) {
          const announcements = history
            ? await getAnnouncementsHistoryForRoom(rid)
            : await getAnnouncementsForRoom(rid);
          return NextResponse.json({ announcements });
        }
        return NextResponse.json({ announcements: [] });
      }
    }
    // รายการทั้งหมด (ไม่มี roomId) — เฉพาะแอดมิน
    const cookieStore = await cookies();
    const token = cookieStore.get(getAdminCookieName())?.value;
    const payload = await requireAdminPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
    }
    const res = await query<{
      id: string;
      room_id: number;
      shop_name: string;
      message: string;
      created_at: string;
      expires_at: string | null;
      announcement_source: string | null;
    }>(
      "SELECT id, room_id, shop_name, message, created_at, expires_at, COALESCE(announcement_source, 'megaphone') AS announcement_source FROM announcements ORDER BY created_at DESC"
    );
    return NextResponse.json({ announcements: res.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message, announcements: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await requireAdmin();
    if (!payload) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const roomId = Number(body.room_id);
    const shopName = typeof body.shop_name === "string" ? body.shop_name.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const expiresAtRaw = typeof body.expires_at === "string" ? body.expires_at.trim() : "";
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    const sourceRaw = typeof body.announcement_source === "string" ? body.announcement_source.trim() : "";
    const announcementSource = sourceRaw === "board" ? "board" : "megaphone";
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return NextResponse.json({ error: "room_id ไม่ถูกต้อง" }, { status: 400 });
    }
    if (!shopName) {
      return NextResponse.json({ error: "กรุณากรอกชื่อร้าน" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "กรุณากรอกข้อความประกาศ" }, { status: 400 });
    }
    if (expiresAtRaw && Number.isNaN(expiresAt?.getTime())) {
      return NextResponse.json({ error: "เวลาสิ้นสุดไม่ถูกต้อง" }, { status: 400 });
    }

    const roomRes = await query<{ id: number }>("SELECT id FROM rooms WHERE id = $1", [roomId]);
    if (!roomRes.rows[0]) {
      return NextResponse.json({ error: "ไม่พบห้องที่เลือก" }, { status: 400 });
    }

    const inserted = await query<{
      id: string;
      room_id: number;
      shop_name: string;
      message: string;
      created_at: string;
      expires_at: string | null;
      announcement_source: string | null;
    }>(
      `INSERT INTO announcements (room_id, shop_id, shop_name, lock_label, message, link_url, logo_url, announcement_source, expires_at)
       VALUES ($1, NULL, $2, NULL, $3, NULL, NULL, $4, $5)
       RETURNING id, room_id, shop_name, message, created_at, expires_at, COALESCE(announcement_source, 'megaphone') AS announcement_source`,
      [roomId, shopName, message, announcementSource, expiresAt ? expiresAt.toISOString() : null]
    );

    return NextResponse.json({ announcement: inserted.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await requireAdmin();
    if (!payload) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const id = (searchParams.get("id") ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
    }
    const res = await query<{ id: string }>("DELETE FROM announcements WHERE id = $1 RETURNING id", [id]);
    if (!res.rows[0]) {
      return NextResponse.json({ error: "ไม่พบประกาศ" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await requireAdmin();
    if (!payload) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
    }
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.room_id !== undefined) {
      const roomId = Number(body.room_id);
      if (!Number.isFinite(roomId) || roomId <= 0) {
        return NextResponse.json({ error: "room_id ไม่ถูกต้อง" }, { status: 400 });
      }
      const roomRes = await query<{ id: number }>("SELECT id FROM rooms WHERE id = $1", [roomId]);
      if (!roomRes.rows[0]) {
        return NextResponse.json({ error: "ไม่พบห้องที่เลือก" }, { status: 400 });
      }
      updates.push(`room_id = $${idx++}`);
      values.push(roomId);
    }
    if (body.shop_name !== undefined) {
      const shopName = typeof body.shop_name === "string" ? body.shop_name.trim() : "";
      if (!shopName) return NextResponse.json({ error: "ชื่อร้านไม่ถูกต้อง" }, { status: 400 });
      updates.push(`shop_name = $${idx++}`);
      values.push(shopName);
    }
    if (body.message !== undefined) {
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) return NextResponse.json({ error: "ข้อความประกาศไม่ถูกต้อง" }, { status: 400 });
      updates.push(`message = $${idx++}`);
      values.push(message);
    }
    if (body.expires_at !== undefined) {
      if (body.expires_at === null || body.expires_at === "") {
        updates.push(`expires_at = NULL`);
      } else if (typeof body.expires_at === "string") {
        const expiresAt = new Date(body.expires_at);
        if (Number.isNaN(expiresAt.getTime())) {
          return NextResponse.json({ error: "เวลาสิ้นสุดไม่ถูกต้อง" }, { status: 400 });
        }
        updates.push(`expires_at = $${idx++}`);
        values.push(expiresAt.toISOString());
      } else {
        return NextResponse.json({ error: "เวลาสิ้นสุดไม่ถูกต้อง" }, { status: 400 });
      }
    }
    if (body.announcement_source !== undefined) {
      const src = typeof body.announcement_source === "string" ? body.announcement_source.trim() : "";
      if (src !== "megaphone" && src !== "board") {
        return NextResponse.json({ error: "announcement_source ต้องเป็น megaphone หรือ board" }, { status: 400 });
      }
      updates.push(`announcement_source = $${idx++}`);
      values.push(src);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องการแก้ไข" }, { status: 400 });
    }

    values.push(id);
    const updated = await query<{
      id: string;
      room_id: number;
      shop_name: string;
      message: string;
      created_at: string;
      expires_at: string | null;
      announcement_source: string | null;
    }>(
      `UPDATE announcements
       SET ${updates.join(", ")}
       WHERE id = $${idx}
       RETURNING id, room_id, shop_name, message, created_at, expires_at, COALESCE(announcement_source, 'megaphone') AS announcement_source`,
      values
    );
    if (!updated.rows[0]) {
      return NextResponse.json({ error: "ไม่พบประกาศ" }, { status: 404 });
    }
    return NextResponse.json({ announcement: updated.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  return requireAdminPayload(token);
}
