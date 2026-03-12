import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getOrCreateDraftShopForUser, getCategoriesByShopId, createCategory } from "@/lib/api/dbStore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", categories: [] }, { status: 401 });
    }
    const shop = await getOrCreateDraftShopForUser(payload.sub);
    if (!shop?.id) {
      return NextResponse.json({ categories: [] });
    }
    const categories = await getCategoriesByShopId(shop.id);
    return NextResponse.json({ categories });
  } catch (e) {
    return NextResponse.json({ error: String(e), categories: [] }, { status: 500 });
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
    const shop = await getOrCreateDraftShopForUser(payload.sub);
    if (!shop?.id) {
      return NextResponse.json(
        { error: "กรุณาลงทะเบียนร้านก่อนจึงจะเพิ่มหมวดหมู่ได้" },
        { status: 400 }
      );
    }
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "กรุณากรอกชื่อหมวดหมู่" }, { status: 400 });
    }
    const category = await createCategory(shop.id, name);
    return NextResponse.json({ category });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
