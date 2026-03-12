import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPromoZonesByRoom, setPromoZones, roomExists } from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

async function checkAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  return null;
}

export async function GET() {
  const unauth = await checkAdmin();
  if (unauth) return unauth;
  try {
    const promoZonesByRoom = await getPromoZonesByRoom();
    return NextResponse.json({ promoZonesByRoom });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const unauth = await checkAdmin();
  if (unauth) return unauth;
  try {
    const body = await request.json();
    const roomId = Number(body?.roomId);
    const promos = body?.promos;
    if (!Number.isInteger(roomId) || roomId < 1 || !(await roomExists(roomId))) {
      return NextResponse.json({ error: "roomId ไม่ถูกต้อง" }, { status: 400 });
    }
    if (typeof promos !== "object" || promos === null) {
      return NextResponse.json({ error: "promos ต้องเป็น object" }, { status: 400 });
    }
    await setPromoZones(roomId, promos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
