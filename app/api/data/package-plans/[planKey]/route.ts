import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { updatePackagePlan, deletePackagePlan } from "@/lib/api/dbStore";

const VALID_PLAN_KEYS = ["free", "basic", "pro"] as const;

/** PATCH — แก้ไขแพ็กเกจ (เฉพาะแอดมิน) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planKey: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { planKey } = await params;
    if (!planKey || !VALID_PLAN_KEYS.includes(planKey as (typeof VALID_PLAN_KEYS)[number])) {
      return NextResponse.json({ error: "plan_key ไม่ถูกต้อง" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const updates: Parameters<typeof updatePackagePlan>[1] = {};
    if (typeof body.name_th === "string") updates.name_th = body.name_th.trim();
    if (typeof body.duration_days === "number") updates.duration_days = Math.max(1, Math.floor(body.duration_days));
    if (typeof body.duration_days === "string") updates.duration_days = Math.max(1, Math.floor(parseInt(body.duration_days, 10) || 1));
    if (typeof body.max_categories === "number") updates.max_categories = Math.max(0, Math.floor(body.max_categories));
    if (typeof body.max_categories === "string") updates.max_categories = Math.max(0, Math.floor(parseInt(body.max_categories, 10) || 0));
    if (typeof body.max_products_visible === "number") updates.max_products_visible = Math.max(0, Math.floor(body.max_products_visible));
    if (typeof body.max_products_visible === "string") updates.max_products_visible = Math.max(0, Math.floor(parseInt(body.max_products_visible, 10) || 0));
    if (typeof body.map_expansion_limit === "number") updates.map_expansion_limit = Math.max(0, Math.floor(body.map_expansion_limit));
    if (typeof body.map_expansion_limit === "string") updates.map_expansion_limit = Math.max(0, Math.floor(parseInt(body.map_expansion_limit, 10) || 0));
    if (typeof body.ad_credits_granted === "number") updates.ad_credits_granted = Math.max(0, Math.floor(body.ad_credits_granted));
    if (typeof body.ad_credits_granted === "string") updates.ad_credits_granted = Math.max(0, Math.floor(parseInt(body.ad_credits_granted, 10) || 0));
    if (typeof body.sort_order === "number") updates.sort_order = Math.max(0, Math.floor(body.sort_order));
    if (typeof body.sort_order === "string") updates.sort_order = Math.max(0, Math.floor(parseInt(body.sort_order, 10) || 0));
    if (typeof body.price_credits === "number") updates.price_credits = Math.max(0, Math.floor(body.price_credits));
    if (typeof body.price_credits === "string") updates.price_credits = Math.max(0, Math.floor(parseInt(body.price_credits, 10) || 0));

    const result = await updatePackagePlan(planKey, updates);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PATCH /api/data/package-plans/[planKey]:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** DELETE — ลบแพ็กเกจ (เฉพาะแอดมิน, ลบได้เมื่อไม่มีร้านใช้แผนนี้) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ planKey: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  try {
    const { planKey } = await params;
    if (!planKey || typeof planKey !== "string" || !planKey.trim()) {
      return NextResponse.json({ error: "plan_key ไม่ถูกต้อง" }, { status: 400 });
    }
    const result = await deletePackagePlan(planKey.trim());
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/data/package-plans/[planKey]:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
