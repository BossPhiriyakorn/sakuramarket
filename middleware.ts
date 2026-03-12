/**
 * แยก path ฝั่งผู้ใช้ (/, /map) กับแอดมิน (/admin) — ใช้คุกกี้คนละตัว (sakura_token vs sakura_admin_token)
 * เพื่อไม่ให้แอดมินล็อกอินแล้วทับ session ผู้ใช้
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";
import { getAuthCookieName, getAdminCookieName } from "@/lib/auth";

async function verifyToken(token: string): Promise<{ role: string } | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) return null;
  try {
    const { payload } = await jose.jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    const role = payload.role as string;
    return role ? { role } : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRoot = pathname === "/" || pathname === "";

  // ——— ฝั่งผู้ใช้: ใช้ cookie ผู้ใช้เท่านั้น (sakura_token) ———
  const userCookieName = getAuthCookieName();
  const userToken = request.cookies.get(userCookieName)?.value;
  const userPayload = userToken ? await verifyToken(userToken) : null;

  // ——— ฝั่งแอดมิน: ใช้ cookie แอดมินเท่านั้น (sakura_admin_token) ———
  const adminCookieName = getAdminCookieName();
  const adminToken = request.cookies.get(adminCookieName)?.value;
  const adminPayload = adminToken ? await verifyToken(adminToken) : null;

  // หน้าแรก (/) = ทางเข้าฝั่งผู้ใช้เท่านั้น
  // - ผู้ใช้ที่ล็อกอินแล้ว -> /map
  // - ไม่ว่ามี/ไม่มี admin cookie -> /login (ไม่เด้งไป /admin อัตโนมัติ)
  if (isRoot) {
    if (userToken && userPayload?.role === "user") {
      const res = NextResponse.redirect(new URL("/map", request.url), 307);
      res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
      return res;
    }
    const loginUrl = new URL("/login", request.url);
    const res = NextResponse.redirect(loginUrl, 307);
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  }

  if (pathname === "/login") {
    if (userToken && userPayload?.role === "user") {
      return NextResponse.redirect(new URL("/map", request.url));
    }
    return NextResponse.next();
  }

  // หน้าแผนที่ — เฉพาะผู้ใช้ที่ล็อกอิน
  if (pathname === "/map") {
    if (!userToken || !userPayload || userPayload.role !== "user") {
      const res = NextResponse.redirect(new URL("/login", request.url), 307);
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return res;
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    return res;
  }

  // ——— ฝั่งแอดมิน: /admin/login, /admin — เช็คเฉพาะ cookie แอดมิน ———
  if (pathname === "/admin/login") {
    if (adminToken && adminPayload?.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!adminToken || !adminPayload || adminPayload.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // หน้าโปรไฟล์/จัดการร้าน ฯลฯ — เช็คเฉพาะ session ผู้ใช้ (ไม่สนใจ cookie แอดมิน)
  const userOnlyPaths = ["/profile", "/following", "/tracking", "/checkout", "/register-shop", "/register", "/notifications"];
  const isUserOnly = userOnlyPaths.includes(pathname) || pathname.startsWith("/manage-shop");
  if (isUserOnly) {
    if (pathname === "/register") {
      return NextResponse.next();
    }
    if (!userToken || !userPayload || userPayload.role !== "user") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/map", "/register", "/admin", "/admin/login", "/admin/:path*", "/profile", "/manage-shop", "/manage-shop/:path*", "/following", "/tracking", "/checkout", "/register-shop", "/notifications"],
};
