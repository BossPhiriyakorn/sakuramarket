/**
 * Debug endpoint สำหรับตรวจสอบสถานะ OTP
 * ใช้เฉพาะในโหมด development เท่านั้น
 */
import { NextResponse } from "next/server";
import { getOtpStatus } from "@/lib/otp-db";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    
    if (!email) {
      return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
    }

    const status = await getOtpStatus(email);
    
    return NextResponse.json({
      email,
      status,
      message: status.exists 
        ? `OTP: ${status.code}, หมดอายุใน ${status.timeRemainingSeconds} วินาที, ลองแล้ว ${status.attempts}/${status.maxAttempts} ครั้ง`
        : "ไม่พบ OTP สำหรับอีเมลนี้"
    });
  } catch (err) {
    console.error("Check OTP status error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
