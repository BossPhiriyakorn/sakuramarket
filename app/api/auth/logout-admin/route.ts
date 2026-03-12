import { NextResponse } from "next/server";
import { getAdminCookieName, isSecureConnection } from "@/lib/auth";

/** ล้างเฉพาะ session แอดมิน — ใช้เมื่อแอดมินกดออกจากระบบใน CMS (ไม่กระทบ session ผู้ใช้) */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  const adminCookie = getAdminCookieName();
  const secureFlag = isSecureConnection() ? "; Secure" : "";
  res.headers.append("Set-Cookie", `${adminCookie}=; Path=/; Max-Age=0; HttpOnly; SameSite=lax${secureFlag}`);
  return res;
}
