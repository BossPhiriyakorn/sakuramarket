import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getOrCreateDraftShopForUser, getCategoriesByShopId, updateCategory, deleteCategory } from "@/lib/api/dbStore";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const shop = await getOrCreateDraftShopForUser(payload.sub);
    if (!shop?.id) {
      return NextResponse.json({ error: "กรุณาลงทะเบียนร้านก่อน" }, { status: 400 });
    }
    const { id: categoryId } = await params;
    const categories = await getCategoriesByShopId(shop.id);
    const belongs = categories.some((c) => (c as { id: string }).id === categoryId);
    if (!belongs) {
      return NextResponse.json({ error: "ไม่พบหมวดหมู่นี้ในร้านของท่าน" }, { status: 404 });
    }
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "กรุณากรอกชื่อหมวดหมู่" }, { status: 400 });
    }
    const category = await updateCategory(categoryId, name);
    return NextResponse.json({ category });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const shop = await getOrCreateDraftShopForUser(payload.sub);
    if (!shop?.id) {
      return NextResponse.json({ error: "กรุณาลงทะเบียนร้านก่อน" }, { status: 400 });
    }
    const { id: categoryId } = await params;
    const categories = await getCategoriesByShopId(shop.id);
    const belongs = categories.some((c) => (c as { id: string }).id === categoryId);
    if (!belongs) {
      return NextResponse.json({ error: "ไม่พบหมวดหมู่นี้ในร้านของท่าน" }, { status: 404 });
    }
    await deleteCategory(categoryId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
