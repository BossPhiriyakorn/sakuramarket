import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import {
  getOrCreateDraftShopForUser,
  getProductsByShopId,
  getProductCategoryIds,
  updateProduct,
  deleteProduct,
} from "@/lib/api/dbStore";

async function getShopIdForUser(userId: string): Promise<string | null> {
  const shop = await getOrCreateDraftShopForUser(userId);
  return shop?.id ?? null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const shopId = await getShopIdForUser(payload.sub);
    if (!shopId) {
      return NextResponse.json(
        { error: "กรุณาลงทะเบียนร้านก่อน" },
        { status: 400 }
      );
    }
    const { id: productId } = await params;
    const products = await getProductsByShopId(shopId);
    const belongs = products.some((p) => (p as { id: string }).id === productId);
    if (!belongs) {
      return NextResponse.json({ error: "ไม่พบสินค้านี้ในร้านของท่าน" }, { status: 404 });
    }
    const body = await request.json();
    const data: Parameters<typeof updateProduct>[1] = {};
    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.price === "number") data.price = body.price;
    if (body.price !== undefined && typeof body.price !== "number") data.price = Number(body.price);
    if (typeof body.description === "string") data.description = body.description;
    if (typeof body.image_url === "string") data.image_url = body.image_url;
    if (typeof body.recommended === "boolean") data.recommended = body.recommended;
    if (typeof body.status === "string") data.status = body.status;
    if (body.stock_quantity !== undefined) {
      const q = typeof body.stock_quantity === "number" ? body.stock_quantity : Number(body.stock_quantity);
      data.stock_quantity = Number.isFinite(q) && q >= 0 ? q : 0;
    }
    if (Array.isArray(body.category_ids)) {
      const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      data.category_ids = body.category_ids.filter((id: string) => typeof id === "string" && id !== "cat-all" && uuidLike.test(id));
    }
    const product = await updateProduct(productId, data);
    const categoryIdsMap = await getProductCategoryIds(shopId);
    const category_ids = categoryIdsMap.get(productId) ?? [];
    return NextResponse.json({ product: { ...product, category_ids } });
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
    const shopId = await getShopIdForUser(payload.sub);
    if (!shopId) {
      return NextResponse.json(
        { error: "กรุณาลงทะเบียนร้านก่อน" },
        { status: 400 }
      );
    }
    const { id: productId } = await params;
    const products = await getProductsByShopId(shopId);
    const belongs = products.some((p) => (p as { id: string }).id === productId);
    if (!belongs) {
      return NextResponse.json({ error: "ไม่พบสินค้านี้ในร้านของท่าน" }, { status: 404 });
    }
    await deleteProduct(productId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
