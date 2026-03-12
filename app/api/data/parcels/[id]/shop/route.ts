import { NextResponse } from "next/server";
import {
  getShopByParcelId,
  getProductsByShopId,
  getCategoriesByShopId,
  getProductCategoryIds,
  getDisplayNameByUserId,
  getOwnerDisplayNameByParcelId,
  getContactChannelsByShopId,
  getOwnerLastSeenAtByParcelId,
} from "@/lib/api/dbStore";

/** สาธารณะ: โหลดร้าน + สินค้า + หมวดหมู่ ตาม parcel id (สำหรับหน้าร้าน /shop/[id]) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ไม่ระบุ parcel" }, { status: 400 });
    }
    const shop = await getShopByParcelId(id);
    if (!shop) {
      return NextResponse.json({ shop: null, products: [], categories: [] });
    }
    const shopId = (shop as { id: string }).id;
    const shopUserId = (shop as Record<string, unknown>).user_id as string | undefined;
    // ชื่อเจ้าของร้านมาจากตาราง profiles เท่านั้น: parcels.owner_id = profiles.user_id
    const [products, categories, categoryIdsMap, nameFromParcel, nameFromShop, contactChannels, ownerLastSeenAt] = await Promise.all([
      getProductsByShopId(shopId),
      getCategoriesByShopId(shopId),
      getProductCategoryIds(shopId),
      getOwnerDisplayNameByParcelId(id),
      shopUserId && String(shopUserId).trim() ? getDisplayNameByUserId(String(shopUserId).trim()) : Promise.resolve(null),
      getContactChannelsByShopId(shopId),
      getOwnerLastSeenAtByParcelId(id),
    ]);
    const ownerDisplayName = nameFromParcel ?? nameFromShop ?? null;
    const productsWithCategories = (products as Record<string, unknown>[]).map((p) => ({
      ...p,
      category_ids: categoryIdsMap.get((p.id as string) ?? "") ?? [],
    })) as Record<string, unknown>[];
    const visibleProducts = productsWithCategories.filter(
      (p) => (p.status as string) === "active" && ((p.stock_quantity as number) ?? 0) > 0
    );
    return NextResponse.json({
      shop,
      products: visibleProducts,
      categories,
      owner_display_name: ownerDisplayName ?? null,
      contact_channels: contactChannels,
      owner_last_seen_at: ownerLastSeenAt ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
