import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addParcelToShop } from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

type Body = { roomId: number; slots: { grid_x: number; grid_y: number }[] };

export async function POST(
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
    const { id: shopId } = await params;
    const body = (await request.json()) as Body;
    const { roomId, slots } = body;
    if (roomId == null || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: "ต้องส่ง roomId และ slots" },
        { status: 400 }
      );
    }
    const result = await addParcelToShop(shopId, roomId, slots);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ parcel: result.parcel, shop_id: result.shop_id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
