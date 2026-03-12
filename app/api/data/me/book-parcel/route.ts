import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { bookParcelForUser, roomExists } from "@/lib/api/dbStore";
import { checkRateLimit } from "@/lib/rateLimit";

/** จำกัด 1 ครั้งต่อนาที ต่อ user — ป้องกันกดจองซ้ำย้ำๆ */
const BOOK_PARCEL_MAX_PER_MINUTE = 1;

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
      "book-parcel",
      BOOK_PARCEL_MAX_PER_MINUTE
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "กรุณารอสักครู่ก่อนจองอีกครั้ง" },
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

    const result = await bookParcelForUser(payload.sub, roomId, slots);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ parcel: result.parcel, shop: result.shop });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
