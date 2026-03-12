/**
 * ลบแจ้งเตือนที่เก่ากว่ากำหนด (notifications + user_notifications)
 * รัน: node scripts/cleanup-old-notifications.js (ใช้ค่า DB_* และ NOTIFICATION_RETENTION_DAYS จาก .env)
 * ใช้กับ cron รายวันได้ เช่น 0 3 * * * node scripts/cleanup-old-notifications.js
 */
import "dotenv/config";
import pg from "pg";

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "sakuramarket",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || process.argv[2],
};

const retentionDays = Math.max(1, Math.floor(Number(process.env.NOTIFICATION_RETENTION_DAYS) || 10));

if (!config.password) {
  console.error("ไม่พบ DB_PASSWORD ใน .env หรืออาร์กิวเมนต์");
  process.exit(1);
}

const client = new pg.Client(config);

async function main() {
  try {
    await client.connect();
    console.log("เชื่อมต่อฐานข้อมูลสำเร็จ:", config.database, "| ลบแจ้งเตือนเก่ากว่า", retentionDays, "วัน");

    const adminRes = await client.query(
      "WITH deleted AS (DELETE FROM notifications WHERE created_at < now() - ($1::text || ' days')::interval RETURNING id) SELECT count(*)::text AS count FROM deleted",
      [retentionDays]
    );
    const userRes = await client.query(
      "WITH deleted AS (DELETE FROM user_notifications WHERE created_at < now() - ($1::text || ' days')::interval RETURNING id) SELECT count(*)::text AS count FROM deleted",
      [retentionDays]
    );

    const notificationsDeleted = parseInt(adminRes.rows[0]?.count ?? "0", 10);
    const userNotificationsDeleted = parseInt(userRes.rows[0]?.count ?? "0", 10);

    console.log("ลบแจ้งเตือนแอดมิน (notifications):", notificationsDeleted, "แถว");
    console.log("ลบแจ้งเตือนผู้ใช้ (user_notifications):", userNotificationsDeleted, "แถว");
    console.log("เสร็จแล้ว");
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
