/**
 * ล้างฐานข้อมูล: ลบข้อมูลห้อง สินค้า ผู้ใช้ แอดมิน ฯลฯ
 * ไม่ลบ ref_status (Ref สถานะ) — หลังล้างจะใส่ห้องเดียวกลับ
 * ใช้: node scripts/db-clear.js
 * ต้องมี .env มี DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
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

const clearPath = join(root, "scripts", "db-clear.sql");
const client = new pg.Client(config);

async function main() {
  try {
    await client.connect();
    console.log("เชื่อมต่อฐานข้อมูลสำเร็จ:", config.database);
    const sql = readFileSync(clearPath, "utf-8");
    await client.query(sql);
    console.log("ล้างฐานข้อมูลสำเร็จ (เก็บ ref_status ไว้, ใส่ห้องเดียวกลับ)");
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
