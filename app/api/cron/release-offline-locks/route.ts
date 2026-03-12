import { NextResponse } from "next/server";
import { releaseParcelLocksForOfflineOwners } from "@/lib/api/dbStore";

const DEFAULT_DAYS = 7;

/**
 * ปลดล็อคจองแผนที่ของร้านที่เจ้าของไม่ออนไลน์ติดต่อกันเกิน N วัน
 * เรียกจาก cron (ส่ง CRON_SECRET ใน header X-Cron-Secret)
 * GET/POST รองรับทั้งคู่
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

  const daysRaw =
    new URL(request.url).searchParams.get("days") ||
    process.env.OFFLINE_DAYS_RELEASE;
  const days = daysRaw ? Math.max(1, Math.min(365, Math.floor(Number(daysRaw)))) : DEFAULT_DAYS;

  try {
    const { released, errors } = await releaseParcelLocksForOfflineOwners(days);
    return NextResponse.json({
      ok: true,
      released,
      days,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), ok: false },
      { status: 500 }
    );
  }
}
