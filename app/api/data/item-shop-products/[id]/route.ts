import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getItemShopProductById,
  updateItemShopProduct,
  deleteItemShopProduct,
} from "@/lib/api/dbStore";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";

type ItemShopCategory = "frame" | "megaphone" | "board" | "other";

/** GET — แอปลูกค้าและ CMS ดูรายละเอียดได้ */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getItemShopProductById(id);
    if (!product) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });
    return NextResponse.json({ product });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** PATCH — เฉพาะแอดมิน */
export async function PATCH(
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
    const { id } = await params;
    const product = await getItemShopProductById(id);
    if (!product) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });

    const body = await request.json();
    const updates: Parameters<typeof updateItemShopProduct>[1] = {};
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (["frame", "megaphone", "board", "other"].includes(body.category)) updates.category = body.category as ItemShopCategory;
    if (typeof body.image_url === "string") updates.image_url = body.image_url.trim();
    if (typeof body.price === "number") updates.price = body.price;
    if (typeof body.price_unit === "string") updates.price_unit = body.price_unit.trim();
    if (body.status === "active" || body.status === "disabled") updates.status = body.status;
    if (typeof body.is_free === "boolean") updates.is_free = body.is_free;
    if (typeof body.allow_logo === "boolean") updates.allow_logo = body.allow_logo;
    if (["text_only", "text_link", "text_link_logo"].includes(String(body.board_format))) {
      updates.board_format = body.board_format as "text_only" | "text_link" | "text_link_logo";
      updates.allow_logo = body.board_format === "text_link_logo";
    }
    if (body.dimension_width_px != null) updates.dimension_width_px = Number(body.dimension_width_px);
    if (body.dimension_height_px != null) updates.dimension_height_px = Number(body.dimension_height_px);

    const updated = await updateItemShopProduct(id, updates);
    return NextResponse.json({ product: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** DELETE — เฉพาะแอดมิน */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const ok = await deleteItemShopProduct(id);
    if (!ok) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
