/**
 * ปลดแพ็กเกจของผู้ใช้ทุกคน — ตั้งร้านค้าทุกร้านเป็น "ยังไม่มีแพ็กเกจ" (membership_plan = NULL, membership_expires_at = NULL)
 * ไม่ใช้ .env — รัน: node scripts/unpackage-all-shops.js [รหัสผ่าน DB]
 * หมายเหตุ: ใช้ได้เมื่อ DB มี schema จาก schema-full.sql (membership_plan / membership_expires_at รับ NULL ได้)
 */
import pg from "pg";

const dbPassword = process.argv[2] ?? "postgres";
const config = {
  host: "localhost",
  port: 5432,
  database: "sakuramarket",
  user: "postgres",
  password: dbPassword,
};

const client = new pg.Client(config);

async function main() {
  try {
    await client.connect();

    const totalRes = await client.query("SELECT COUNT(*) AS total FROM shops");
    const totalShops = Number(totalRes.rows[0]?.total ?? 0);

    const res = await client.query(`
      UPDATE shops
      SET membership_plan = NULL, membership_expires_at = NULL
      RETURNING id
    `);
    const updated = res.rowCount ?? 0;

    console.log("\nปลดแพ็กเกจร้านค้าทั้งหมดเรียบร้อย — ทุกร้านเป็น \"ยังไม่มีแพ็กเกจ\"");
    console.log("----------------------------------------");
    console.log("จำนวนร้านในระบบ:", totalShops, "ร้าน");
    console.log("ร้านที่ตั้งเป็นยังไม่มีแพ็กเกจ:", updated, "ร้าน");
    console.log("----------------------------------------\n");
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
