import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { subscribeShopToPlan, addUserNotification } from "@/lib/api/dbStore";

const VALID_PLAN_KEYS = ["free", "basic", "pro"] as const;

/** POST — สมัครแพ็กเกจร้าน (หักเหรียญแล้วอัปเดต membership) — ผู้ใช้ที่ล็อกอินแล้ว */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    if (payload.role === "admin") {
      return NextResponse.json({ error: "ใช้บัญชีผู้ใช้ (ไม่ใช่แอดมิน) เพื่อสมัครแพ็กเกจร้าน" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const planKey = typeof body.plan_key === "string" ? body.plan_key.trim() : "";
    if (!planKey || !VALID_PLAN_KEYS.includes(planKey as (typeof VALID_PLAN_KEYS)[number])) {
      return NextResponse.json({ error: "กรุณาระบุ plan_key ที่ถูกต้อง (free, basic, pro)" }, { status: 400 });
    }
    const result = await subscribeShopToPlan(payload.sub, planKey);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await addUserNotification(
      payload.sub,
      "package_subscribed",
      "ซื้อแพ็กเกจแล้ว",
      `สมัครแพ็กเกจ ${planKey} เรียบร้อย — จองล็อคและจัดการร้านได้ที่เมนูจัดการร้าน`,
      "/manage-shop",
      { plan_key: planKey }
    ).catch((err) => console.error("addUserNotification package_subscribed:", err));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/data/me/shop/subscribe:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
