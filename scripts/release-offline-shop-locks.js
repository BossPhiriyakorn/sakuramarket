/**
 * ปลดล็อคจองแผนที่ของร้านที่เจ้าของไม่ออนไลน์ติดต่อกันเกิน N วัน
 * ใช้ user_presence.last_seen_at (อัปเดตทุก 30 วิจาก heartbeat)
 *
 * ใช้: node scripts/release-offline-shop-locks.js [วัน]
 * ไม่ส่ง [วัน] = ใช้ 7 วัน (หรือจาก env OFFLINE_DAYS_RELEASE)
 *
 * ตั้ง cron ตัวอย่าง (รันทุกวันเวลา 02:00):
 * 0 2 * * * cd /path/to/Sakura && node scripts/release-offline-shop-locks.js
 */
import "dotenv/config";
import pg from "pg";

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "sakuramarket",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
};

const offlineDays = Math.max(
  1,
  Math.min(
    365,
    Math.floor(
      Number(process.argv[2]) ||
        Number(process.env.OFFLINE_DAYS_RELEASE) ||
        7
    )
  )
);

if (!config.password) {
  console.error("ไม่พบ DB_PASSWORD ใน .env");
  process.exit(1);
}

const client = new pg.Client(config);

async function main() {
  try {
    await client.connect();

    const res = await client.query(
      `SELECT s.id, s.parcel_id, s.shop_name
       FROM shops s
       LEFT JOIN user_presence up ON up.user_id = s.user_id
       WHERE s.parcel_id IS NOT NULL
         AND (up.last_seen_at IS NULL OR up.last_seen_at < now() - make_interval(days => $1::int))`,
      [offlineDays]
    );

    const rows = res.rows;
    let released = 0;
    const errors = [];

    for (const row of rows) {
      const shopId = row.id;
      const shopName = row.shop_name ?? "ร้าน";
      const primaryParcelId = row.parcel_id;

      const extraRes = await client.query(
        "SELECT parcel_id FROM shop_parcels WHERE shop_id = $1",
        [shopId]
      );
      const extraParcelIds = extraRes.rows.map((r) => r.parcel_id);

      try {
        await client.query(
          "UPDATE shops SET parcel_id = NULL, updated_at = now() WHERE id = $1",
          [shopId]
        );
        await client.query("DELETE FROM parcels WHERE id = $1", [
          primaryParcelId,
        ]);
        await client.query(
          "DELETE FROM shop_parcels WHERE shop_id = $1 AND parcel_id = $2",
          [shopId, primaryParcelId]
        );
        released += 1;
        await client.query(
          `INSERT INTO notifications (type, title, message, meta) VALUES ($1, $2, $3, $4)`,
          [
            "shop_lock_released",
            "ร้านหลุดล็อคในแผนที่",
            `ร้าน "${shopName}" ถูกปลดล็อคเพราะเจ้าของไม่ออนไลน์ติดต่อกันเกิน ${offlineDays} วัน`,
            JSON.stringify({ shop_id: shopId, shop_name: shopName }),
          ]
        ).catch(() => {});
      } catch (e) {
        errors.push(`shop ${shopId}: ${e.message}`);
        continue;
      }

      for (const parcelId of extraParcelIds) {
        try {
          await client.query(
            "DELETE FROM shop_parcels WHERE shop_id = $1 AND parcel_id = $2",
            [shopId, parcelId]
          );
          await client.query("DELETE FROM parcels WHERE id = $1", [parcelId]);
        } catch (e) {
          errors.push(`shop ${shopId} parcel ${parcelId}: ${e.message}`);
        }
      }
    }

    console.log(
      `[release-offline-shop-locks] เกณฑ์: ไม่ออนไลน์ติดต่อกัน ${offlineDays} วัน`
    );
    console.log(
      `[release-offline-shop-locks] ปลดล็อคแล้ว ${released} ร้าน`
    );
    if (errors.length > 0) {
      console.error("[release-offline-shop-locks] ความผิดพลาด:", errors);
    }
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
