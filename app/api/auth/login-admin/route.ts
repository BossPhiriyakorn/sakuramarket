/**
 * ล็อกอินฝั่งแอดมิน (CMS) — ใช้เฉพาะตาราง admins ในฐานข้อมูล
 * หน้า: /admin/login → API นี้ → หลังสำเร็จไป /admin
 */
import { NextResponse } from "next/server";
import { signToken, getAdminCookieName, getAuthCookieOptions, getJwtExpiresInSeconds } from "@/lib/auth";
import { findAdminByEmail, verifyAdminPassword, addNotification } from "@/lib/api/dbStore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่านแอดมิน" }, { status: 400 });
    }

    const admin = await findAdminByEmail(email);
    if (!admin || !(await verifyAdminPassword(admin, password))) {
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านแอดมินไม่ถูกต้อง" }, { status: 401 });
    }
    const username = admin.display_name || admin.email;

    const token = await signToken({
      userId: admin.id,
      username,
      role: "admin",
      email: email.trim().toLowerCase(),
    });

    await addNotification("admin_login", "การเข้าใช้งานของแอดมิน", `แอดมิน ${username} (${email}) เข้าสู่ระบบ`);

    const cookieName = getAdminCookieName();
    const maxAge = getJwtExpiresInSeconds();
    const cookieOptions = getAuthCookieOptions(maxAge);
    const cookieValue = `${cookieName}=${token}; Path=${cookieOptions.path}; Max-Age=${cookieOptions.maxAge}; HttpOnly; SameSite=${cookieOptions.sameSite}${cookieOptions.secure ? "; Secure" : ""}`;

    const res = NextResponse.json({
      user: { id: admin.id, username, email: admin.email },
    });
    res.headers.set("Set-Cookie", cookieValue);
    return res;
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.json({ error: "เข้าสู่ระบบแอดมินไม่สำเร็จ" }, { status: 500 });
  }
}
