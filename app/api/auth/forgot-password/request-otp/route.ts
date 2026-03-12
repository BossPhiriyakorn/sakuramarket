/**
 * ขอ OTP สำหรับลืมรหัสผ่าน — ส่ง OTP ไปที่อีเมล (เฉพาะถ้าอีเมลนี้มีในระบบ)
 */
import { NextResponse } from "next/server";
import { createOtp, getCooldownRemainingSeconds } from "@/lib/otp-db";
import { sendMail } from "@/lib/email";
import { findUserByEmail } from "@/lib/api/dbStore";

const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Sakura Market";
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES) || 5;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "ไม่พบอีเมลนี้ในระบบ" },
        { status: 404 }
      );
    }

    const { code } = await createOtp(email);
    if (!code) {
      const seconds = await getCooldownRemainingSeconds(email);
      return NextResponse.json(
        { error: `กรุณารอ ${seconds} วินาที ก่อนขอ OTP อีกครั้ง`, cooldownSeconds: seconds },
        { status: 429 }
      );
    }

    await sendMail({
      to: email,
      subject: `รหัส OTP สำหรับตั้งรหัสผ่านใหม่ - ${EMAIL_FROM_NAME}`,
      text: `รหัส OTP ของคุณคือ: ${code}\n\nรหัสมีอายุ ${OTP_EXPIRY_MINUTES} นาที\n\nหากคุณไม่ได้ขอรหัสนี้ กรุณาข้ามอีเมลนี้`,
      html: `<p>รหัส OTP ของคุณคือ: <strong>${code}</strong></p><p>รหัสมีอายุ ${OTP_EXPIRY_MINUTES} นาที</p><p>หากคุณไม่ได้ขอรหัสนี้ กรุณาข้ามอีเมลนี้</p>`,
    });

    return NextResponse.json({
      message: "ส่ง OTP ไปยังอีเมลของคุณแล้ว",
      cooldownSeconds: (Number(process.env.OTP_COOLDOWN_MINUTES) || 1) * 60,
    });
  } catch (err) {
    console.error("Forgot password request OTP error:", err);
    const message = err instanceof Error ? err.message : "ส่ง OTP ไม่สำเร็จ";
    return NextResponse.json(
      { error: message.includes("SMTP") || message.includes("EMAIL") ? message : "ส่ง OTP ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
