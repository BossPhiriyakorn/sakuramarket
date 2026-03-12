/**
 * รันสร้างตาราง + seed (rooms, ref_status, package_plans) + แอดมินคนแรก
 * ใช้บนเซิร์ฟเวอร์ครั้งแรก (หลังมี .env) — อ่าน DB_* จาก .env จึงไม่ต้องส่งรหัสผ่านในคำสั่ง
 *
 * รัน: cd /path/to/Sakura && node scripts/run-db-setup.js
 *
 * สคริปต์ย่อยใช้ IF NOT EXISTS / ON CONFLICT จึงรันซ้ำได้ (ไม่สร้างซ้ำ)
 */
import "dotenv/config";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

if (!process.env.DB_PASSWORD) {
  console.error("ไม่พบ DB_PASSWORD ใน .env");
  process.exit(1);
}

console.log("Running db-init.js...");
const r1 = spawnSync(process.execPath, [join(__dirname, "db-init.js")], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (r1.status !== 0) {
  process.exit(r1.status ?? 1);
}

console.log("Running seed-first-admin.js...");
const r2 = spawnSync(
  process.execPath,
  [join(__dirname, "seed-first-admin.js"), process.env.DB_PASSWORD],
  { cwd: root, stdio: "inherit", env: process.env }
);
process.exit(r2.status != null ? r2.status : 0);
