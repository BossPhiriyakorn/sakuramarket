import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getItemShopProducts,
  createItemShopProduct,
} from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

type ItemShopCategory = "frame" | "megaphone" | "board" | "other";

/** GET — แอปลูกค้า (Item Shop) และ CMS ดูรายการได้ */
export async function GET() {
  try {
    const list = await getItemShopProducts();
    return NextResponse.json({ products: list });
  } catch (e) {
    console.error("GET /api/data/item-shop-products:", e);
    return NextResponse.json({ products: [] });
  }
}

/** POST — เฉพาะแอดมิน (เพิ่มสินค้า Item Shop) */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const category = body.category as ItemShopCategory | undefined;
    const image_url = typeof body.image_url === "string" ? body.image_url.trim() : "";
    const price = typeof body.price === "number" ? body.price : Number(body.price);
    const price_unit = typeof body.price_unit === "string" ? body.price_unit.trim() : "เหรียญ";
    const is_free = body.is_free === true;
    const allow_logo = body.allow_logo === true;
    const board_format = ["text_only", "text_link", "text_link_logo"].includes(String(body.board_format)) ? body.board_format : undefined;
    const dimension_width_px = body.dimension_width_px != null ? Number(body.dimension_width_px) : undefined;
    const dimension_height_px = body.dimension_height_px != null ? Number(body.dimension_height_px) : undefined;

    const validCategories: ItemShopCategory[] = ["frame", "megaphone", "board", "other"];
    if (!name || !category || !validCategories.includes(category)) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อและประเภทสินค้า (frame, megaphone, board, other)" },
        { status: 400 }
      );
    }
    if (!image_url) {
      return NextResponse.json({ error: "กรุณาอัปโหลดรูปหรือระบุ image_url" }, { status: 400 });
    }
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "ราคาต้องเป็นตัวเลขที่ไม่ติดลบ" }, { status: 400 });
    }

    const product = await createItemShopProduct({
      name,
      category: category as ItemShopCategory,
      image_url,
      price,
      price_unit,
      is_free,
      allow_logo: category === "board" || category === "megaphone" ? allow_logo : undefined,
      board_format: category === "board" || category === "megaphone" ? (board_format ?? "text_link") : undefined,
      dimension_width_px: category === "frame" ? (dimension_width_px ?? 200) : undefined,
      dimension_height_px: category === "frame" ? (dimension_height_px ?? 200) : undefined,
    });
    return NextResponse.json({ product });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
