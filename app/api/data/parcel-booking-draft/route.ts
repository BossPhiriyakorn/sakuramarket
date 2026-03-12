import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import {
  getParcelBookingDraftsForRoom,
  upsertParcelBookingDraft,
  deleteParcelBookingDraft,
} from "@/lib/api/dbStore";

const DRAFT_EXPIRY_MINUTES = 5;

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    if (roomId == null) {
      return NextResponse.json({ error: "ต้องส่ง roomId" }, { status: 400 });
    }
    const rid = parseInt(roomId, 10);
    if (isNaN(rid)) {
      return NextResponse.json({ error: "roomId ไม่ถูกต้อง" }, { status: 400 });
    }
    const excludeAdminId = searchParams.get("excludeAdminId") ?? undefined;
    const drafts = await getParcelBookingDraftsForRoom(rid, excludeAdminId || undefined);
    return NextResponse.json({ drafts, currentAdminId: payload.sub });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload?.sub) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const roomId = typeof body.roomId === "number" ? body.roomId : parseInt(String(body.roomId ?? ""), 10);
    if (isNaN(roomId)) {
      return NextResponse.json({ error: "ต้องส่ง roomId" }, { status: 400 });
    }
    const slots = Array.isArray(body.slots)
      ? (body.slots as { grid_x: number; grid_y: number }[]).map((s) => ({
          grid_x: Number(s.grid_x),
          grid_y: Number(s.grid_y),
        }))
      : [];
    const expiresAt = new Date(Date.now() + DRAFT_EXPIRY_MINUTES * 60 * 1000);
    await upsertParcelBookingDraft(payload.sub, roomId, slots, expiresAt);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload?.sub) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    if (roomId == null) {
      return NextResponse.json({ error: "ต้องส่ง roomId" }, { status: 400 });
    }
    const rid = parseInt(roomId, 10);
    if (isNaN(rid)) {
      return NextResponse.json({ error: "roomId ไม่ถูกต้อง" }, { status: 400 });
    }
    await deleteParcelBookingDraft(payload.sub, rid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
