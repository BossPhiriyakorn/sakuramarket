import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import {
  getFollowedShopsAndParcels,
  addShopFollow,
  removeShopFollow,
} from "@/lib/api/dbStore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json(
        { followedShopIds: [], followedParcelIds: [] },
        { status: 200 }
      );
    }
    const { shopIds, parcelIds } = await getFollowedShopsAndParcels(payload.sub);
    return NextResponse.json({ followedShopIds: shopIds, followedParcelIds: parcelIds });
  } catch (e) {
    return NextResponse.json({ error: String(e), followedShopIds: [], followedParcelIds: [] }, { status: 500 });
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
    const body = await request.json();
    const shop_id = typeof body.shop_id === "string" ? body.shop_id.trim() : "";
    if (!shop_id) {
      return NextResponse.json({ error: "ไม่ระบุร้านที่ต้องการติดตาม" }, { status: 400 });
    }
    await addShopFollow(payload.sub, shop_id);
    return NextResponse.json({ ok: true, followed: true });
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
    const shop_id =
      typeof request.nextUrl.searchParams.get("shop_id") === "string"
        ? request.nextUrl.searchParams.get("shop_id")!.trim()
        : (await request.json().catch(() => ({}))).shop_id;
    if (!shop_id) {
      return NextResponse.json({ error: "ไม่ระบุร้านที่ต้องการเลิกติดตาม" }, { status: 400 });
    }
    await removeShopFollow(payload.sub, shop_id);
    return NextResponse.json({ ok: true, followed: false });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
