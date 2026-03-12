import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getOrCreateDraftShopForUser, getProductsByShopId, getProductCategoryIds, getProductStatsByShopId, createProduct } from "@/lib/api/dbStore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", products: [] }, { status: 401 });
    }
    const shop = await getOrCreateDraftShopForUser(payload.sub);
    if (!shop?.id) {
      return NextResponse.json({ products: [] });
    }
    const [products, categoryIdsMap, statsMap] = await Promise.all([
      getProductsByShopId(shop.id),
      getProductCategoryIds(shop.id),
      getProductStatsByShopId(shop.id),
    ]);
    const productsWithCategories = (products as Record<string, unknown>[]).map((p) => {
      const id = (p.id as string) ?? "";
      const stock = (p.stock_quantity as number) ?? 0;
      const status = stock === 0 && (p.status as string) === "active" ? "out_of_stock" : (p.status as string);
      const stats = statsMap[id] ?? { avg_rating: 0, review_count: 0, sold_count: 0 };
      return {
        ...p,
        status,
        category_ids: categoryIdsMap.get(id) ?? [],
        avg_rating: stats.avg_rating,
        review_count: stats.review_count,
        sold_count: stats.sold_count,
      };
    });
    return NextResponse.json({ products: productsWithCategories });
  } catch (e) {
    return NextResponse.json({ error: String(e), products: [] }, { status: 500 });
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
        { error: "กรุณาลงทะเบียนร้านก่อนจึงจะเพิ่มสินค้าได้" },
        { status: 400 }
      );
    }
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "กรุณากรอกชื่อสินค้า" }, { status: 400 });
    }
    const price = typeof body.price === "number" ? body.price : Number(body.price) || 0;
    const stockQuantity = typeof body.stock_quantity === "number" && body.stock_quantity >= 0 ? body.stock_quantity : Number(body.stock_quantity);
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const categoryIds = Array.isArray(body.category_ids)
      ? body.category_ids.filter((id: string) => typeof id === "string" && id !== "cat-all" && uuidLike.test(id))
      : [];
    const product = await createProduct(shop.id, {
      name,
      price,
      description: typeof body.description === "string" ? body.description : "",
      image_url: typeof body.image_url === "string" ? body.image_url : "",
      recommended: Boolean(body.recommended),
      status: typeof body.status === "string" ? body.status : "active",
      category_ids: categoryIds,
      stock_quantity: Number.isFinite(stockQuantity) && stockQuantity >= 0 ? stockQuantity : 0,
    });
    return NextResponse.json({ product });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
