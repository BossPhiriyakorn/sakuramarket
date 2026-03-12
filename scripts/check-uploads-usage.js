/**
 * ตรวจสอบว่าโฟลเดอร์ public/uploads ไฟล์ไหนถูกอ้างอิงใน DB (แผนที่, แอดมิน, ร้าน ฯลฯ)
 * และไฟล์ไหนไม่ได้ใช้แล้ว — ลบได้
 *
 * ใช้: node scripts/check-uploads-usage.js
 * ต้องมี .env (DB_*) สำหรับดึง URL จาก DB
 */
import "dotenv/config";
import pg from "pg";
import { readdirSync, statSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const UPLOADS_DIR = join(root, "public", "uploads");

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "sakuramarket",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
};

function* walkDir(dir, base = dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      yield* walkDir(full, base);
    } else if (stat.isFile() && name !== ".gitkeep") {
      yield relative(base, full).replace(/\\/g, "/");
    }
  }
}

function isUploadPath(url) {
  return typeof url === "string" && (url.includes("/uploads/") || url.includes("uploads/"));
}

function normalizedUploadPaths(urlSet) {
  const paths = new Set();
  for (const url of urlSet) {
    if (!url) continue;
    const i = url.indexOf("/uploads/");
    if (i !== -1) {
      paths.add(url.slice(i + "/uploads/".length));
      paths.add(url.slice(i)); // /uploads/xxx
    }
    const i2 = url.indexOf("uploads/");
    if (i2 !== -1) paths.add(url.slice(i2));
    paths.add(url);
  }
  return paths;
}

