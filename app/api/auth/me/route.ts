import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, shouldRefreshToken, signToken, buildAuthCookieHeader, buildClearAuthCookieHeader } from "@/lib/auth";
import { getAuthCookieName } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    if (!token) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", user: null }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload) {
      const res = NextResponse.json({ error: "เซสชันหมดอายุ", user: null }, { status: 401 });
      res.headers.set("Set-Cookie", buildClearAuthCookieHeader());
      return res;
    }

    // ถ้าผู้ใช้ถูกลบจาก DB (เช่น รัน db-clear-users) — คืน 401 และล้าง cookie เพื่อให้ redirect ไป /login
    if (payload.role === "user") {
      const userCheck = await query<{ id: string }>("SELECT id FROM users WHERE id = $1 LIMIT 1", [payload.sub]);
      if (!userCheck.rows[0]) {
        const res = NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 401 });
        res.headers.set("Set-Cookie", buildClearAuthCookieHeader());
        return res;
      }
    }

    const res = NextResponse.json({
      user: {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
      },
    });

    // Sliding session: ออก JWT ใหม่เมื่อใกล้หมดอายุ — มือถือเปิดแอปทิ้งไว้ cookie ไม่หมดกลางคัน
    if (shouldRefreshToken(payload)) {
      const newToken = await signToken({
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
      });
      res.headers.set("Set-Cookie", buildAuthCookieHeader(newToken));
    }

    return res;
  } catch {
    const res = NextResponse.json({ error: "ตรวจสอบเซสชันไม่สำเร็จ", user: null }, { status: 401 });
    res.headers.set("Set-Cookie", buildClearAuthCookieHeader());
    return res;
  }
}
