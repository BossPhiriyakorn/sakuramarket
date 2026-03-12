import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { getBlockedSlotsForRoom, setBlockedSlotsForRoom, roomExists } from "@/lib/api/dbStore";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const roomId = parseInt(id, 10);
    if (!Number.isInteger(roomId) || roomId < 1 || !(await roomExists(roomId))) {
      return NextResponse.json({ error: "room id ไม่ถูกต้อง" }, { status: 400 });
    }
    const blocked_slots = await getBlockedSlotsForRoom(roomId);
    return NextResponse.json({ blocked_slots });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const roomId = parseInt(id, 10);
    if (!Number.isInteger(roomId) || roomId < 1 || !(await roomExists(roomId))) {
      return NextResponse.json({ error: "room id ไม่ถูกต้อง" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const raw = Array.isArray(body.slots) ? body.slots : [];
    const slots = raw
      .map((s: { grid_x?: number; grid_y?: number }) => ({
        grid_x: Number(s.grid_x ?? 0),
        grid_y: Number(s.grid_y ?? 0),
      }))
      .filter(
        (s: { grid_x: number; grid_y: number }) =>
          Number.isInteger(s.grid_x) &&
          Number.isInteger(s.grid_y) &&
          s.grid_x >= 0 &&
          s.grid_x < WORLD_WIDTH &&
          s.grid_y >= 0 &&
          s.grid_y < WORLD_HEIGHT
      );
    const slotMap = new Map<string, { grid_x: number; grid_y: number }>();
    for (const s of slots) slotMap.set(`${s.grid_x},${s.grid_y}`, s);
    const unique = Array.from(slotMap.values());
    await setBlockedSlotsForRoom(roomId, unique);
    return NextResponse.json({ success: true, blocked_slots: unique });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
