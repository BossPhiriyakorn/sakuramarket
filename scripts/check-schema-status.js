/**
 * ตรวจสอบโครงสร้าง DB (ตาราง + คอลัมน์สำคัญ) เทียบ schema ปัจจุบัน
 * ใช้: node scripts/check-schema-status.js
 */
import "dotenv/config";
import pg from "pg";

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

const REQUIRED_COLUMNS = {
  user_presence: ["user_id", "last_seen_at"],
  rooms: ["background_url", "slot_price_per_day", "min_rent_days"],
  announcements: ["link_url", "logo_url", "announcement_source", "expires_at"],
  products: ["stock_quantity", "status", "recommended"],
  shop_registrations: ["cover_url", "address_id", "use_same_as_user_address"],
  shops: ["cover_url", "market_display_url", "verification_status", "membership_plan", "address_id", "use_same_as_user_address"],
  user_verification: ["status", "document_url", "verified", "verified_at"],
  shop_payouts: ["status", "paid_at", "amount", "shop_id"],
  parcel_booking_audit: ["slot_count", "outcome", "actor_type", "actor_id"],
};

const client = new pg.Client({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "sakuramarket",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
});

async function main() {
  try {
    await client.connect();
    const tableRes = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    const existing = new Set(tableRes.rows.map((r) => String(r.tablename)));
    const missingTables = TABLE_LIST.filter((t) => !existing.has(t));

    console.log("=== TABLE STATUS ===");
    console.log(`expected=${TABLE_LIST.length}, existing=${existing.size}, missing=${missingTables.length}`);
    if (missingTables.length > 0) {
      console.log("missing_tables:", missingTables.join(", "));
    } else {
      console.log("missing_tables: none");
    }

    console.log("\n=== COLUMN STATUS ===");
    let totalMissingColumns = 0;
    for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
      const colRes = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = $1",
        [table]
      );
      const existingCols = new Set(colRes.rows.map((r) => String(r.column_name)));
      const missingCols = cols.filter((c) => !existingCols.has(c));
      totalMissingColumns += missingCols.length;
      if (missingCols.length === 0) {
        console.log(`${table}: OK`);
      } else {
        console.log(`${table}: MISSING -> ${missingCols.join(", ")}`);
      }
    }

    console.log(`\nsummary_missing_columns=${totalMissingColumns}`);
    process.exitCode = missingTables.length > 0 || totalMissingColumns > 0 ? 1 : 0;
  } catch (err) {
    console.error("schema check error:", err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
