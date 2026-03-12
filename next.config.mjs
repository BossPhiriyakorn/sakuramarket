import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ดึง host จาก BASE_URL ใน .env — ใช้เป็น allowedDevOrigins เมื่อเข้าแอปผ่าน tunnel (trycloudflare ฯลฯ)
const baseUrl = process.env.BASE_URL?.trim();
const allowedOrigins = [];
if (baseUrl) {
  try {
    const host = new URL(baseUrl).host;
    if (host) allowedOrigins.push(host);
  } catch (_) {}
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ปิด StrictMode เพื่อป้องกัน PIXI/WebGL double-mount ใน development
  // StrictMode ทำให้ component mount → unmount → mount ซ้ำ ทำให้แผนที่ flash แล้วหายบนมือถือ
  // Production build ไม่ได้รับผลกระทบจาก StrictMode อยู่แล้ว
  reactStrictMode: false,
  transpilePackages: [],
  outputFileTracingRoot: __dirname,
  ...(allowedOrigins.length > 0 && { allowedDevOrigins: allowedOrigins }),
};

export default nextConfig;