async function main() {
  const allReferencedUrls = new Set();
  let roomBackgrounds = [];
  let adminCmsOrMapUrls = new Set();
  let client;

  try {
    if (config.password) {
      client = new pg.Client(config);
      await client.connect();
      console.log("เชื่อมต่อ DB แล้ว — ดึง URL ที่อ้างอิงในระบบ\n");

      const q = (sql, params = []) => client.query(sql, params).then((r) => r.rows);

      // แผนที่: พื้นหลังห้อง
      const rooms = await q("SELECT id, name, background_url FROM rooms WHERE background_url IS NOT NULL AND TRIM(background_url) <> ''");
      roomBackgrounds = rooms.map((r) => ({ id: r.id, name: r.name, url: r.background_url }));
      rooms.forEach((r) => r.background_url && allReferencedUrls.add(r.background_url));

      // โซนป้าย/โปรโมทต่อห้อง (แผนที่)
      const promoZones = await q("SELECT room_id, zone_key, image_url FROM promo_zones WHERE image_url IS NOT NULL AND TRIM(image_url) <> ''");
      promoZones.forEach((r) => r.image_url && allReferencedUrls.add(r.image_url));

      // แอดมิน CMS: Item Shop
      const itemProducts = await q("SELECT id, name, image_url FROM item_shop_products WHERE image_url IS NOT NULL AND TRIM(image_url) <> ''");
      itemProducts.forEach((r) => {
        if (r.image_url) {
          allReferencedUrls.add(r.image_url);
          adminCmsOrMapUrls.add(r.image_url);
        }
      });

      // ร้าน/ลงทะเบียน/ประกาศ/เอกสาร (รวมของแอดมินที่เกี่ยวกับร้าน)
      const [shopsRows, regRows, annLogo, parcelImg, prodImg, orderImg, invImg, uvDoc, svdFile] = await Promise.all([
        q("SELECT id, logo_url, cover_url FROM shops"),
        q("SELECT id, logo_url, cover_url FROM shop_registrations"),
        q("SELECT id, logo_url FROM announcements WHERE logo_url IS NOT NULL AND TRIM(logo_url) <> ''"),
        q("SELECT id, image_url FROM parcels WHERE image_url IS NOT NULL AND TRIM(image_url) <> ''"),
        q("SELECT id, image_url FROM products WHERE image_url IS NOT NULL AND TRIM(image_url) <> ''"),
        q("SELECT id, product_image_url FROM order_items WHERE product_image_url IS NOT NULL AND TRIM(product_image_url) <> ''"),
        q("SELECT id, image_url FROM user_inventory WHERE image_url IS NOT NULL AND TRIM(image_url) <> ''"),
        client.query("SELECT document_url FROM user_verification WHERE document_url IS NOT NULL AND TRIM(document_url) <> ''").then((r) => r.rows).catch(() => []),
        client.query("SELECT file_url FROM shop_verification_documents WHERE file_url IS NOT NULL AND TRIM(file_url) <> ''").then((r) => r.rows).catch(() => []),
      ]);

      shopsRows?.forEach((r) => { r.logo_url && allReferencedUrls.add(r.logo_url); r.cover_url && allReferencedUrls.add(r.cover_url); });
      regRows?.forEach((r) => { r.logo_url && allReferencedUrls.add(r.logo_url); r.cover_url && allReferencedUrls.add(r.cover_url); });
      annLogo?.forEach((r) => r.logo_url && allReferencedUrls.add(r.logo_url));
      parcelImg?.forEach((r) => r.image_url && allReferencedUrls.add(r.image_url));
      prodImg?.forEach((r) => r.image_url && allReferencedUrls.add(r.image_url));
      orderImg?.forEach((r) => r.product_image_url && allReferencedUrls.add(r.product_image_url));
      invImg?.forEach((r) => r.image_url && allReferencedUrls.add(r.image_url));
      uvDoc?.forEach((r) => r.document_url && allReferencedUrls.add(r.document_url));
      svdFile?.forEach((r) => r.file_url && allReferencedUrls.add(r.file_url));
      promoZones.forEach((r) => r.image_url && adminCmsOrMapUrls.add(r.image_url));
      rooms.forEach((r) => r.background_url && adminCmsOrMapUrls.add(r.background_url));
    } else {
      console.log("ไม่พบ DB_PASSWORD — จะสแกนเฉพาะโฟลเดอร์ public/uploads (ไม่ตรวจจาก DB)\n");
    }

    const referencedPaths = normalizedUploadPaths(allReferencedUrls);
    const referencedPathsLower = new Set([...referencedPaths].map((p) => p.toLowerCase()));

    const used = [];
    const unused = [];
    if (!statSync(UPLOADS_DIR, { throwIfNoEntry: false })?.isDirectory()) {
      console.log("ไม่มีโฟลเดอร์ public/uploads\n");
      return;
    }
    for (const rel of walkDir(UPLOADS_DIR)) {
      const fullUrl = "/uploads/" + rel;
      const isUsed = referencedPaths.has(rel) || referencedPaths.has(fullUrl) || referencedPathsLower.has(rel) || referencedPathsLower.has(fullUrl)
        || [...allReferencedUrls].some((u) => u && (u.includes(rel) || u.endsWith(rel.split("/").pop())));

      if (isUsed) used.push(rel);
      else unused.push(rel);
    }

    // ——— รายงาน ———
    console.log("========== แผนที่ (rooms.background_url) ตอนนี้ใช้อันไหนบ้าง ==========");
    if (roomBackgrounds.length === 0) console.log("  (ไม่มีห้องที่ตั้งพื้นหลังจากอัปโหลด — ใช้ constant หรือว่าง)");
    else roomBackgrounds.forEach((r) => console.log(`  ห้อง ${r.id} (${r.name || "-"}): ${r.url}`));

    console.log("\n========== ของแอดมิน (CMS/แผนที่) ที่อ้างอิง URL อัปโหลด ==========");
    const adminList = [...adminCmsOrMapUrls].filter(isUploadPath);
    if (adminList.length === 0) console.log("  (ไม่มีหรือเก็บใน Drive ไม่ใช่ /uploads/)");
    else adminList.forEach((u) => console.log(`  ${u}`));

    console.log("\n========== ไฟล์ใน public/uploads ที่ยังถูกอ้างอิง (ใช้อยู่) ==========");
    if (used.length === 0) console.log("  (ไม่มี หรือระบบใช้ Google Drive ไม่เก็บในโฟลเดอร์นี้)");
    else used.forEach((p) => console.log(`  ${p}`));

    console.log("\n========== ไฟล์ใน public/uploads ที่ไม่ได้ใช้แล้ว — ลบได้ ==========");
    if (unused.length === 0) console.log("  (ไม่มี)");
    else unused.forEach((p) => console.log(`  ${p}`));

    console.log("\nสรุป: ใช้อยู่ " + used.length + " ไฟล์, ไม่ได้ใช้ " + unused.length + " ไฟล์ (ลบได้)");

    const shouldDelete = process.argv.includes("--delete");
    if (shouldDelete && unused.length > 0) {
      const { unlinkSync } = await import("fs");
      for (const rel of unused) {
        const full = join(UPLOADS_DIR, rel);
        try {
          unlinkSync(full);
          console.log("ลบแล้ว: " + rel);
        } catch (e) {
          console.error("ลบไม่สำเร็จ " + rel + ":", e.message);
        }
      }
      console.log("ลบไฟล์ที่ไม่ได้ใช้แล้ว " + unused.length + " ไฟล์");
    } else if (shouldDelete && unused.length === 0) {
      console.log("ไม่มีไฟล์ที่ลบได้");
    }
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  } finally {
    if (client) await client.end();
  }
}

main();
