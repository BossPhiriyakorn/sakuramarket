/**
 * ลงทะเบียนผู้ใช้ (ลูกค้า) เท่านั้น — เขียนเฉพาะตาราง users + profiles ไม่เกี่ยว admins
 */
import { NextResponse } from "next/server";
import { hashPassword, signToken, buildAuthCookieHeader } from "@/lib/auth";
import { registerUser, addNotification } from "@/lib/api/dbStore";
import { verifyOtp, clearOtp } from "@/lib/otp-db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const otpCode = typeof body.otpCode === "string" ? body.otpCode.trim() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "").slice(0, 10) : "";
    const termsAccepted = body.termsAccepted === true;
    const privacyAccepted = body.privacyAccepted === true;
    const address = body.address && typeof body.address === "object" ? {
      full_address: typeof body.address.full_address === "string" ? body.address.full_address.trim() : undefined,
      map_url: typeof body.address.map_url === "string" ? body.address.map_url.trim() || null : undefined,
      recipient_name: typeof body.address.recipient_name === "string" ? body.address.recipient_name.trim() || null : undefined,
      phone: typeof body.address.phone === "string" ? body.address.phone.trim() || null : undefined,
      address_line1: typeof body.address.address_line1 === "string" ? body.address.address_line1.trim() || null : undefined,
      address_line2: typeof body.address.address_line2 === "string" ? body.address.address_line2.trim() || null : undefined,
      sub_district: typeof body.address.sub_district === "string" ? body.address.sub_district.trim() || null : undefined,
      district: typeof body.address.district === "string" ? body.address.district.trim() || null : undefined,
      province: typeof body.address.province === "string" ? body.address.province.trim() || null : undefined,
      postal_code: typeof body.address.postal_code === "string" ? body.address.postal_code.trim() || null : undefined,
      country: typeof body.address.country === "string" ? body.address.country.trim() : undefined,
    } : undefined;

    if (!username || username.length < 2) {
      return NextResponse.json({ error: "ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }
    if (!otpCode) {
      return NextResponse.json({ error: "กรุณากรอกรหัส OTP ที่ส่งไปยังอีเมล" }, { status: 400 });
    }
    if (!firstName) {
      return NextResponse.json({ error: "กรุณากรอกชื่อ" }, { status: 400 });
    }
    if (!lastName) {
      return NextResponse.json({ error: "กรุณากรอกนามสกุล" }, { status: 400 });
    }
    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก" }, { status: 400 });
    }
    if (!termsAccepted) {
      return NextResponse.json({ error: "กรุณายอมรับข้อกำหนดการใช้งาน" }, { status: 400 });
    }
    if (!privacyAccepted) {
      return NextResponse.json({ error: "กรุณายอมรับนโยบายความเป็นส่วนตัว" }, { status: 400 });
    }

    // ยืนยัน OTP โดยยังไม่ลบ (consume: false) — จะลบ OTP เฉพาะเมื่อลงทะเบียนสำเร็จ เพื่อให้ผู้ใช้กดยืนยันซ้ำได้ถ้า DB ล้ม
    const isValid = await verifyOtp(email, otpCode, { consume: false });
    if (!isValid) {
      return NextResponse.json({
        error: "รหัส OTP ไม่ถูกต้องหรือหมดอายุ\n\nกรุณาตรวจสอบหรือขอ OTP ใหม่อีกครั้ง",
      }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const result = await registerUser({
      username,
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      termsAcceptedAt: termsAccepted ? new Date().toISOString() : null,
      privacyAcceptedAt: privacyAccepted ? new Date().toISOString() : null,
      address,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // ลงทะเบียนสำเร็จแล้ว — ลบ OTP เพื่อไม่ให้ใช้ซ้ำ
    await clearOtp(email);

    await addNotification(
      "user_registered",
      "ผู้ใช้สมัครใหม่",
      `ผู้ใช้ ${result.user.username} (${result.user.email}) สมัครสมาชิกแล้ว`,
      { userId: result.user.id, username: result.user.username, email: result.user.email }
    ).catch(() => {});

    // แจ้ง Socket server เพื่อให้ CMS หน้า "ผู้ใช้" อัปเดตแบบ real-time
    const socketUrl = process.env.SOCKET_URL || `http://localhost:${process.env.PORT || 3000}`;
    const payload = {
      id: result.user.id,
      username: result.user.username,
      email: result.user.email,
      created_at: result.user.created_at,
      status: result.user.status ?? "active",
      first_name: result.profile?.first_name ?? undefined,
      last_name: result.profile?.last_name ?? undefined,
      phone: result.profile?.phone ?? undefined,
      avatar_url: result.profile?.avatar_url ?? undefined,
    };
    fetch(`${socketUrl}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "user_registered", data: payload }),
    }).catch(() => {});

    const token = await signToken({
      userId: result.user.id,
      username: result.user.username,
      role: "user",
    });

    const res = NextResponse.json({
      user: { id: result.user.id, username: result.user.username, email: result.user.email },
    });
    res.headers.set("Set-Cookie", buildAuthCookieHeader(token));
    return res;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "ลงทะเบียนไม่สำเร็จ" }, { status: 500 });
  }
}
