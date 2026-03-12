/**
 * ยืนยัน OTP และตั้งรหัสผ่านใหม่ (ลืมรหัสผ่าน)
 */
import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp-db";
import { findUserByEmail, setAuthPassword } from "@/lib/api/dbStore";
import { hashPassword } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 6;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!email || !code) {
      return NextResponse.json(
        { error: "กรุณากรอกอีเมลและรหัส OTP" },
        { status: 400 }
      );
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน" },
        { status: 400 }
      );
    }

    const valid = await verifyOtp(email, code);
    if (!valid) {
      return NextResponse.json(
        { error: "รหัส OTP ไม่ถูกต้องหรือหมดอายุ" },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "ไม่พบผู้ใช้ในระบบ" },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await setAuthPassword(user.id, passwordHash);

    return NextResponse.json({
      message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
    });
  } catch (err) {
    console.error("Forgot password reset error:", err);
    return NextResponse.json(
      { error: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
