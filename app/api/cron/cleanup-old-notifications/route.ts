import { NextResponse } from "next/server";
import { deleteNotificationsOlderThanDays } from "@/lib/api/dbStore";

const RETENTION_DAYS = Math.max(1, Math.floor(Number(process.env.NOTIFICATION_RETENTION_DAYS) || 10));

/**
 * ลบแจ้งเตือนที่เก่ากว่ากำหนด (notifications + user_notifications)
 * เรียกจาก cron (ส่ง CRON_SECRET ใน header X-Cron-Secret หรือ query ?secret=)
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
    const { notificationsDeleted, userNotificationsDeleted } = await deleteNotificationsOlderThanDays(RETENTION_DAYS);
    return NextResponse.json({
      ok: true,
      retentionDays: RETENTION_DAYS,
      notificationsDeleted,
      userNotificationsDeleted,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), ok: false },
      { status: 500 }
    );
  }
}
