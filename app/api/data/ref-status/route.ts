import { NextRequest, NextResponse } from "next/server";
import { getRefStatus } from "@/lib/api/dbStore";

/** ค่าอ้างอิงสถานะ (ref_status) — ใช้แสดง label ใน UI ได้รับ query ?type=order_item_shipping เป็นต้น */
export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") ?? undefined;
    const rows = await getRefStatus(type || undefined);
    return NextResponse.json({ items: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
