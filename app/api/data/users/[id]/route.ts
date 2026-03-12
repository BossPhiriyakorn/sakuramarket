import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserDetail } from "@/lib/api/dbStore";
import { getAuthCookieName, getAdminCookieName, verifyToken, requireAdminPayload } from "@/lib/auth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const userToken = cookieStore.get(getAuthCookieName())?.value;
  const adminToken = cookieStore.get(getAdminCookieName())?.value;
  // แอดมินต้องดูรายละเอียดผู้ใช้ได้ทุกคน — เช็คแอดมินก่อน ถ้ามีทั้ง user + admin cookie จะใช้แอดมิน
  const adminPayload = adminToken ? await requireAdminPayload(adminToken) : null;
  const userPayload = userToken ? await verifyToken(userToken) : null;
  const payload = adminPayload ?? userPayload;
  if (!payload?.sub) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const rawId = (await params).id;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    // id ต้องเป็น UUID (ผู้ใช้) — แอดมินใช้ sub "admin" ไม่มีในตาราง users
    if (!id || id === "admin" || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    }
    // เฉพาะผู้ใช้ดูของตัวเอง หรือแอดมินดูได้ทุกคน
    if (payload.role !== "admin" && payload.sub !== id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลนี้" }, { status: 403 });
    }
    const detail = await getUserDetail(id);
    if (!detail.user) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    return NextResponse.json({
      user: detail.user,
      profile: detail.profile,
      address: detail.address,
      wallets: detail.wallets,
      verification: detail.verification,
      shops: detail.shops,
      registrations: detail.registrations,
      payments: detail.payments,
      payouts: detail.payouts,
      last_seen_at: detail.last_seen_at,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
