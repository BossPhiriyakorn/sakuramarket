import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getShopContactsByUserId, replaceShopContactsByUserId } from "@/lib/api/dbStore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const channels = await getShopContactsByUserId(payload.sub);
    return NextResponse.json({ channels });
  } catch (e) {
    console.error("GET /api/data/me/shop/contacts:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const channels = Array.isArray(body.channels) ? body.channels : [];
    await replaceShopContactsByUserId(payload.sub, channels);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/data/me/shop/contacts:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
