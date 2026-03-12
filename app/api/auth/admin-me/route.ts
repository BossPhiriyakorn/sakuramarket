import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, requireAdminPayload } from "@/lib/auth";
import { findAdminByEmail } from "@/lib/api/dbStore";

/** คืนข้อมูลแอดมินที่ล็อกอินอยู่ — ใช้แสดงชื่อใต้โลโก้และหน้าโปรไฟล์ */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminCookieName())?.value;
  const payload = await requireAdminPayload(token);
  if (!payload) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  const email = payload.email?.trim().toLowerCase();
  if (email) {
    const admin = await findAdminByEmail(email);
    if (admin) {
      return NextResponse.json({
        id: admin.id,
        email: admin.email,
        displayName: admin.display_name || admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        isFirst: false,
      });
    }
    // ไม่มีแถวในตาราง admins (โทเคนเก่าหรือ session ผิดปกติ)
    return NextResponse.json({
      id: null,
      email,
      displayName: payload.username || "แอดมิน",
      firstName: "",
      lastName: "",
      isFirst: true,
    });
  }
  // โทเคนเก่าไม่มี email — ใช้ username
  return NextResponse.json({
    id: null,
    email: "",
    displayName: payload.username || "แอดมิน",
    firstName: "",
    lastName: "",
    isFirst: true,
  });
}
