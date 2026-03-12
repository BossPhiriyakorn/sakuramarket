import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { getAdClickPricing, updateAdClickPricing } from "@/lib/api/dbStore";

/** GET — ราคาโฆษณาต่อคลิก — ใครก็อ่านได้ */
export async function GET() {
  try {
    const coinsPerClick = await getAdClickPricing();
    return NextResponse.json({ tiers: [], coins_per_click: coinsPerClick });
  } catch (e) {
    console.error("GET /api/data/ad-price-tiers:", e);
    return NextResponse.json({ error: String(e), tiers: [], coins_per_click: 1 }, { status: 500 });
  }
}

/** PATCH — แก้ไขราคาต่อคลิก (แอดมินเท่านั้น) body: { coins_per_click?: number } */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAdminCookieName())?.value;
    const payload = await requireAdminPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const out: { ok: boolean; coins_per_click?: number } = { ok: true };

    if (typeof body.coins_per_click === "number" || (typeof body.coins_per_click === "string" && body.coins_per_click !== "")) {
      const v = Math.max(0, Number(body.coins_per_click) || 0);
      await updateAdClickPricing(v);
      out.coins_per_click = await getAdClickPricing();
    }
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("PATCH /api/data/ad-price-tiers:", e);
    const isAuthError = msg.includes("แอดมิน") || msg.toLowerCase().includes("unauthorized");
    return NextResponse.json({ error: msg }, { status: isAuthError ? 401 : 500 });
  }
}
