import { NextResponse } from "next/server";
import { releaseParcelLocksForExpiredMemberships } from "@/lib/api/dbStore";

/**
 * ปลดล็อคจองแผนที่ของร้านที่แพ็กเกจหมดอายุ (membership_expires_at < now())
 * เรียกจาก cron (ส่ง CRON_SECRET ใน header X-Cron-Secret หรือ query ?secret=)
 * ต่ออายุก่อนหมด = ไม่ถูกปลดล็อค จึงได้ที่เดิม
 */
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const given =
      request.headers.get("X-Cron-Secret") ??
      new URL(request.url).searchParams.get("secret");
    if (given !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { released, errors } = await releaseParcelLocksForExpiredMemberships();
    return NextResponse.json({
      ok: true,
      released,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), ok: false },
      { status: 500 }
    );
  }
}
