import { NextResponse } from "next/server";
import { getAuthCookieName, isSecureConnection } from "@/lib/auth";

/** ล้างเฉพาะ session ผู้ใช้ (ลูกค้า) — ใช้เมื่อผู้ใช้กดออกจากระบบในแอป */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  const userCookie = getAuthCookieName();
  const secureFlag = isSecureConnection() ? "; Secure" : "";
  res.headers.append("Set-Cookie", `${userCookie}=; Path=/; Max-Age=0; HttpOnly; SameSite=lax${secureFlag}`);
  return res;
}
