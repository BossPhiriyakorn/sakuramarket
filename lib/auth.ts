/**
 * JWT และรหัสผ่าน — ใช้สำหรับการเข้าใช้งานผู้ใช้และแอดมิน
 * ตั้งค่า JWT_SECRET, JWT_EXPIRES_IN ใน .env (แอดมินใช้ตาราง admins ในฐานข้อมูล)
 */
import * as jose from "jose";
import { compare, hash } from "bcryptjs";

/** Cookie สำหรับผู้ใช้ (ลูกค้า) — ใช้กับ /, /login, /profile, /api/data/me/* */
const COOKIE_NAME_USER = "sakura_token";
/** Cookie สำหรับแอดมิน (CMS) — ใช้กับ /admin, /admin/login, /api ฝั่งแอดมิน แยกกันเพื่อไม่ให้แอดมินล็อกอินแล้วทับ session ผู้ใช้ */
const COOKIE_NAME_ADMIN = "sakura_admin_token";
const SALT_ROUNDS = 10;

export type AuthRole = "user" | "admin";

export interface JwtPayload {
  sub: string;
  username: string;
  role: AuthRole;
  email?: string;
  iat?: number;
  exp?: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set in .env and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? "7d";
}

/** คำนวณอายุ cookie (วินาที) จาก JWT_EXPIRES_IN (เช่น 7d, 24h) */
export function getJwtExpiresInSeconds(): number {
  const raw = getJwtExpiresIn().trim().toLowerCase();
  const match = raw.match(/^(\d+)(d|h|m|s)?$/);
  if (!match) return 7 * 24 * 3600; // default 7 days
  const n = parseInt(match[1], 10);
  const unit = match[2] ?? "d";
  if (unit === "d") return n * 24 * 3600;
  if (unit === "h") return n * 3600;
  if (unit === "m") return n * 60;
  return n;
}

/** สร้าง JWT สำหรับผู้ใช้หรือแอดมิน (แอดมินใส่ email เพื่อใช้ใน admin-me/โปรไฟล์) */
export async function signToken(payload: {
  userId: string;
  username: string;
  role: AuthRole;
  email?: string;
}): Promise<string> {
  const secret = getSecret();
  const exp = getJwtExpiresIn();
  const claims: Record<string, unknown> = {
    username: payload.username,
    role: payload.role,
  };
  if (payload.email) claims.email = payload.email;
  return new jose.SignJWT(claims)
    .setSubject(payload.userId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

/** ตรวจสอบ JWT และคืนค่า payload หรือ null */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify(token, secret);
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") return null;
    return {
      sub,
      username: (payload.username as string) ?? "",
      role: (payload.role as AuthRole) ?? "user",
      email: typeof payload.email === "string" ? payload.email : undefined,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return compare(password, hashed);
}

export function getAuthCookieName(): string {
  return COOKIE_NAME_USER;
}

export function getAdminCookieName(): string {
  return COOKIE_NAME_ADMIN;
}

/**
 * ตรวจสอบว่าแอปทำงานบน HTTPS (production หรือ tunnel เช่น trycloudflare)
 * มือถือ (iOS Safari, LINE browser) ต้องการ Secure flag จึงจะบันทึก/ส่ง cookie บน HTTPS connection
 * — ถ้าไม่ตั้ง Secure บน HTTPS → cookie ถูกปฏิเสธ → middleware ไม่เห็น cookie → redirect loop
 */
export function isSecureConnection(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const baseUrl = process.env.BASE_URL?.trim() ?? "";
  return baseUrl.startsWith("https://");
}

export function getAuthCookieOptions(maxAgeSeconds: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: isSecureConnection(),
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/**
 * สร้างค่า Set-Cookie สำหรับ sakura_token — ใช้รูปแบบเดียวกันทุกที่ (login + refresh)
 * มือถือ (iOS Safari, LINE) ต้องการ Path=/, HttpOnly, SameSite=Lax และ Secure เมื่อใช้ HTTPS
 */
export function buildAuthCookieHeader(token: string): string {
  const name = getAuthCookieName();
  const maxAge = getJwtExpiresInSeconds();
  const opts = getAuthCookieOptions(maxAge);
  const securePart = opts.secure ? "; Secure" : "";
  return `${name}=${token}; Path=${opts.path}; Max-Age=${maxAge}; HttpOnly; SameSite=${opts.sameSite}${securePart}`;
}

/** ล้าง cookie ผู้ใช้ (ใช้เมื่อ user ถูกลบจาก DB แล้ว เพื่อให้ client ถูก redirect ไป /login) */
export function buildClearAuthCookieHeader(): string {
  const name = getAuthCookieName();
  const securePart = isSecureConnection() ? "; Secure" : "";
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=lax${securePart}`;
}

/** อ่านช่วง refresh (ชม.) จาก env — เหลืออายุ token น้อยกว่าเท่านี้ให้ re-issue cookie (sliding session) */
function getRefreshThresholdSeconds(): number {
  const raw = process.env.JWT_REFRESH_THRESHOLD_HOURS?.trim();
  if (raw === "") return 24 * 3600;
  const hours = parseInt(raw ?? "24", 10);
  if (!Number.isFinite(hours) || hours < 0) return 24 * 3600;
  return hours * 3600;
}

/** ตรวจว่า JWT ใกล้หมดอายุ (เหลือน้อยกว่า JWT_REFRESH_THRESHOLD_HOURS หรือ 25% ของ maxAge) — ใช้ใน /api/auth/me เพื่อออก cookie ใหม่ */
export function shouldRefreshToken(payload: JwtPayload): boolean {
  const exp = payload.exp;
  if (typeof exp !== "number") return false;
  const now = Math.floor(Date.now() / 1000);
  const remaining = exp - now;
  if (remaining <= 0) return false;
  const maxAge = getJwtExpiresInSeconds();
  const threshold = Math.min(getRefreshThresholdSeconds(), Math.floor(maxAge * 0.25));
  return remaining < threshold;
}

/** ใช้ใน API ของ CMS — คืน payload ถ้า token ถูกต้องและเป็นแอดมิน ไม่ใช่คืน null */
export async function requireAdminPayload(token: string | undefined): Promise<JwtPayload | null> {
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.role === "admin" ? payload : null;
}
