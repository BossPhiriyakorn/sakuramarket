import { NextResponse } from "next/server";

/**
 * คืนค่าบัญชีแอดมินตัวอย่างสำหรับปุ่ม Mock — ใช้ได้เฉพาะโหมดพัฒนา (NODE_ENV=development)
 * ไม่ส่งค่าใน production เพื่อความปลอดภัย
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: "ADMIN_EMAIL or ADMIN_PASSWORD not set" }, { status: 404 });
  }
  return NextResponse.json({ email, password });
}
