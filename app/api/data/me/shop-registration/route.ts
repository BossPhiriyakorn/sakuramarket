import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { upsertShopRegistration, addNotification, getShopByUserId } from "@/lib/api/dbStore";
import { query } from "@/lib/db";

/** 1 ยูส ต่อ 1 ร้าน — ถ้ามีร้านแล้ว ไม่อนุญาตให้ลงทะเบียนร้านใหม่ */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const existingShop = await getShopByUserId(payload.sub);
    if (existingShop?.id) {
      return NextResponse.json(
        { error: "คุณมีร้านอยู่แล้ว 1 ร้าน ไม่สามารถลงทะเบียนร้านใหม่ได้ — ไปที่ จัดการร้านค้า เพื่อแก้ไขร้าน" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const shop_name = typeof body.shop_name === "string" ? body.shop_name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!shop_name) {
      return NextResponse.json({ error: "กรุณากรอกชื่อร้าน" }, { status: 400 });
    }

    const addressBody = body.address && typeof body.address === "object" ? body.address : null;
    const existingReg = await query(
      "SELECT id FROM shop_registrations WHERE user_id = $1 AND status IN ('draft','pending_slot') LIMIT 1",
      [payload.sub]
    );
    const isNew = !existingReg.rows[0];

    const registration = await upsertShopRegistration(payload.sub, {
      shop_name,
      description: description || "",
      logo_url: body.logo_url ?? null,
      logo_background_color: body.logo_background_color ?? null,
      cover_url: body.cover_url ?? null,
      use_same_as_user_address: Boolean(body.use_same_as_user_address),
      address: addressBody ? {
        full_address: typeof addressBody.full_address === "string" ? addressBody.full_address.trim() || undefined : undefined,
        map_url: typeof addressBody.map_url === "string" ? addressBody.map_url.trim() || null : null,
        recipient_name: typeof addressBody.recipient_name === "string" ? addressBody.recipient_name.trim() || null : null,
        phone: typeof addressBody.phone === "string" ? addressBody.phone.trim() || null : null,
        address_line1: typeof addressBody.address_line1 === "string" ? addressBody.address_line1.trim() || null : null,
        address_line2: typeof addressBody.address_line2 === "string" ? addressBody.address_line2.trim() || null : null,
        sub_district: typeof addressBody.sub_district === "string" ? addressBody.sub_district.trim() || null : null,
        district: typeof addressBody.district === "string" ? addressBody.district.trim() || null : null,
        province: typeof addressBody.province === "string" ? addressBody.province.trim() || null : null,
        postal_code: typeof addressBody.postal_code === "string" ? addressBody.postal_code.trim() || null : null,
      } : null,
    });

    if (isNew) {
      await addNotification(
        "shop_registration",
        "ลงทะเบียนร้านค้าใหม่",
        `ร้าน "${shop_name}" ลงทะเบียนเข้าระบบแล้ว`,
        { userId: payload.sub, shop_name }
      ).catch(() => {});
    }

    return NextResponse.json({ registration });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
