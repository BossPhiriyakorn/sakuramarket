import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyToken } from "@/lib/auth";
import { getRentalInvoicesByUserId } from "@/lib/api/dbStore";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAuthCookieName())?.value;
    const payload = await verifyToken(token ?? "");
    if (!payload?.sub) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ", invoices: [] }, { status: 401 });
    }
    const invoices = await getRentalInvoicesByUserId(payload.sub);
    return NextResponse.json({ invoices });
  } catch (e) {
    return NextResponse.json({ error: String(e), invoices: [] }, { status: 500 });
  }
}
