import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bookParcel } from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

type Body = { registrationId: string; roomId: number; slots: { grid_x: number; grid_y: number }[] };

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as Body;
    const { registrationId, roomId, slots } = body;
    if (!registrationId || roomId == null || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: "ต้องส่ง registrationId, roomId และ slots" },
        { status: 400 }
      );
    }
    const adminId = payload?.sub && typeof payload.sub === "string" ? payload.sub : undefined;
    const result = await bookParcel(registrationId, roomId, slots, adminId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ parcel: result.parcel, shop: result.shop });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
