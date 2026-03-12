import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import {
  getParcelSelectionHoldsForRoom,
  upsertParcelSelectionHold,
  deleteParcelSelectionHold,
  getParcelGridRangesForRoom,
  getBlockedSlotsForRoom,
  roomExists,
} from "@/lib/api/dbStore";
import { checkRateLimit } from "@/lib/rateLimit";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/constants";

const HOLD_EXPIRY_MINUTES = 5;
const HOLD_UPDATE_MAX_PER_MINUTE = 30;

function buildOccupiedSet(
  ranges: { grid_x: number; grid_y: number; width: number; height: number }[]
): Set<string> {
  const set = new Set<string>();
  for (const r of ranges) {
    for (let dx = 0; dx < (r.width || 1); dx++) {
      for (let dy = 0; dy < (r.height || 1); dy++) {
        set.add(`${r.grid_x + dx},${r.grid_y + dy}`);
      }
    }
  }
  return set;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", otherSlots: [] }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const roomIdParam = searchParams.get("roomId");
    if (roomIdParam == null) {
      return NextResponse.json({ error: "ต้องส่ง roomId" }, { status: 400 });
    }
    const roomId = parseInt(roomIdParam, 10);
    if (!Number.isInteger(roomId) || roomId < 1 || !(await roomExists(roomId))) {
      return NextResponse.json({ error: "roomId ไม่ถูกต้อง" }, { status: 400 });
    }
    const holds = await getParcelSelectionHoldsForRoom(roomId, payload.sub);
    const otherSlots: { grid_x: number; grid_y: number }[] = [];
    for (const h of holds) {
      for (const s of h.slots) {
        otherSlots.push({ grid_x: s.grid_x, grid_y: s.grid_y });
      }
    }
    return NextResponse.json({ otherSlots });
  } catch (e) {
    return NextResponse.json({ error: String(e), otherSlots: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { allowed, resetInMs } = checkRateLimit(
      payload.sub,
      "parcel-hold",
      HOLD_UPDATE_MAX_PER_MINUTE
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "อัปเดตการเลือกบ่อยเกินไป กรุณารอสักครู่" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetInMs / 1000)) } }
      );
    }
    const body = await request.json().catch(() => ({}));
    const roomId = typeof body.roomId === "number" ? body.roomId : parseInt(String(body.roomId ?? ""), 10);
    if (!Number.isInteger(roomId) || roomId < 1 || !(await roomExists(roomId))) {
      return NextResponse.json({ error: "ต้องส่ง roomId ที่ถูกต้อง" }, { status: 400 });
    }
    const rawSlots = Array.isArray(body.slots) ? body.slots : [];
    const slots = rawSlots.map((s: { grid_x?: number; grid_y?: number }) => ({
      grid_x: Number(s.grid_x ?? 0),
      grid_y: Number(s.grid_y ?? 0),
    }));

    if (slots.length > 0) {
      for (const s of slots) {
        if (
          s.grid_x < 0 ||
          s.grid_x >= WORLD_WIDTH ||
          s.grid_y < 0 ||
          s.grid_y >= WORLD_HEIGHT
        ) {
          return NextResponse.json(
            { error: `ช่อง (${s.grid_x}, ${s.grid_y}) อยู่นอกแผนที่` },
            { status: 400 }
          );
        }
      }
      const ranges = await getParcelGridRangesForRoom(roomId);
      const blocked = await getBlockedSlotsForRoom(roomId);
      const rangesWithBlocked = [
        ...ranges,
        ...blocked.map((b) => ({ grid_x: b.grid_x, grid_y: b.grid_y, width: 1, height: 1 })),
      ];
      const occupied = buildOccupiedSet(rangesWithBlocked);
      for (const s of slots) {
        if (occupied.has(`${s.grid_x},${s.grid_y}`)) {
          return NextResponse.json(
            { error: `ช่อง (${s.grid_x}, ${s.grid_y}) ถูกจองแล้วหรือปิดจอง กรุณาเลือกช่องอื่น` },
            { status: 400 }
          );
        }
      }
    }

    const expiresAt = new Date(Date.now() + HOLD_EXPIRY_MINUTES * 60 * 1000);
    await upsertParcelSelectionHold(payload.sub, roomId, slots, expiresAt);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const roomIdParam = searchParams.get("roomId");
    if (roomIdParam == null) {
      return NextResponse.json({ error: "ต้องส่ง roomId" }, { status: 400 });
    }
    const roomId = parseInt(roomIdParam, 10);
    if (!Number.isInteger(roomId) || roomId < 1 || !(await roomExists(roomId))) {
      return NextResponse.json({ error: "roomId ไม่ถูกต้อง" }, { status: 400 });
    }
    await deleteParcelSelectionHold(payload.sub, roomId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
