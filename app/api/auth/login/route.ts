/**
 * ล็อกอินฝั่งผู้ใช้ (ลูกค้า) เท่านั้น
 * — ใช้เฉพาะตาราง users (และ password ใน users) ไม่เกี่ยว admins
 * — หน้า: /login → API นี้ → หลังสำเร็จไป /
 * — รองรับทั้งอีเมลและชื่อผู้ใช้: ค้นหา user จาก email หรือ username แล้วได้คนเดียวกัน (id เดียวกัน)
 *   จึงออกโทเคนเดียวกัน — ไม่ได้แยกโทเคนตามวิธีเข้าใช้งาน
 */
import { NextResponse } from "next/server";
import { verifyPassword, signToken, buildAuthCookieHeader } from "@/lib/auth";
import {
  findUserByEmail,
  findUserByUsername,
  getAuthPassword,
  setAuthPassword,
  upsertUserPresence,
} from "@/lib/api/dbStore";

const DEMO_PASSWORD = "password123";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const emailOrUsername = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!emailOrUsername || !password) {
      return NextResponse.json({ error: "กรุณากรอกอีเมล/ชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
    }

    let user = await findUserByEmail(emailOrUsername);
    if (!user) user = await findUserByUsername(emailOrUsername);
    if (!user) {
      return NextResponse.json({ error: "อีเมล/ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    let storedHash = await getAuthPassword(user.id);
    if (!storedHash) {
      const { hashPassword } = await import("@/lib/auth");
      storedHash = await hashPassword(DEMO_PASSWORD);
      await setAuthPassword(user.id, storedHash);
    }

    const valid = await verifyPassword(password, storedHash);
    if (!valid) {
      return NextResponse.json({ error: "อีเมล/ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: "user",
    });

    await upsertUserPresence(user.id).catch((e) =>
      console.error("[login] upsertUserPresence failed:", e)
    );

    const res = NextResponse.json({
      user: { id: user.id, username: user.username, email: user.email },
    });
    res.headers.set("Set-Cookie", buildAuthCookieHeader(token));
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 500 });
  }
}
