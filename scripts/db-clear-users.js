/**
 * ล้างเฉพาะข้อมูลผู้ใช้: ลงทะเบียนร้าน ส่งเอกสาร จองล็อค และอื่นๆ ที่เกี่ยวกับผู้ใช้
 * ไม่ลบ: ref_status, admins, rooms (ห้องและแผนที่), item_shop_products, notifications
 *
 * ใช้: node scripts/db-clear-users.js
 * ต้องมี .env มี DB_HOST, DB_NAME, DB_USER, DB_PASSWORD (และ DB_PORT ถ้าต้องการ)
 */
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "sakuramarket",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
};

if (!config.password) {
  console.error("ไม่พบ DB_PASSWORD ใน .env");
  process.exit(1);
}

const sqlPath = join(root, "scripts", "db-clear-users.sql");
const client = new pg.Client(config);

async function main() {
  try {
    await client.connect();
    console.log("เชื่อมต่อฐานข้อมูลสำเร็จ:", config.database);
    const sql = readFileSync(sqlPath, "utf-8");
    await client.query(sql);
    console.log("ล้างข้อมูลผู้ใช้สำเร็จ (เก็บ ref_status, admins, rooms, item_shop_products, notifications ไว้)");
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
