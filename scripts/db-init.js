/**
 * โหลด .env และเชื่อมต่อ PostgreSQL แล้วรัน schema-full.sql + seed.sql
 * แอดมิน: เพิ่มจากเมนู จัดการแอดมิน ใน CMS หรือรัน node scripts/seed-first-admin.js (ถ้ามี ADMIN_EMAIL ใน .env)
 * ใช้: node scripts/db-init.js
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

const schemaFullPath = join(root, "scripts", "schema-full.sql");
const seedPath = join(root, "scripts", "seed.sql");

const client = new pg.Client(config);

// ต้องตรงกับ scripts/schema-full.sql (ทุกตารางที่ CREATE TABLE IF NOT EXISTS)
const TABLE_LIST = [
  "users", "profiles", "wallets", "addresses", "rooms", "parcels",
  "parcel_booking_draft", "parcel_selection_hold", "room_booking_lock", "room_blocked_slots", "parcel_booking_audit",
  "shops", "shop_parcels", "shop_contact_channels", "shop_verification_documents", "shop_registrations", "shop_registration_contacts",
  "categories", "products", "product_categories", "tags", "product_tags",
  "profile_contact_channels", "announcements", "orders", "order_items",
  "parcel_rental_invoices", "shop_payouts", "platform_revenue_log",
  "shop_follows", "shop_reviews", "product_reviews",
  "user_verification", "user_balances", "user_ad_credits", "user_presence", "admins",
  "item_shop_products", "user_inventory", "promo_zones", "notifications", "user_notifications", "user_announcement_reads", "ref_status",
  "otp_codes", "shop_ads", "shop_analytics", "product_analytics", "ad_price_tiers", "ad_click_pricing", "package_plans",
];

async function getExistingTables(client) {
  const res = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)",
    [TABLE_LIST]
  );
  return new Set(res.rows.map((r) => r.tablename));
}

async function main() {
  try {
    await client.connect();
    console.log("เชื่อมต่อฐานข้อมูลสำเร็จ:", config.database);

    const tablesBefore = await getExistingTables(client);

    const schema = readFileSync(schemaFullPath, "utf-8");
    await client.query(schema);

    const tablesAfter = await getExistingTables(client);
    const created = TABLE_LIST.filter((t) => !tablesBefore.has(t) && tablesAfter.has(t));
    const skipped = TABLE_LIST.filter((t) => tablesBefore.has(t));

    console.log("--- รายงาน schema ---");
    if (created.length > 0) {
      console.log("สร้างใหม่ (" + created.length + "):", created.join(", "));
    }
    if (skipped.length > 0) {
      console.log("มีอยู่แล้ว (ข้าม " + skipped.length + "):", skipped.join(", "));
    }
    console.log("สรุป: สร้างใหม่ " + created.length + " ตาราง, มีอยู่แล้ว " + skipped.length + " ตาราง");
    console.log("รัน scripts/schema-full.sql เสร็จแล้ว");

    try {
      const seed = readFileSync(seedPath, "utf-8");
      await client.query(seed);
      console.log("รัน scripts/seed.sql สำเร็จ (rooms + ref_status)");
    } catch (e) {
      console.warn("seed:", e.message);
    }
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
