import { NextResponse } from "next/server";
import { getPackagePlans } from "@/lib/api/dbStore";

/** GET — รายการแพ็กเกจ (ฟรี/พื้นฐาน/โปร) — ใครก็โหลดได้ */
export async function GET() {
  try {
    const plans = await getPackagePlans();
    return NextResponse.json({ plans });
  } catch (e) {
    console.error("GET /api/data/package-plans:", e);
    return NextResponse.json({ error: String(e), plans: [] }, { status: 500 });
  }
}
