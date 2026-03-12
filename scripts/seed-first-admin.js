/**
 * สร้างแอดมินคนแรกด้วยยูส/รหัสที่กำหนด
 * ยูส: admin@host.com / รหัส: admin11223344
 * รัน: node scripts/seed-first-admin.js [รหัสผ่าน DB]
 * หรือรันผ่าน run-db-setup.js (อ่าน DB_* จาก .env)
 */
import "dotenv/config";
import pg from "pg";
import { hash } from "bcryptjs";

// ยูสและรหัสแอดมินคนแรก (ไม่อ่านจาก .env)
const ADMIN_EMAIL = "admin@host.com";
const ADMIN_PASSWORD = "admin11223344";
const ADMIN_DISPLAY_NAME = "แอดมิน";

// การเชื่อมต่อ DB — ใช้ .env ได้ หรือส่งรหัสผ่านเป็น argument
const dbPassword = process.argv[2] ?? process.env.DB_PASSWORD ?? "postgres";
const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME ?? "sakuramarket",
  user: process.env.DB_USER ?? "postgres",
  password: dbPassword,
};

const SALT_ROUNDS = 10;
const client = new pg.Client(config);

async function main() {
  try {
    await client.connect();
    const passwordHash = await hash(ADMIN_PASSWORD, SALT_ROUNDS);
    const emailLower = ADMIN_EMAIL.toLowerCase();
    await client.query(
      `INSERT INTO admins (email, password_hash, first_name, last_name, display_name)
       VALUES ($1, $2, '', '', $3)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name`,
      [emailLower, passwordHash, ADMIN_DISPLAY_NAME]
    );
    const res = await client.query(
      "SELECT id, email, display_name FROM admins WHERE LOWER(email) = $1",
      [emailLower]
    );
    if (res.rows.length > 0) {
      console.log("\nตั้งค่าแอดมินเรียบร้อย (สร้างใหม่หรืออัปเดตรหัสผ่านให้ตรงกับที่กำหนด)");
      console.log("เข้าใช้งานแอดมินที่ /admin/login\n");
      console.log("----------------------------------------");
      console.log("แอดมิน — เก็บไว้ใช้เข้าสู่ระบบ");
      console.log("----------------------------------------");
      console.log("อีเมล (ยูส):", res.rows[0].email);
      console.log("รหัสผ่าน:   ", ADMIN_PASSWORD);
      console.log("----------------------------------------");
    }
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
