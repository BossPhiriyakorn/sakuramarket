import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getOrCreateDraftShopForUser, getRegistrationByUserId, getLockLabelsForShop, getPackagePlans, getShopParcelIds, getWalletsByUserId } from "@/lib/api/dbStore";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json(
        {
          error: "กรุณาเข้าสู่ระบบ",
          shop: null,
          registration: null,
          productCount: 0,
          lock_labels: [],
          package_plan_name: null,
          package_days_left: null,
          wallet_linked: false,
        },
        { status: 401 }
      );
    }
    const [shop, registration, planRows, userWallets] = await Promise.all([
      getOrCreateDraftShopForUser(payload.sub),
      getRegistrationByUserId(payload.sub),
      getPackagePlans().catch(() => [] as Awaited<ReturnType<typeof getPackagePlans>>),
      getWalletsByUserId(payload.sub).catch(() => []),
    ]);
    const wallet_linked = userWallets.length > 0;
    let shop_parcel_ids: string[] = [];
    let productCount = 0;
    let lock_labels: string[] = [];
    let package_plan_name: string | null = null;
    let package_days_left: number | null = null;
    let max_products_visible: number | null = null;
    let map_expansion_limit: number | null = null;
    let map_expansions_used: number = 0;
    if (shop?.id) {
      const countRes = await query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM products WHERE shop_id = $1",
        [shop.id]
      );
      productCount = parseInt(countRes.rows[0]?.count ?? "0", 10);
      try {
        lock_labels = await getLockLabelsForShop(shop.id);
      } catch {
        lock_labels = [];
      }
      try {
        shop_parcel_ids = await getShopParcelIds(shop.id);
      } catch {
        shop_parcel_ids = shop.parcel_id ? [shop.parcel_id] : [];
      }
      try {
        const usedRes = await query<{ count: string }>(
          "SELECT COUNT(*) AS count FROM shop_parcels WHERE shop_id = $1",
          [shop.id]
        );
        map_expansions_used = parseInt(usedRes.rows[0]?.count ?? "0", 10);
      } catch {
        map_expansions_used = 0;
      }
      if (shop.membership_plan) {
        const plan = planRows.find((p) => p.plan_key === shop.membership_plan);
        package_plan_name = plan?.name_th ?? shop.membership_plan;
        max_products_visible = plan?.max_products_visible ?? null;
        map_expansion_limit = plan?.map_expansion_limit ?? null;
        if (shop.membership_expires_at) {
          const exp = new Date(shop.membership_expires_at).getTime();
          const now = Date.now();
          package_days_left = exp > now ? Math.ceil((exp - now) / (24 * 60 * 60 * 1000)) : 0;
        }
      }
    }
    const shopWithParcelIds = shop ? { ...shop, shop_parcel_ids } : null;
    return NextResponse.json({ shop: shopWithParcelIds, registration, productCount, lock_labels, package_plan_name, package_days_left, max_products_visible, map_expansion_limit, map_expansions_used, wallet_linked });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
