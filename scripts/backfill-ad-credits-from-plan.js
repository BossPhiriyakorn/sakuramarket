/**
 * Backfill: เติมเครดิตโฆษณาให้ผู้ใช้ที่มีร้าน + แพ็กเกจอยู่แล้ว แต่ยังไม่มีเครดิตใน user_ad_credits
 * (กรณีตาราง user_ad_credits ถูกสร้างทีหลัง ทำให้คนที่สมัครแพ็กเกจไปก่อนไม่ได้เครดิต)
 * รัน: node scripts/backfill-ad-credits-from-plan.js (ใช้ค่า DB_* จาก .env)
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

if (!config.password) {
  console.error("ไม่พบ DB_PASSWORD ใน .env หรืออาร์กิวเมนต์");
  process.exit(1);
}

const client = new pg.Client(config);

async function main() {
  try {
    await client.connect();
    console.log("เชื่อมต่อฐานข้อมูลสำเร็จ:", config.database);

    const shopsRes = await client.query(
      `SELECT s.user_id, s.membership_plan
       FROM shops s
       WHERE s.membership_plan IS NOT NULL AND s.membership_plan != ''`
    );

    if (shopsRes.rows.length === 0) {
      console.log("ไม่มีร้านที่สมัครแพ็กเกจแล้ว");
      return;
    }

    let granted = 0;
    for (const row of shopsRes.rows) {
      const userId = row.user_id;
      const planKey = row.membership_plan;

      const planRes = await client.query(
        `SELECT COALESCE(ad_credits_granted, 0)::int AS ad_credits_granted
         FROM package_plans WHERE plan_key = $1`,
        [planKey]
      );
      const adCredits = Math.max(0, parseInt(planRes.rows[0]?.ad_credits_granted ?? "0", 10));
      if (adCredits === 0) continue;

      const curRes = await client.query(
        `SELECT credits::numeric AS credits FROM user_ad_credits WHERE user_id = $1`,
        [userId]
      );
      const currentCredits = curRes.rows[0] ? parseFloat(curRes.rows[0].credits ?? "0") : 0;
      if (currentCredits > 0) continue;

      await client.query(
        `INSERT INTO user_ad_credits (user_id, credits) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET credits = user_ad_credits.credits + EXCLUDED.credits`,
        [userId, adCredits]
      );
      granted++;
      console.log(`เติมเครดิตโฆษณา ${adCredits} เหรียญ ให้ user_id=${userId} (แพ็กเกจ ${planKey})`);
    }

    console.log(`\nBackfill เสร็จแล้ว — เติมเครดิตให้ ${granted} ราย`);
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
