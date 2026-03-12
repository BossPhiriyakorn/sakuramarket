/**
 * Data store ที่อ่าน/เขียนจาก PostgreSQL
 * แทนที่ in-memory mock ใน dataStore.ts
 */
import { query } from "@/lib/db";
import { withTransaction } from "@/lib/dbTransaction";
import type { PoolClient } from "pg";
import type { Parcel, Announcement } from "@/types";

/** โหมดเดโม: ไม่หักเงิน (user_balances) และไม่หักเครดิตโฆษณา (user_ad_credits) — ตั้ง DEMO_MODE=true ใน .env */
function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

function hexToColor(hex: string | null | undefined): number {
  if (!hex || typeof hex !== "string") return 0xec4899;
  const s = hex.replace(/^#/, "");
  const n = parseInt(s, 16);
  return Number.isNaN(n) ? 0xec4899 : n;
}

// ==================== Rooms ====================
export async function getRooms(): Promise<{ id: number; name: string; background_url: string | null; slot_price_per_day: number; min_rent_days: number }[]> {
  const res = await query<{ id: number; name: string; background_url: string | null; slot_price_per_day: string; min_rent_days: number }>(
    "SELECT id, name, background_url, COALESCE(slot_price_per_day, 0)::numeric AS slot_price_per_day, COALESCE(min_rent_days, 1) AS min_rent_days FROM rooms ORDER BY id"
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    background_url: r.background_url,
    slot_price_per_day: Number(r.slot_price_per_day) || 0,
    min_rent_days: Number(r.min_rent_days) || 1,
  }));
}

/** ตรวจว่า room id มีในตาราง rooms หรือไม่ */
export async function roomExists(roomId: number): Promise<boolean> {
  if (!Number.isInteger(roomId) || roomId < 1) return false;
  const res = await query<{ id: number }>("SELECT id FROM rooms WHERE id = $1 LIMIT 1", [roomId]);
  return res.rows.length > 0;
}

export async function updateRoom(
  id: number,
  data: { name?: string; background_url?: string | null; slot_price_per_day?: number; min_rent_days?: number }
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(data.name); }
  if (data.background_url !== undefined) { sets.push(`background_url = $${idx++}`); values.push(data.background_url); }
  if (data.slot_price_per_day !== undefined) {
    const v = typeof data.slot_price_per_day === "number" && data.slot_price_per_day >= 0 ? data.slot_price_per_day : 0;
    sets.push(`slot_price_per_day = $${idx++}`);
    values.push(v);
  }
  if (data.min_rent_days !== undefined) {
    const v = typeof data.min_rent_days === "number" && data.min_rent_days >= 1 ? data.min_rent_days : 1;
    sets.push(`min_rent_days = $${idx++}`);
    values.push(v);
  }
  if (sets.length === 0) return;
  values.push(id);
  await query(`UPDATE rooms SET ${sets.join(", ")} WHERE id = $${idx}`, values);
}

// ==================== Ref สถานะ (แสดง label ใน UI) ====================
export async function getRefStatus(type?: string): Promise<{ type: string; code: string; label_th: string }[]> {
  if (type) {
    const res = await query<{ type: string; code: string; label_th: string }>(
      "SELECT type, code, label_th FROM ref_status WHERE type = $1 ORDER BY code",
      [type]
    );
    return res.rows;
  }
  const res = await query<{ type: string; code: string; label_th: string }>(
    "SELECT type, code, label_th FROM ref_status ORDER BY type, code"
  );
  return res.rows;
}

// ==================== Parcels สำหรับแผนที่ ====================
export async function getParcelsForRoom(roomId: number): Promise<Parcel[]> {
  const parcelsRes = await query<{
    id: string;
    owner_id: string;
    owner_display_name: string | null;
    owner_avatar_url: string | null;
    title: string;
    grid_x: number;
    grid_y: number;
    width: number;
    height: number;
    is_label: boolean | null;
    image_url: string | null;
  }>(
    `SELECT p.id, p.owner_id, p.title, p.grid_x, p.grid_y, p.width, p.height, p.is_label,
            COALESCE(p.image_url, '') AS image_url,
            COALESCE(
              NULLIF(TRIM(pr.display_name), ''),
              NULLIF(TRIM(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')), '')
            ) AS owner_display_name,
            pr.avatar_url AS owner_avatar_url
     FROM parcels p
     LEFT JOIN profiles pr ON pr.user_id = p.owner_id
     WHERE p.room_id = $1
     ORDER BY p.grid_y, p.grid_x`,
    [roomId]
  );
  const list: Parcel[] = [];
  const parcelIds = [...new Set(parcelsRes.rows.map((p) => p.id).filter(Boolean))];
  const ownerIds = [...new Set(parcelsRes.rows.map((p) => p.owner_id).filter(Boolean))];

  const shopsByParcel = new Map<
    string,
    {
      shop_id: string;
      shop_name: string;
      logo_url: string | null;
      cover_url: string | null;
      market_display_url: string | null;
      logo_background_color: string | null;
      verification_status: string;
    }
  >();
  if (parcelIds.length > 0) {
    const placeholders = parcelIds.map((_, i) => `$${i + 1}`).join(", ");
    const shopRows = await query<{
      parcel_id: string;
      shop_id: string;
      shop_name: string;
      logo_url: string | null;
      cover_url: string | null;
      market_display_url: string | null;
      logo_background_color: string | null;
      verification_status: string;
    }>(
      `SELECT DISTINCT ON (x.parcel_id)
          x.parcel_id, x.shop_id, x.shop_name, x.logo_url, x.cover_url, x.market_display_url, x.logo_background_color, x.verification_status
       FROM (
         SELECT s.parcel_id, s.id AS shop_id, s.shop_name, s.logo_url, s.cover_url, s.market_display_url, s.logo_background_color, s.verification_status, 0 AS priority
         FROM shops s
         WHERE s.parcel_id IN (${placeholders})
         UNION ALL
         SELECT sp.parcel_id, s.id AS shop_id, s.shop_name, s.logo_url, s.cover_url, s.market_display_url, s.logo_background_color, s.verification_status, 1 AS priority
         FROM shop_parcels sp
         JOIN shops s ON s.id = sp.shop_id
         WHERE sp.parcel_id IN (${placeholders})
       ) x
       ORDER BY x.parcel_id, x.priority ASC`,
      parcelIds
    );
    for (const row of shopRows.rows) {
      shopsByParcel.set(row.parcel_id, row);
    }
  }

  const regsByOwner = new Map<string, { description: string; logo_url: string | null; cover_url: string | null }>();
  if (ownerIds.length > 0) {
    const placeholders = ownerIds.map((_, i) => `$${i + 1}`).join(", ");
    const regRows = await query<{
      user_id: string;
      description: string;
      logo_url: string | null;
      cover_url: string | null;
    }>(
      `SELECT DISTINCT ON (sr.user_id)
          sr.user_id, COALESCE(sr.description, '') AS description, sr.logo_url, sr.cover_url
       FROM shop_registrations sr
       WHERE sr.user_id IN (${placeholders})
       ORDER BY sr.user_id, sr.created_at DESC`,
      ownerIds
    );
    for (const row of regRows.rows) {
      regsByOwner.set(row.user_id, {
        description: row.description ?? "",
        logo_url: row.logo_url ?? null,
        cover_url: row.cover_url ?? null,
      });
    }
  }

  const ownerVerifiedMap = new Map<string, boolean>();
  if (ownerIds.length > 0) {
    const placeholders = ownerIds.map((_, i) => `$${i + 1}`).join(", ");
    const verRows = await query<{ user_id: string; verified: boolean }>(
      `SELECT user_id, COALESCE(verified, false) AS verified
       FROM user_verification
       WHERE user_id IN (${placeholders})`,
      ownerIds
    );
    for (const row of verRows.rows) {
      ownerVerifiedMap.set(row.user_id, row.verified ?? false);
    }
  }

  for (const p of parcelsRes.rows) {
    const shop = shopsByParcel.get(p.id);
    const reg = regsByOwner.get(p.owner_id);
    const description = reg?.description ?? "";
    // รูปแสดงบนแผนที่: ใช้รูปที่ร้านตั้งใน "แสดงในแผนที่" (market_display_url) ก่อน ถ้าไม่มีค่อยใช้โลโก้/ cover
    const marketDisplayUrl = (shop?.market_display_url ?? "").trim();
    const logoUrl = (shop?.logo_url ?? "").trim();
    const coverUrl = (shop?.cover_url ?? "").trim();
    const parcelImageUrl = (p.image_url ?? "").trim();
    const regLogo = (reg?.logo_url ?? "").trim();
    const regCover = (reg?.cover_url ?? "").trim();
    const imageUrl = marketDisplayUrl || logoUrl || coverUrl || parcelImageUrl || regLogo || regCover;
    const color = shop?.logo_background_color ? hexToColor(shop.logo_background_color) : 0xec4899;
    const ownerVerified = ownerVerifiedMap.get(p.owner_id) ?? false;
    list.push({
      id: p.id,
      owner_id: p.owner_id,
      owner_display_name: p.owner_display_name ?? undefined,
      owner_avatar_url: p.owner_avatar_url ?? undefined,
      title: p.title,
      description,
      image_url: imageUrl,
      grid_x: p.grid_x,
      grid_y: p.grid_y,
      width: p.width,
      height: p.height,
      color: p.is_label ? 0xec4899 : color,
      is_label: p.is_label ?? false,
      verification_status: shop?.verification_status,
      owner_verified: ownerVerified,
      shop_id: shop?.shop_id,
    });
  }
  const shopIdsForAd = list.filter((x) => (x as Parcel & { shop_id?: string }).shop_id).map((x) => (x as Parcel & { shop_id: string }).shop_id);
  if (shopIdsForAd.length > 0) {
    const adInfoMap = await getShopAdInfoByShopIds(shopIdsForAd);
    for (const item of list) {
      const sid = (item as Parcel & { shop_id?: string }).shop_id;
      if (sid) {
        const info = adInfoMap.get(sid);
        (item as Parcel & { has_active_ad?: boolean; ad_total_spend?: number }).has_active_ad = info?.hasActive ?? false;
        (item as Parcel & { has_active_ad?: boolean; ad_total_spend?: number }).ad_total_spend = info?.totalSpend ?? 0;
      }
    }
  }
  const promoRes = await query<{ zone_key: string; is_label: boolean; image_url: string | null }>(
    "SELECT zone_key, is_label, image_url FROM promo_zones WHERE room_id = $1",
    [roomId]
  );
  for (const promo of promoRes.rows) {
    if (!promo.is_label || !promo.zone_key.startsWith("cell:")) continue;
    const match = promo.zone_key.slice(5).match(/^(\d+),(\d+)$/);
    if (!match) continue;
    const grid_x = parseInt(match[1], 10);
    const grid_y = parseInt(match[2], 10);
    list.push({
      id: promo.zone_key,
      owner_id: "admin",
      title: "โซนป้าย/โปรโมท",
      description: "",
      image_url: promo.image_url ?? "",
      grid_x,
      grid_y,
      width: 1,
      height: 1,
      color: 0xec4899,
      is_label: true,
    });
  }
  return list;
}

// ==================== Announcements ====================
/** ประวัติประกาศต่อห้อง (มี created_at สำหรับโซนประวัติ ไม่เกี่ยวกับแถบ Live) */
export type AnnouncementWithDate = Announcement & { createdAt?: string };

/** แถบ Live: เฉพาะประกาศวิ่ง (megaphone) ที่ยังไม่หมดอายุตามแพ็กเกจ พร้อม link_url ให้กดได้ */
export async function getAnnouncementsForRoom(roomId: number): Promise<Announcement[]> {
  const res = await query<{ id: string; shop_name: string; lock_label: string | null; message: string; link_url: string | null; created_at: string }>(
    `SELECT id, shop_name, lock_label, message, link_url, created_at FROM announcements
     WHERE room_id = $1 AND (announcement_source = 'megaphone' OR announcement_source IS NULL)
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC`,
    [roomId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    shopName: r.shop_name,
    lockLabel: r.lock_label ?? null,
    message: r.message,
    linkUrl: r.link_url ?? null,
  }));
}

/** คืนประวัติประกาศต่อห้อง — เฉพาะป้ายประกาศ (board) 24 ชม. ล่าสุด พร้อมห้องที่ประกาศ + ล็อคที่ร้านอยู่ */
export async function getAnnouncementsHistoryForRoom(roomId: number): Promise<(AnnouncementWithDate & { linkUrl?: string | null; logoUrl?: string | null; lockLabel?: string | null; shopId?: string | null; parcelId?: string | null; roomId?: number; roomName?: string | null })[]> {
  const res = await query<{ id: string; shop_id: string | null; shop_name: string; lock_label: string | null; message: string; created_at: string; link_url: string | null; logo_url: string | null; parcel_id: string | null; room_id: number; room_name: string | null }>(
    `SELECT a.id, a.shop_id, a.shop_name, a.lock_label, a.message, a.created_at, a.link_url, a.logo_url, s.parcel_id, a.room_id, r.name AS room_name
     FROM announcements a
     LEFT JOIN shops s ON s.id = a.shop_id
     LEFT JOIN rooms r ON r.id = a.room_id
     WHERE a.room_id = $1 AND a.announcement_source = 'board' AND a.created_at >= (now() - interval '24 hours')
     ORDER BY a.created_at DESC`,
    [roomId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    shopName: r.shop_name,
    lockLabel: r.lock_label ?? null,
    message: r.message,
    createdAt: new Date(r.created_at).toISOString(),
    linkUrl: r.link_url ?? null,
    logoUrl: r.logo_url ?? null,
    shopId: r.shop_id ?? null,
    parcelId: r.parcel_id ?? null,
    roomId: r.room_id,
    roomName: r.room_name ?? null,
  }));
}

// ==================== Parcels รายการเต็ม (สำหรับ CMS จัดการล็อค) ====================
export async function getParcelsAllForAdmin(): Promise<{
  id: string;
  room_id: number;
  grid_x: number;
  grid_y: number;
  width: number;
  height: number;
  title: string;
  description: string;
  image_url: string | null;
}[]> {
  const res = await query<{
    id: string;
    room_id: number;
    grid_x: string;
    grid_y: string;
    width: string;
    height: string;
    title: string;
    description: string;
    image_url: string | null;
  }>(
    "SELECT id, room_id, grid_x, grid_y, width, height, title, COALESCE(description, '') AS description, image_url FROM parcels ORDER BY room_id, grid_y, grid_x"
  );
  return res.rows.map((r) => ({
    id: r.id,
    room_id: r.room_id,
    grid_x: parseInt(r.grid_x ?? "0", 10),
    grid_y: parseInt(r.grid_y ?? "0", 10),
    width: parseInt(r.width ?? "1", 10),
    height: parseInt(r.height ?? "1", 10),
    title: r.title ?? "",
    description: r.description ?? "",
    image_url: r.image_url ?? null,
  }));
}

// ==================== Dashboard / getData ====================
export async function getData(): Promise<{
  users: { id: string }[];
  rooms: { id: number; name: string }[];
  parcels: { id: string }[];
  shopRegistrations: { id: string }[];
  shops: { id: string }[];
  verificationDocuments: { id: string }[];
  announcements: { id: string }[];
  orders: { id: string }[];
}> {
  const [usersRes, roomsRes, parcelsRes, regRes, shopsRes, vdRes, annRes, ordersRes] = await Promise.all([
    query<{ id: string }>("SELECT id FROM users"),
    query<{ id: number; name: string }>("SELECT id, name FROM rooms ORDER BY id"),
    query<{ id: string }>("SELECT id FROM parcels"),
    query<{ id: string }>("SELECT id FROM shop_registrations"),
    query<{ id: string }>("SELECT id FROM shops"),
    query<{ id: string }>("SELECT id FROM shop_verification_documents"),
    query<{ id: string }>("SELECT id FROM announcements"),
    query<{ id: string }>("SELECT id FROM orders"),
  ]);
  return {
    users: usersRes.rows,
    rooms: roomsRes.rows,
    parcels: parcelsRes.rows,
    shopRegistrations: regRes.rows,
    shops: shopsRes.rows,
    verificationDocuments: vdRes.rows,
    announcements: annRes.rows,
    orders: ordersRes.rows,
  };
}

export async function getNotificationsTodayCount(): Promise<number> {
  const res = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM notifications WHERE created_at >= current_date"
  );
  return parseInt(res.rows[0]?.count ?? "0", 10);
}

// ==================== User verification & balance ====================
export type UserVerificationStatus = "pending" | "verified" | "rejected";

export async function getUserVerification(
  userId: string
): Promise<{ verified: boolean; verified_at: string | null; status?: string; document_url?: string | null } | null> {
  const res = await query<{ verified: boolean; verified_at: string | null; status: string | null; document_url: string | null }>(
    "SELECT verified, verified_at, status, document_url FROM user_verification WHERE user_id = $1",
    [userId]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    verified: row.verified,
    verified_at: row.verified_at,
    status: row.status ?? undefined,
    document_url: row.document_url ?? undefined,
  };
}

/** ผู้ใช้ส่งเอกสารยืนยันตัวตน — ตั้งเป็นรอแอดมินตรวจสอบ (pending) */
export async function submitUserVerificationDocument(userId: string, documentUrl: string): Promise<void> {
  await query(
    `INSERT INTO user_verification (user_id, verified, verified_at, status, document_url)
     VALUES ($1, false, null, 'pending', $2)
     ON CONFLICT (user_id) DO UPDATE SET verified = false, verified_at = null, status = 'pending', document_url = $2`,
    [userId, documentUrl]
  );
}

/** แอดมินอนุมัติหรือปฏิเสธการยืนยันตัวตน */
export async function setUserVerificationStatus(userId: string, status: "verified" | "rejected"): Promise<void> {
  await query(
    `UPDATE user_verification SET verified = ($2 = 'verified'), verified_at = CASE WHEN $2 = 'verified' THEN now() ELSE null END, status = $2 WHERE user_id = $1`,
    [userId, status]
  );
}

/** @deprecated ใช้ setUserVerificationStatus(userId, 'verified') แทน */
export async function setUserVerified(userId: string): Promise<void> {
  await setUserVerificationStatus(userId, "verified");
}

export async function getBalanceByUserId(userId: string): Promise<number> {
  const res = await query<{ balance: string }>("SELECT balance FROM user_balances WHERE user_id = $1", [
    userId,
  ]);
  const row = res.rows[0];
  return row ? parseFloat(row.balance) : 0;
}

/** เครดิตโฆษณาสำหรับผู้ใช้ (ใช้เปิดแคมเปญโฆษณาเท่านั้น) */
export async function getAdCreditsByUserId(userId: string): Promise<number> {
  const res = await query<{ credits: string }>(
    "SELECT credits::text AS credits FROM user_ad_credits WHERE user_id = $1",
    [userId]
  );
  const row = res.rows[0];
  return row ? parseFloat(row.credits) : 0;
}

// ==================== Package plans (แพ็กเกจสมาชิก) ====================
export type PackagePlanRow = {
  plan_key: string;
  name_th: string;
  duration_days: number;
  max_categories: number;
  max_products_visible: number;
  map_expansion_limit: number;
  ad_credits_granted: number;
  sort_order: number;
  price_credits: number;
}

export async function getPackagePlans(): Promise<PackagePlanRow[]> {
  const baseCols = "plan_key, name_th, duration_days, max_categories, max_products_visible, map_expansion_limit, ad_credits_granted, sort_order";
  type Row = {
    plan_key: string;
    name_th: string;
    duration_days: string;
    max_categories: string;
    max_products_visible: string;
    map_expansion_limit: string;
    ad_credits_granted: string;
    sort_order: string;
    price_credits?: string;
  };
  try {
    const res = await query<Row>(
      `SELECT ${baseCols}, COALESCE(price_credits, 0)::int AS price_credits FROM package_plans ORDER BY sort_order`
    );
    return res.rows.map((r) => ({
      plan_key: r.plan_key,
      name_th: r.name_th,
      duration_days: parseInt(r.duration_days ?? "0", 10),
      max_categories: parseInt(r.max_categories ?? "0", 10),
      max_products_visible: parseInt(r.max_products_visible ?? "0", 10),
      map_expansion_limit: parseInt(r.map_expansion_limit ?? "0", 10),
      ad_credits_granted: parseInt(r.ad_credits_granted ?? "0", 10),
      sort_order: parseInt(r.sort_order ?? "0", 10),
      price_credits: parseInt(r.price_credits ?? "0", 10),
    }));
  } catch (err) {
    const msg = String(err ?? "");
    if (msg.includes("price_credits") || msg.includes("column") || msg.includes("does not exist")) {
      const res = await query<Row>(`SELECT ${baseCols} FROM package_plans ORDER BY sort_order`);
      return res.rows.map((r) => ({
        plan_key: r.plan_key,
        name_th: r.name_th,
        duration_days: parseInt(r.duration_days ?? "0", 10),
        max_categories: parseInt(r.max_categories ?? "0", 10),
        max_products_visible: parseInt(r.max_products_visible ?? "0", 10),
        map_expansion_limit: parseInt(r.map_expansion_limit ?? "0", 10),
        ad_credits_granted: parseInt(r.ad_credits_granted ?? "0", 10),
        sort_order: parseInt(r.sort_order ?? "0", 10),
        price_credits: 0,
      }));
    }
    throw err;
  }
}

/** อัปเดตแพ็กเกจ (CMS) — ใช้แค่คอลัมน์ที่มีใน package_plans */
export async function updatePackagePlan(
  planKey: string,
  updates: Partial<Pick<PackagePlanRow, "name_th" | "duration_days" | "max_categories" | "max_products_visible" | "map_expansion_limit" | "ad_credits_granted" | "sort_order" | "price_credits">>
): Promise<{ error?: string }> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (updates.name_th !== undefined) { setClauses.push(`name_th = $${idx++}`); values.push(updates.name_th); }
  if (updates.duration_days !== undefined) { setClauses.push(`duration_days = $${idx++}`); values.push(updates.duration_days); }
  if (updates.max_categories !== undefined) { setClauses.push(`max_categories = $${idx++}`); values.push(updates.max_categories); }
  if (updates.max_products_visible !== undefined) { setClauses.push(`max_products_visible = $${idx++}`); values.push(updates.max_products_visible); }
  if (updates.map_expansion_limit !== undefined) { setClauses.push(`map_expansion_limit = $${idx++}`); values.push(updates.map_expansion_limit); }
  if (updates.ad_credits_granted !== undefined) { setClauses.push(`ad_credits_granted = $${idx++}`); values.push(updates.ad_credits_granted); }
  if (updates.sort_order !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(updates.sort_order); }
  if (updates.price_credits !== undefined) { setClauses.push(`price_credits = $${idx++}`); values.push(updates.price_credits); }
  if (setClauses.length === 0) return {};
  values.push(planKey);
  await query(
    `UPDATE package_plans SET ${setClauses.join(", ")} WHERE plan_key = $${idx}`,
    values
  );
  return {};
}

/** ลบแพ็กเกจ — ได้เฉพาะเมื่อไม่มีร้านใช้แผนนี้ */
export async function deletePackagePlan(planKey: string): Promise<{ error?: string }> {
  const countRes = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM shops WHERE membership_plan = $1",
    [planKey]
  );
  const count = parseInt(countRes.rows[0]?.count ?? "0", 10);
  if (count > 0) {
    return { error: `มีร้านที่ใช้แพ็กเกจนี้อยู่ ${count} ร้าน ลบไม่ได้` };
  }
  await query("DELETE FROM package_plans WHERE plan_key = $1", [planKey]);
  return {};
}

/** รายได้แพลตฟอร์ม: ผู้ใช้สมัครแพ็กเกจร้าน (หักเหรียญ + ตั้ง membership_plan + ให้เครดิตโฆษณาแยก) — ไม่มี shop_payouts */
export async function subscribeShopToPlan(userId: string, planKey: string): Promise<{ error?: string }> {
  return withTransaction(async (client) => {
    const planRes = await client.query(
      "SELECT plan_key, duration_days, COALESCE(price_credits, 0)::int AS price_credits, COALESCE(ad_credits_granted, 0)::int AS ad_credits_granted FROM package_plans WHERE plan_key = $1",
      [planKey]
    );
    const plan = planRes.rows[0];
    if (!plan) return { error: "ไม่พบแพ็กเกจนี้" };

    const price = parseInt(plan.price_credits ?? "0", 10);
    const adCredits = Math.max(0, parseInt(plan.ad_credits_granted ?? "0", 10));

    if (price > 0 && !isDemoMode()) {
      const balRes = await client.query<{ balance: string }>(
        "SELECT balance::text AS balance FROM user_balances WHERE user_id = $1 FOR UPDATE",
        [userId]
      );
      const balance = parseFloat(balRes.rows[0]?.balance ?? "0");
      if (balance < price) return { error: `เหรียญไม่เพียงพอ (มี ${balance} เหรียญ ต้องใช้ ${price} เหรียญ)` };
      await client.query(
        "UPDATE user_balances SET balance = balance - $2 WHERE user_id = $1",
        [userId, price]
      );
    }

    const shopRes = await client.query<{ id: string; membership_expires_at: string | null }>(
      "SELECT id, membership_expires_at FROM shops WHERE user_id = $1",
      [userId]
    );
    const shop = shopRes.rows[0];
    if (!shop) return { error: "กรุณาลงทะเบียนร้านก่อนจึงจะสมัครแพ็กเกจได้" };

    const durationDays = parseInt(plan.duration_days ?? "0", 10);
    let newExpires: Date;
    const now = new Date();
    const currentExp = shop.membership_expires_at ? new Date(shop.membership_expires_at) : null;
    if (currentExp && currentExp.getTime() > now.getTime()) {
      newExpires = new Date(currentExp.getTime() + durationDays * 24 * 60 * 60 * 1000);
    } else {
      newExpires = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    await client.query(
      "UPDATE shops SET membership_plan = $2, membership_expires_at = $3, updated_at = now() WHERE id = $1",
      [shop.id, planKey, newExpires.toISOString()]
    );
    if (price > 0 && !isDemoMode()) {
      await client.query(
        `INSERT INTO platform_revenue_log (user_id, type, amount, plan_key) VALUES ($1, 'package', $2, $3)`,
        [userId, price, planKey]
      );
    }

    // ให้เครดิตโฆษณาตามที่แพ็กเกจกำหนด (เก็บแยกจากกระเป๋าเหรียญที่ใช้ซื้อสินค้า)
    if (adCredits > 0) {
      await client.query(
        `INSERT INTO user_ad_credits (user_id, credits) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET credits = user_ad_credits.credits + EXCLUDED.credits`,
        [userId, adCredits]
      );
    }
    return {};
  });
}

// ==================== Shops ====================
export async function getShopByUserId(userId: string): Promise<{
  id: string;
  verification_status: string;
  shop_name: string;
  description: string;
  parcel_id: string | null;
  user_id: string;
  logo_url: string | null;
  logo_background_color: string | null;
  cover_url: string | null;
  market_display_url: string | null;
  membership_plan: string | null;
  membership_expires_at: string | null;
} | null> {
  const res = await query<{
    id: string;
    verification_status: string;
    shop_name: string;
    description: string;
    parcel_id: string | null;
    user_id: string;
    logo_url: string | null;
    logo_background_color: string | null;
    cover_url: string | null;
    market_display_url: string | null;
    membership_plan: string | null;
    membership_expires_at: string | null;
  }>("SELECT id, verification_status, shop_name, description, parcel_id, user_id, logo_url, logo_background_color, cover_url, market_display_url, membership_plan, membership_expires_at FROM shops WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [
    userId,
  ]);
  return res.rows[0] ?? null;
}

// ==================== Shop Ads & Analytics ====================
/** สร้างแคมเปญโฆษณา: แบบคลิกเท่านั้น — หักเครดิต/เหรียญ แล้ว insert shop_ads */
export async function createShopAd(
  shopId: string,
  userId: string,
  options: { ad_type: "clicks"; clicks_count: number }
): Promise<{ id: string; end_at: string }> {
  return withTransaction(async (client: PoolClient) => {
    const shopRow = await client.query<{ user_id: string }>("SELECT user_id FROM shops WHERE id = $1", [shopId]);
    if (!shopRow.rows[0] || shopRow.rows[0].user_id !== userId) {
      throw new Error("ไม่พบร้านหรือไม่มีสิทธิ์");
    }
    const count = Math.max(1, Math.min(99999, Math.floor(options.clicks_count)));
    const priceRes = await client.query<{ coins_per_click: string }>("SELECT COALESCE(coins_per_click, 1)::numeric::text AS coins_per_click FROM ad_click_pricing WHERE id = 1 LIMIT 1");
    const coinsPerClick = parseFloat(priceRes.rows[0]?.coins_per_click ?? "1");
    const amount = count * coinsPerClick;
    const endAt = new Date();
    endAt.setFullYear(endAt.getFullYear() + 100);

    if (amount > 0 && !isDemoMode()) {
      const adRow = await client.query<{ credits: string }>(
        "SELECT credits::text AS credits FROM user_ad_credits WHERE user_id = $1 FOR UPDATE",
        [userId]
      );
      const adCredits = parseFloat(adRow.rows[0]?.credits ?? "0");
      const fromAd = Math.min(adCredits, amount);
      const fromCoins = amount - fromAd;

      if (fromCoins > 0) {
        const balanceRow = await client.query<{ balance: string }>(
          "SELECT balance::text AS balance FROM user_balances WHERE user_id = $1 FOR UPDATE",
          [userId]
        );
        const balance = parseFloat(balanceRow.rows[0]?.balance ?? "0");
        if (balance < fromCoins) {
          throw new Error(
            `ยอดไม่เพียงพอ — เครดิตโฆษณา ${adCredits} เหรียญ เหรียญในกระเป๋า ${balance} เหรียญ ต้องการรวม ${amount} เหรียญ`
          );
        }
        await client.query("UPDATE user_balances SET balance = balance - $2 WHERE user_id = $1", [userId, fromCoins]);
      }

      if (fromAd > 0) {
        await client.query("UPDATE user_ad_credits SET credits = credits - $2 WHERE user_id = $1", [userId, fromAd]);
      }
    }

    const res = await client.query<{ id: string; end_at: Date }>(
      `INSERT INTO shop_ads (shop_id, amount_paid, days, end_at, ad_type, clicks_purchased, clicks_used)
       VALUES ($1, $2, NULL, $3, 'clicks', $4, 0)
       RETURNING id, end_at`,
      [shopId, amount, endAt.toISOString(), count]
    );
    const row = res.rows[0];
    if (!row) throw new Error("สร้างแคมเปญโฆษณาไม่สำเร็จ");
    return { id: row.id, end_at: row.end_at.toISOString() };
  });
}

/** แคมเปญโฆษณาที่ยังไม่หมดอายุ (หรือแบบคลิกยังมีคลิกเหลือ) ของร้าน */
export async function getActiveShopAd(shopId: string): Promise<{ id: string; amount_paid: number; end_at: string } | null> {
  const res = await query<{ id: string; amount_paid: string; end_at: Date }>(
    `SELECT id, amount_paid::text AS amount_paid, end_at FROM shop_ads WHERE shop_id = $1 AND end_at > now()
     AND (ad_type = 'days' OR (ad_type = 'clicks' AND COALESCE(clicks_used, 0) < COALESCE(clicks_purchased, 0)))
     ORDER BY end_at DESC LIMIT 1`,
    [shopId]
  );
  const r = res.rows[0];
  if (!r) return null;
  return { id: r.id, amount_paid: parseFloat(r.amount_paid), end_at: r.end_at instanceof Date ? r.end_at.toISOString() : String(r.end_at) };
}

/** ยอดโฆษณารวมที่จ่ายแล้วของร้าน (สำหรับเรียงรายการ: ใครจ่ายมากอยู่บน) — นับแคมเปญที่สร้างไปแล้ว */
export async function getShopAdTotalSpend(shopId: string): Promise<number> {
  const res = await query<{ sum: string }>(
    "SELECT COALESCE(SUM(amount_paid), 0)::text AS sum FROM shop_ads WHERE shop_id = $1",
    [shopId]
  );
  return parseFloat(res.rows[0]?.sum ?? "0");
}

/** ข้อมูลโฆษณาต่อร้าน (มีโฆษณาค้างอยู่หรือไม่ + ยอดจ่ายรวม) — ใช้เรียงรายการร้านค้า + แสดงป้าย ad */
export async function getShopAdInfoByShopIds(
  shopIds: string[]
): Promise<Map<string, { hasActive: boolean; totalSpend: number }>> {
  const map = new Map<string, { hasActive: boolean; totalSpend: number }>();
  if (shopIds.length === 0) return map;
  const placeholders = shopIds.map((_, i) => `$${i + 1}`).join(", ");
  const spendRes = await query<{ shop_id: string; sum: string }>(
    `SELECT shop_id, COALESCE(SUM(amount_paid), 0)::text AS sum FROM shop_ads WHERE shop_id IN (${placeholders}) GROUP BY shop_id`,
    shopIds
  );
  const activeRes = await query<{ shop_id: string }>(
    `SELECT DISTINCT shop_id FROM shop_ads WHERE shop_id IN (${placeholders}) AND end_at > now()
     AND (ad_type = 'days' OR (ad_type = 'clicks' AND COALESCE(clicks_used, 0) < COALESCE(clicks_purchased, 0)))`,
    shopIds
  );
  const activeSet = new Set(activeRes.rows.map((r) => r.shop_id));
  for (const id of shopIds) {
    const row = spendRes.rows.find((r) => r.shop_id === id);
    map.set(id, {
      hasActive: activeSet.has(id),
      totalSpend: row ? parseFloat(row.sum ?? "0") : 0,
    });
  }
  return map;
}

/** สินค้าที่คนดูเยอะสุด (สำหรับ Analytics) */
export async function getMostViewedProducts(shopId: string, limit = 20): Promise<{ product_id: string; product_name: string; view_count: number }[]> {
  const res = await query<{ product_id: string; product_name: string; view_count: string }>(
    `SELECT pa.product_id::text AS product_id, COALESCE(p.name, 'สินค้า') AS product_name, COUNT(*)::text AS view_count
     FROM product_analytics pa
     LEFT JOIN products p ON p.id = pa.product_id
     WHERE pa.shop_id = $1
     GROUP BY pa.product_id, p.name
     ORDER BY COUNT(*) DESC
     LIMIT $2`,
    [shopId, limit]
  );
  return res.rows.map((r) => ({
    product_id: r.product_id,
    product_name: r.product_name,
    view_count: parseInt(r.view_count ?? "0", 10),
  }));
}

/** บันทึกการดูสินค้า (รายการสินค้าที่คนดูเยอะสุด) */
export async function recordProductView(shopId: string, productId: string, sessionId?: string | null): Promise<void> {
  await query(
    "INSERT INTO product_analytics (shop_id, product_id, session_id) VALUES ($1, $2, $3)",
    [shopId, productId, sessionId ?? null]
  );
}

/** ข้อมูลโฆษณา + อนาเลติกส์ของร้าน (สำหรับหน้า manage-shop/ad) */
export async function getShopAdAndAnalytics(shopId: string): Promise<{
  activeAd: {
    id: string;
    amount_paid: number;
    days: number | null;
    start_at: string;
    end_at: string;
    ad_type: string;
    clicks_purchased: number | null;
    clicks_used: number | null;
  } | null;
  totalAdSpend: number;
  shop_views: number;
  product_list_views: number;
  total_visitors: number;
  most_viewed_products: { product_id: string; product_name: string; view_count: number }[];
}> {
  const [adRes, spendRes, shopViewRes, productViewRes, visitorsRes, mostViewedRes] = await Promise.all([
    query<{ id: string; amount_paid: string; days: number | null; start_at: Date; end_at: Date; ad_type: string; clicks_purchased: number | null; clicks_used: number | null }>(
      `SELECT id, amount_paid::text AS amount_paid, days, start_at, end_at,
              COALESCE(ad_type, 'days') AS ad_type, clicks_purchased, COALESCE(clicks_used, 0) AS clicks_used
       FROM shop_ads WHERE shop_id = $1 AND end_at > now()
       AND (ad_type = 'days' OR (ad_type = 'clicks' AND COALESCE(clicks_used, 0) < COALESCE(clicks_purchased, 0)))
       ORDER BY end_at DESC LIMIT 1`,
      [shopId]
    ),
    query<{ sum: string }>("SELECT COALESCE(SUM(amount_paid), 0)::text AS sum FROM shop_ads WHERE shop_id = $1", [shopId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM shop_analytics WHERE shop_id = $1 AND event_type = 'shop_view'", [shopId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM shop_analytics WHERE shop_id = $1 AND event_type = 'product_list_view'", [shopId]),
    query<{ count: string }>("SELECT COUNT(DISTINCT COALESCE(session_id, id::text))::text AS count FROM shop_analytics WHERE shop_id = $1", [shopId]),
    getMostViewedProducts(shopId, 20),
  ]);
  const activeRow = adRes.rows[0];
  const toIso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
  return {
    activeAd: activeRow
      ? {
          id: activeRow.id,
          amount_paid: parseFloat(activeRow.amount_paid),
          days: activeRow.days,
          start_at: toIso(activeRow.start_at),
          end_at: toIso(activeRow.end_at),
          ad_type: activeRow.ad_type ?? "days",
          clicks_purchased: activeRow.clicks_purchased,
          clicks_used: activeRow.clicks_used ?? 0,
        }
      : null,
    totalAdSpend: parseFloat(spendRes.rows[0]?.sum ?? "0"),
    shop_views: parseInt(shopViewRes.rows[0]?.count ?? "0", 10),
    product_list_views: parseInt(productViewRes.rows[0]?.count ?? "0", 10),
    total_visitors: parseInt(visitorsRes.rows[0]?.count ?? "0", 10),
    most_viewed_products: mostViewedRes,
  };
}

/** บันทึกการเข้าชมร้าน (กดเข้าดูร้าน / ดูรายการสินค้า) */
export async function recordShopView(shopId: string, eventType: "shop_view" | "product_list_view", sessionId?: string | null): Promise<void> {
  await query(
    "INSERT INTO shop_analytics (shop_id, event_type, session_id) VALUES ($1, $2, $3)",
    [shopId, eventType, sessionId ?? null]
  );
  if (eventType === "shop_view") {
    await query(
      `UPDATE shop_ads SET clicks_used = COALESCE(clicks_used, 0) + 1
       WHERE id = (SELECT id FROM shop_ads WHERE shop_id = $1 AND ad_type = 'clicks' AND end_at > now() AND COALESCE(clicks_used, 0) < COALESCE(clicks_purchased, 0) ORDER BY end_at DESC LIMIT 1)`,
      [shopId]
    );
  }
}

/** ราคาโฆษณา (ขั้นต่ำ) ต่อจำนวนวัน — สำหรับแสดงในฟอร์มและตรวจยอดขั้นต่ำ */
export async function getAdPriceTiers(): Promise<{ days: number; min_amount: number }[]> {
  const res = await query<{ days: number; min_amount: string }>(
    "SELECT days, COALESCE(min_amount, 0)::numeric::text AS min_amount FROM ad_price_tiers ORDER BY days"
  );
  return res.rows.map((r) => ({ days: r.days, min_amount: parseFloat(r.min_amount ?? "0") }));
}

/** อัปเดตราคาขั้นต่ำโฆษณาต่อจำนวนวัน (CMS) */
export async function updateAdPriceTiers(tiers: { days: number; min_amount: number }[]): Promise<void> {
  for (const t of tiers) {
    const days = Math.max(1, Math.min(365, Math.floor(t.days)));
    const minAmount = Math.max(0, Number(t.min_amount) || 0);
    await query(
      `INSERT INTO ad_price_tiers (days, min_amount, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (days) DO UPDATE SET min_amount = $2, updated_at = now()`,
      [days, minAmount]
    );
  }
}

/** ราคาต่อคลิก (เหรียญ) สำหรับโฆษณาแบบจำนวนคลิก — แอดมินตั้งใน CMS */
export async function getAdClickPricing(): Promise<number> {
  const res = await query<{ coins_per_click: string }>("SELECT COALESCE(coins_per_click, 1)::numeric::text AS coins_per_click FROM ad_click_pricing WHERE id = 1 LIMIT 1");
  return parseFloat(res.rows[0]?.coins_per_click ?? "1");
}

/** อัปเดตราคาต่อคลิก (CMS) */
export async function updateAdClickPricing(coinsPerClick: number): Promise<void> {
  const v = Math.max(0, Number(coinsPerClick) || 0);
  await query(
    "INSERT INTO ad_click_pricing (id, coins_per_click, updated_at) VALUES (1, $1, now()) ON CONFLICT (id) DO UPDATE SET coins_per_click = $1, updated_at = now()",
    [v]
  );
}

/** รายการร้านที่เปิดโฆษณาอยู่ (สำหรับ CMS) — แสดงชื่อร้าน, ยอดจ่ายโฆษณา, ผู้เข้าดู */
export async function getShopsWithActiveAdForAdmin(): Promise<
  { shop_id: string; shop_name: string; amount_paid: number; total_ad_spend: number; clicks_purchased: number; clicks_used: number; shop_views: number; total_visitors: number }[]
> {
  const activeRes = await query<{ shop_id: string; amount_paid: string; clicks_purchased: number; clicks_used: number }>(
    `SELECT shop_id, amount_paid::text AS amount_paid, COALESCE(clicks_purchased, 0) AS clicks_purchased, COALESCE(clicks_used, 0) AS clicks_used
     FROM shop_ads WHERE end_at > now() AND ad_type = 'clicks' AND COALESCE(clicks_used, 0) < COALESCE(clicks_purchased, 0)
     ORDER BY amount_paid DESC`
  );
  if (activeRes.rows.length === 0) return [];
  const shopIds = [...new Set(activeRes.rows.map((r) => r.shop_id))];
  const placeholders = shopIds.map((_, i) => `$${i + 1}`).join(", ");
  const namesRes = await query<{ id: string; shop_name: string }>(
    `SELECT id, shop_name FROM shops WHERE id IN (${placeholders})`,
    shopIds
  );
  const spendRes = await query<{ shop_id: string; sum: string }>(
    `SELECT shop_id, COALESCE(SUM(amount_paid), 0)::text AS sum FROM shop_ads WHERE shop_id IN (${placeholders}) GROUP BY shop_id`,
    shopIds
  );
  const viewRes = await query<{ shop_id: string; event_type: string; count: string }>(
    `SELECT shop_id, event_type, COUNT(*)::text AS count FROM shop_analytics WHERE shop_id IN (${placeholders}) GROUP BY shop_id, event_type`,
    shopIds
  );
  const visitorRes = await query<{ shop_id: string; count: string }>(
    `SELECT shop_id, COUNT(DISTINCT COALESCE(session_id, id::text))::text AS count FROM shop_analytics WHERE shop_id IN (${placeholders}) GROUP BY shop_id`,
    shopIds
  );
  const nameMap = new Map(namesRes.rows.map((r) => [r.id, r.shop_name]));
  const spendMap = new Map(spendRes.rows.map((r) => [r.shop_id, parseFloat(r.sum ?? "0")]));
  const shopViewMap = new Map<string, number>();
  const productViewMap = new Map<string, number>();
  for (const r of viewRes.rows) {
    if (r.event_type === "shop_view") shopViewMap.set(r.shop_id, parseInt(r.count ?? "0", 10));
    else if (r.event_type === "product_list_view") productViewMap.set(r.shop_id, parseInt(r.count ?? "0", 10));
  }
  const visitorMap = new Map(visitorRes.rows.map((r) => [r.shop_id, parseInt(r.count ?? "0", 10)]));
  return activeRes.rows.map((r) => ({
    shop_id: r.shop_id,
    shop_name: nameMap.get(r.shop_id) ?? r.shop_id,
    amount_paid: parseFloat(r.amount_paid ?? "0"),
    total_ad_spend: spendMap.get(r.shop_id) ?? 0,
    clicks_purchased: r.clicks_purchased ?? 0,
    clicks_used: r.clicks_used ?? 0,
    shop_views: shopViewMap.get(r.shop_id) ?? 0,
    total_visitors: visitorMap.get(r.shop_id) ?? 0,
  }));
}

/** ได้ร้านของ user ถ้ามี หรือสร้างร้านแบบร่างจาก registration ถ้ามีแค่ registration (เพื่อให้จัดการสินค้าได้ก่อนจองที่) */
export async function getOrCreateDraftShopForUser(userId: string): Promise<{
  id: string;
  verification_status: string;
  shop_name: string;
  description: string;
  parcel_id: string | null;
  user_id: string;
  logo_url: string | null;
  logo_background_color: string | null;
  cover_url: string | null;
  market_display_url: string | null;
  membership_plan: string | null;
  membership_expires_at: string | null;
} | null> {
  const existing = await getShopByUserId(userId);
  if (existing) return existing;
  const reg = await getRegistrationByUserId(userId);
  if (!reg || !reg.shop_name) return null;
  const shopName = String(reg.shop_name ?? "").trim();
  if (!shopName) return null;
  const insertRes = await query<{
    id: string;
    verification_status: string;
    shop_name: string;
    description: string;
    parcel_id: string | null;
    user_id: string;
    logo_url: string | null;
    logo_background_color: string | null;
    cover_url: string | null;
    market_display_url: string | null;
    membership_plan: string | null;
    membership_expires_at: string | null;
  }>(
    `INSERT INTO shops (parcel_id, user_id, shop_name, description, logo_url, logo_background_color, cover_url, verification_status, membership_plan)
     VALUES (NULL, $1, $2, $3, $4, $5, $6, 'none', NULL)
     RETURNING id, verification_status, shop_name, description, parcel_id, user_id, logo_url, logo_background_color, cover_url, market_display_url, membership_plan, membership_expires_at`,
    [
      userId,
      shopName,
      String(reg.description ?? "").trim(),
      reg.logo_url ?? null,
      (reg.logo_background_color && String(reg.logo_background_color).trim()) ? String(reg.logo_background_color).trim() : "#ec4899",
      reg.cover_url ?? null,
    ]
  );
  return insertRes.rows[0] ?? null;
}

export async function getRegistrationByUserId(userId: string): Promise<Record<string, unknown> | null> {
  const res = await query(
    "SELECT * FROM shop_registrations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  const row = res.rows[0];
  return row ? (row as Record<string, unknown>) : null;
}

/** บันทึก/อัปเดตการลงทะเบียนร้าน (draft) — ใช้เมื่อผู้ใช้กดบันทึกในหน้าลงทะเบียนร้าน */
export async function upsertShopRegistration(
  userId: string,
  data: {
    shop_name: string;
    description: string;
    logo_url?: string | null;
    logo_background_color?: string | null;
    cover_url?: string | null;
    use_same_as_user_address?: boolean;
    address?: {
      full_address?: string;
      map_url?: string | null;
      recipient_name?: string | null;
      phone?: string | null;
      address_line1?: string | null;
      address_line2?: string | null;
      sub_district?: string | null;
      district?: string | null;
      province?: string | null;
      postal_code?: string | null;
    } | null;
  }
): Promise<Record<string, unknown>> {
  const existing = await query<{ id: string }>(
    "SELECT id FROM shop_registrations WHERE user_id = $1 AND status IN ('draft','pending_slot') ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  const row = existing.rows[0];
  const logoUrl = data.logo_url ?? null;
  const logoBg = (data.logo_background_color && data.logo_background_color.trim()) ? data.logo_background_color.trim() : "#ec4899";
  const coverUrl = data.cover_url ?? null;

  const resolveAddressId = async (_regId: string): Promise<string | null> => {
    if (data.use_same_as_user_address) return null;
    const addr = data.address;
    if (!addr || (!addr.full_address?.trim() && !addr.map_url?.trim() && !addr.address_line1?.trim())) return null;
    const created = await createAddress(userId, {
      full_address: addr.full_address,
      map_url: addr.map_url ?? null,
      recipient_name: addr.recipient_name ?? null,
      phone: addr.phone ?? null,
      address_line1: addr.address_line1 ?? null,
      address_line2: addr.address_line2 ?? null,
      sub_district: addr.sub_district ?? null,
      district: addr.district ?? null,
      province: addr.province ?? null,
      postal_code: addr.postal_code ?? null,
    });
    return created.id;
  };

  if (row) {
    const addressId = await resolveAddressId(row.id);
    if (addressId) {
      await query(
        `UPDATE shop_registrations SET shop_name = $2, description = $3, logo_url = $4, logo_background_color = $5, cover_url = $6, address_id = $7, updated_at = now() WHERE id = $1`,
        [row.id, data.shop_name.trim(), (data.description ?? "").trim(), logoUrl, logoBg, coverUrl, addressId]
      );
    } else if (data.use_same_as_user_address) {
      await query(
        `UPDATE shop_registrations SET shop_name = $2, description = $3, logo_url = $4, logo_background_color = $5, cover_url = $6, use_same_as_user_address = true, address_id = NULL, updated_at = now() WHERE id = $1`,
        [row.id, data.shop_name.trim(), (data.description ?? "").trim(), logoUrl, logoBg, coverUrl]
      );
    } else {
      await query(
        `UPDATE shop_registrations SET shop_name = $2, description = $3, logo_url = $4, logo_background_color = $5, cover_url = $6, updated_at = now() WHERE id = $1`,
        [row.id, data.shop_name.trim(), (data.description ?? "").trim(), logoUrl, logoBg, coverUrl]
      );
    }
    const updated = await query("SELECT * FROM shop_registrations WHERE id = $1", [row.id]);
    return updated.rows[0] as Record<string, unknown>;
  }

  const insert = await query<{ id: string }>(
    `INSERT INTO shop_registrations (user_id, shop_name, description, logo_url, logo_background_color, cover_url, status, use_same_as_user_address)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
     RETURNING id`,
    [userId, data.shop_name.trim(), (data.description ?? "").trim(), logoUrl, logoBg, coverUrl, data.use_same_as_user_address ?? false]
  );
  const newId = insert.rows[0]?.id;
  if (newId) {
    const addressId = await resolveAddressId(newId);
    if (addressId) {
      await query("UPDATE shop_registrations SET address_id = $1 WHERE id = $2", [addressId, newId]);
    }
  }
  const created = await query("SELECT * FROM shop_registrations WHERE id = $1", [newId]);
  return created.rows[0] as Record<string, unknown>;
}

export async function setShopVerificationStatus(
  shopId: string,
  status: "none" | "pending" | "verified" | "rejected"
): Promise<boolean> {
  const res = await query(
    "UPDATE shops SET verification_status = $2, verified_at = CASE WHEN $2 = 'verified' THEN now() ELSE NULL END, updated_at = now() WHERE id = $1",
    [shopId, status]
  );
  return (res.rowCount ?? 0) > 0;
}

/** อัปเดตสถานะเอกสารยืนยันร้าน (admin approve/reject) */
export async function updateVerificationDocStatus(
  docId: string,
  status: "approved" | "rejected",
  reviewNotes?: string
): Promise<{ shop_id: string } | null> {
  const res = await query<{ shop_id: string }>(
    `UPDATE shop_verification_documents SET status = $2, reviewed_at = now(), review_notes = $3 WHERE id = $1 RETURNING shop_id`,
    [docId, status, reviewNotes ?? null]
  );
  return res.rows[0] ?? null;
}

// ==================== Auth: users ====================
export async function findUserByEmail(email: string): Promise<{ id: string; username: string; email: string; created_at: string; status?: string } | undefined> {
  const norm = email.trim().toLowerCase();
  const res = await query<{ id: string; username: string; email: string; created_at: string; status: string | null }>(
    "SELECT id, username, email, created_at, status FROM users WHERE LOWER(email) = $1",
    [norm]
  );
  const row = res.rows[0];
  return row ? { ...row, status: row.status ?? undefined } : undefined;
}

export async function findUserByUsername(username: string): Promise<{ id: string; username: string; email: string; created_at: string } | undefined> {
  const norm = username.trim().toLowerCase();
  const res = await query<{ id: string; username: string; email: string; created_at: string }>(
    "SELECT id, username, email, created_at FROM users WHERE LOWER(username) = $1",
    [norm]
  );
  return res.rows[0];
}

export async function getAuthPassword(userId: string): Promise<string | undefined> {
  const res = await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [
    userId,
  ]);
  return res.rows[0]?.password_hash;
}

export async function setAuthPassword(userId: string, passwordHash: string): Promise<void> {
  await query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [
    userId,
    passwordHash,
  ]);
}

// ==================== Addresses ====================
export type AddressRow = {
  id: string;
  user_id: string;
  full_address: string;
  map_url: string | null;
  recipient_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  sub_district: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
  country: string;
  address_type: string | null;
  delivery_note: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  is_default: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function createAddress(
  userId: string,
  data: {
    full_address?: string;
    map_url?: string | null;
    recipient_name?: string | null;
    phone?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    sub_district?: string | null;
    district?: string | null;
    province?: string | null;
    postal_code?: string | null;
    country?: string;
    address_type?: string | null;
    delivery_note?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    is_default?: boolean;
  }
): Promise<AddressRow> {
  const full_address = data.full_address?.trim() ?? "";
  const map_url = data.map_url?.trim() || null;
  const recipient_name = data.recipient_name?.trim() || null;
  const phone = data.phone?.trim() || null;
  const address_line1 = data.address_line1?.trim() || null;
  const address_line2 = data.address_line2?.trim() || null;
  const sub_district = data.sub_district?.trim() || null;
  const district = data.district?.trim() || null;
  const province = data.province?.trim() || null;
  const postal_code = data.postal_code?.trim() || null;
  const country = data.country?.trim() || "TH";
  const address_type = data.address_type?.trim() || null;
  const delivery_note = data.delivery_note?.trim() || null;
  const latitude = data.latitude != null ? Number(data.latitude) : null;
  const longitude = data.longitude != null ? Number(data.longitude) : null;
  const is_default = data.is_default ?? false;
  const res = await query<AddressRow>(
    `INSERT INTO addresses (user_id, full_address, map_url, recipient_name, phone, address_line1, address_line2, sub_district, district, province, postal_code, country, address_type, delivery_note, latitude, longitude, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING id, user_id, full_address, map_url, recipient_name, phone, address_line1, address_line2, sub_district, district, province, postal_code, country, address_type, delivery_note, latitude, longitude, is_default, deleted_at, created_at, updated_at`,
    [userId, full_address, map_url, recipient_name, phone, address_line1, address_line2, sub_district, district, province, postal_code, country, address_type, delivery_note, latitude, longitude, is_default]
  );
  return res.rows[0];
}

export async function getAddressById(id: string): Promise<AddressRow | null> {
  const res = await query<AddressRow>("SELECT * FROM addresses WHERE id = $1", [id]);
  return res.rows[0] ?? null;
}

/** ที่อยู่ทั้งหมดของ user (ไม่รวมที่ถูกลบแบบ soft delete) — ใช้ใน E-commerce / เลือกที่อยู่จัดส่ง */
export async function getAddressesByUserId(userId: string): Promise<AddressRow[]> {
  const res = await query<AddressRow>(
    "SELECT * FROM addresses WHERE user_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC, created_at ASC",
    [userId]
  );
  return res.rows;
}

// ==================== Register user ====================
export async function registerUser(data: {
  username: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
  address?: {
    full_address?: string;
    map_url?: string | null;
    recipient_name?: string | null;
    phone?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    sub_district?: string | null;
    district?: string | null;
    province?: string | null;
    postal_code?: string | null;
    country?: string;
  };
}): Promise<
  | { user: { id: string; username: string; email: string; created_at: string; status?: string }; profile: { id: string; user_id: string; first_name: string; last_name: string; display_name: string; phone: string; email: string; avatar_url: string } }
  | { error: string }
> {
  const existingEmail = await findUserByEmail(data.email);
  if (existingEmail) return { error: "อีเมลนี้มีการใช้งานแล้ว" };
  const existingUsername = await findUserByUsername(data.username);
  if (existingUsername) return { error: "ชื่อผู้ใช้นี้มีการใช้งานแล้ว" };
  const userRes = await query<{ id: string; username: string; email: string; created_at: string }>(
    `INSERT INTO users (username, email, password_hash, status, terms_accepted_at, privacy_accepted_at)
     VALUES ($1, $2, $3, 'active', $4, $5)
     RETURNING id, username, email, created_at`,
    [data.username.trim(), data.email.trim().toLowerCase(), data.passwordHash, data.termsAcceptedAt ?? null, data.privacyAcceptedAt ?? null]
  );
  const user = userRes.rows[0];
  if (!user) return { error: "สร้างบัญชีไม่สำเร็จ" };
  const firstName = data.firstName?.trim() ?? "";
  const lastName = data.lastName?.trim() ?? "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || data.username;
  const profileRes = await query<{ id: string; user_id: string; first_name: string; last_name: string; display_name: string; phone: string; email: string; avatar_url: string }>(
    `INSERT INTO profiles (user_id, first_name, last_name, display_name, email, phone, avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6, '')
     RETURNING id, user_id, first_name, last_name, display_name, phone, email, avatar_url`,
    [user.id, firstName, lastName, displayName, user.email, data.phone ?? null]
  );
  const profile = profileRes.rows[0];
  if (!profile) return { error: "สร้างโปรไฟล์ไม่สำเร็จ" };
  if (data.address && (data.address.full_address?.trim() || data.address.map_url?.trim())) {
    const addr = await createAddress(user.id, { ...data.address, is_default: true });
    await query("UPDATE profiles SET address_id = $1, updated_at = now() WHERE id = $2", [addr.id, profile.id]);
  }
  await query(
    `INSERT INTO user_verification (user_id, verified) VALUES ($1, false) ON CONFLICT (user_id) DO NOTHING`,
    [user.id]
  );
  await query(
    `INSERT INTO user_balances (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING`,
    [user.id]
  );
  await query(
    `INSERT INTO user_ad_credits (user_id, credits) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING`,
    [user.id]
  );
  return {
    user: { ...user, status: "active" },
    profile: { ...profile, phone: profile.phone ?? "" },
  };
}

// ==================== Admins (จากตาราง admins ในฐานข้อมูลเท่านั้น) ====================
const FIRST_ADMIN_EMAIL = "admin@host.com"; // แอดมินจาก seed-first-admin.js — ห้ามลบจาก CMS

export async function getAdminsList(): Promise<
  Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    display_name: string;
    created_at: string;
    isFirst: boolean;
  }>
> {
  const res = await query<{ id: string; email: string; first_name: string; last_name: string; display_name: string; created_at: string }>(
    "SELECT id, email, first_name, last_name, display_name, created_at FROM admins ORDER BY created_at"
  );
  return res.rows.map((a) => ({
    id: a.id,
    email: a.email,
    first_name: a.first_name,
    last_name: a.last_name,
    display_name: a.display_name,
    created_at: a.created_at,
    isFirst: a.email.toLowerCase() === FIRST_ADMIN_EMAIL,
  }));
}

export async function findAdminByEmail(email: string): Promise<{
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  display_name: string;
  created_at: string;
} | null> {
  const norm = email.trim().toLowerCase();
  const res = await query<{ id: string; email: string; password_hash: string; first_name: string; last_name: string; display_name: string; created_at: string }>(
    "SELECT id, email, password_hash, first_name, last_name, display_name, created_at FROM admins WHERE LOWER(email) = $1",
    [norm]
  );
  return res.rows[0] ?? null;
}

export async function verifyAdminPassword(
  admin: { password_hash: string },
  password: string
): Promise<boolean> {
  const { verifyPassword } = await import("@/lib/auth");
  return verifyPassword(password, admin.password_hash);
}

export async function addAdmin(data: {
  email: string;
  passwordHash: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
}): Promise<
  | { id: string; email: string; first_name: string; last_name: string; display_name: string; created_at: string }
  | { error: string }
> {
  const emailNorm = data.email.trim().toLowerCase();
  const existing = await findAdminByEmail(data.email);
  if (existing) return { error: "อีเมลนี้มีในระบบแล้ว" };
  const res = await query<{ id: string; email: string; first_name: string; last_name: string; display_name: string; created_at: string }>(
    `INSERT INTO admins (email, password_hash, first_name, last_name, display_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, first_name, last_name, display_name, created_at`,
    [
      emailNorm,
      data.passwordHash,
      data.first_name?.trim() ?? "",
      data.last_name?.trim() ?? "",
      data.display_name?.trim() ?? data.email.trim(),
    ]
  );
  const row = res.rows[0];
  return row ?? { error: "เพิ่มแอดมินไม่สำเร็จ" };
}

export async function getAdminById(id: string): Promise<{ id: string; email: string; password_hash: string; first_name: string; last_name: string; display_name: string; created_at: string } | null> {
  const res = await query("SELECT id, email, password_hash, first_name, last_name, display_name, created_at FROM admins WHERE id = $1", [
    id,
  ]);
  const row = res.rows[0];
  return row
    ? (row as { id: string; email: string; password_hash: string; first_name: string; last_name: string; display_name: string; created_at: string })
    : null;
}

export async function updateAdmin(
  id: string,
  data: { first_name?: string; last_name?: string; display_name?: string; passwordHash?: string }
): Promise<{ id: string } | { error: string }> {
  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (data.first_name !== undefined) {
    updates.push(`first_name = $${idx++}`);
    params.push(data.first_name.trim());
  }
  if (data.last_name !== undefined) {
    updates.push(`last_name = $${idx++}`);
    params.push(data.last_name.trim());
  }
  if (data.display_name !== undefined) {
    updates.push(`display_name = $${idx++}`);
    params.push(data.display_name.trim());
  }
  if (data.passwordHash !== undefined) {
    updates.push(`password_hash = $${idx++}`);
    params.push(data.passwordHash);
  }
  if (updates.length === 0) return { error: "ไม่มีข้อมูลที่จะอัปเดต" };
  params.push(id);
  const res = await query(
    `UPDATE admins SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id`,
    params
  );
  return res.rows[0] ? { id: (res.rows[0] as { id: string }).id } : { error: "ไม่พบแอดมิน" };
}

export async function deleteAdmin(id: string): Promise<{ ok: true } | { error: string }> {
  const admin = await getAdminById(id);
  if (!admin) return { error: "ไม่พบแอดมิน" };
  if (admin.email.toLowerCase() === FIRST_ADMIN_EMAIL) {
    return { error: "ไม่สามารถลบแอดมินคนแรก (จากสคริปต์ seed) ได้" };
  }
  const res = await query("DELETE FROM admins WHERE id = $1 RETURNING id", [id]);
  return res.rowCount && res.rowCount > 0 ? { ok: true } : { error: "ไม่พบแอดมิน" };
}

// ==================== Notifications ====================
export async function addNotification(
  type: string,
  title: string,
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await query(
    "INSERT INTO notifications (type, title, message, meta) VALUES ($1, $2, $3, $4)",
    [type, title, message, meta ? JSON.stringify(meta) : null]
  );
}

export async function getNotifications(): Promise<{ id: string; type: string; title: string; message: string; created_at: string; meta: Record<string, unknown> | null }[]> {
  const res = await query<{ id: string; type: string; title: string; message: string; created_at: string; meta: string | null }>(
    "SELECT id, type, title, message, created_at, meta FROM notifications ORDER BY created_at DESC LIMIT 50"
  );
  return res.rows.map((r) => {
    let meta: Record<string, unknown> | null = null;
    if (r.meta != null) {
      meta = typeof r.meta === "string" ? (JSON.parse(r.meta) as Record<string, unknown>) : (r.meta as Record<string, unknown>);
    }
    return { id: r.id, type: r.type, title: r.title, message: r.message, created_at: r.created_at, meta };
  });
}

/** ล้างการแจ้งเตือนของ CMS ทั้งหมด — คืนจำนวนแถวที่ลบ */
export async function clearAllNotifications(): Promise<number> {
  const res = await query("DELETE FROM notifications");
  return res.rowCount ?? 0;
}

// ==================== User Notifications (กระดิ่งแจ้งเตือนในแอป) ====================
export type UserNotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link_path: string | null;
  link_meta: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

/** สร้างแจ้งเตือนให้ผู้ใช้ (ใช้จาก API หลัง createOrder, updateOrderItemShipping ฯลฯ) */
export async function addUserNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  linkPath?: string | null,
  linkMeta?: Record<string, unknown> | null
): Promise<void> {
  await query(
    "INSERT INTO user_notifications (user_id, type, title, message, link_path, link_meta) VALUES ($1, $2, $3, $4, $5, $6)",
    [userId, type, title, message, linkPath ?? null, linkMeta ? JSON.stringify(linkMeta) : null]
  );
}

/** รายการแจ้งเตือนของผู้ใช้ (ล่าสุดก่อน) */
export async function getUserNotifications(
  userId: string,
  limit = 50
): Promise<UserNotificationRow[]> {
  const res = await query<{
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    link_path: string | null;
    link_meta: string | Record<string, unknown> | null;
    read_at: Date | null;
    created_at: Date;
  }>(
    "SELECT id, user_id, type, title, message, link_path, link_meta, read_at, created_at FROM user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit]
  );
  return res.rows.map((r) => {
    let link_meta: Record<string, unknown> | null = null;
    if (r.link_meta != null) {
      if (typeof r.link_meta === "string") link_meta = JSON.parse(r.link_meta) as Record<string, unknown>;
      else if (typeof r.link_meta === "object" && r.link_meta !== null) link_meta = r.link_meta as Record<string, unknown>;
    }
    return {
      id: r.id,
      user_id: r.user_id,
      type: r.type,
      title: r.title,
      message: r.message,
      link_path: r.link_path,
      link_meta,
      read_at: r.read_at ? new Date(r.read_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
    };
  });
}

/** จำนวนแจ้งเตือนที่ยังไม่อ่าน */
export async function getUnreadUserNotificationCount(userId: string): Promise<number> {
  const res = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM user_notifications WHERE user_id = $1 AND read_at IS NULL",
    [userId]
  );
  return parseInt(res.rows[0]?.count ?? "0", 10);
}

/** ทำเครื่องหมายว่าอ่านแล้ว (หนึ่งรายการ) */
export async function markUserNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  const res = await query(
    "UPDATE user_notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING id",
    [notificationId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/** ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว */
export async function markAllUserNotificationsRead(userId: string): Promise<number> {
  const res = await query(
    "UPDATE user_notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id",
    [userId]
  );
  return res.rowCount ?? 0;
}

/** ลบแจ้งเตือนที่เก่ากว่ากำหนด (แอดมิน + ผู้ใช้) — ใช้กับ cron ลดพื้นที่ DB */
export async function deleteNotificationsOlderThanDays(days: number): Promise<{ notificationsDeleted: number; userNotificationsDeleted: number }> {
  const n = Math.max(1, Math.floor(days));
  const adminRes = await query<{ count: string }>(
    "WITH deleted AS (DELETE FROM notifications WHERE created_at < now() - ($1::text || ' days')::interval RETURNING id) SELECT count(*)::text AS count FROM deleted",
    [n]
  );
  const userRes = await query<{ count: string }>(
    "WITH deleted AS (DELETE FROM user_notifications WHERE created_at < now() - ($1::text || ' days')::interval RETURNING id) SELECT count(*)::text AS count FROM deleted",
    [n]
  );
  return {
    notificationsDeleted: parseInt(adminRes.rows[0]?.count ?? "0", 10),
    userNotificationsDeleted: parseInt(userRes.rows[0]?.count ?? "0", 10),
  };
}

/** ตั้งเวลาอ่านประวัติประกาศล่าสุด (เรียกเมื่อผู้ใช้เปิดประวัติประกาศ) */
export async function setUserAnnouncementLastRead(userId: string): Promise<void> {
  await query(
    `INSERT INTO user_announcement_reads (user_id, last_read_at) VALUES ($1, now())
     ON CONFLICT (user_id) DO UPDATE SET last_read_at = now()`,
    [userId]
  );
}

/** มีประกาศใหม่หลังเวลาที่ผู้ใช้เปิดอ่านล่าสุดหรือไม่ (สำหรับจุดแดง) */
export async function hasUnreadAnnouncementsForUser(userId: string): Promise<boolean> {
  const res = await query<{ last_read_at: Date | null }>(
    "SELECT last_read_at FROM user_announcement_reads WHERE user_id = $1",
    [userId]
  );
  const lastRead = res.rows[0]?.last_read_at ?? null;
  if (!lastRead) {
    const countRes = await query<{ count: string }>("SELECT COUNT(*) AS count FROM announcements WHERE created_at >= (now() - interval '24 hours')");
    return parseInt(countRes.rows[0]?.count ?? "0", 10) > 0;
  }
  const hasNew = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM announcements WHERE created_at > $1",
    [lastRead]
  );
  return parseInt(hasNew.rows[0]?.count ?? "0", 10) > 0;
}

/** รายการ user_id ของเจ้าของร้านจาก order_id (สำหรับแจ้งเตือนคำสั่งซื้อใหม่) */
export async function getShopOwnerIdsByOrderId(orderId: string): Promise<string[]> {
  const res = await query<{ user_id: string }>(
    "SELECT DISTINCT s.user_id FROM order_items oi JOIN shops s ON s.id = oi.shop_id WHERE oi.order_id = $1",
    [orderId]
  );
  return res.rows.map((r) => r.user_id);
}

/** ดึงเจ้าของร้าน (user_id, shop_name) จาก shopIds — ใช้เช็คว่าเจ้าของร้านผูกกระเป๋าหรือยังก่อนชำระ */
export async function getShopOwnersByShopIds(shopIds: string[]): Promise<{ shopId: string; user_id: string; shop_name: string }[]> {
  if (shopIds.length === 0) return [];
  const uniq = [...new Set(shopIds)];
  const res = await query<{ id: string; user_id: string; shop_name: string }>(
    "SELECT id, user_id, shop_name FROM shops WHERE id = ANY($1)",
    [uniq]
  );
  return res.rows.map((r) => ({ shopId: r.id, user_id: r.user_id, shop_name: r.shop_name || "ร้าน" }));
}

// ==================== Users (สำหรับ CMS) ====================
export async function getUsers(): Promise<{
  id: string;
  username: string;
  email: string;
  created_at: string;
  status?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  verification_status?: string;
  verification_document_url?: string | null;
  last_seen_at?: string;
}[]> {
  const res = await query<{
    id: string;
    username: string;
    email: string;
    created_at: string;
    status: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    verification_status: string | null;
    verification_document_url: string | null;
    last_seen_at: string | null;
  }>(
    `SELECT u.id, u.username, u.email, u.created_at, u.status,
            p.first_name, p.last_name, p.phone, p.avatar_url,
            uv.status AS verification_status,
            uv.document_url AS verification_document_url,
            up.last_seen_at
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN user_verification uv ON uv.user_id = u.id
     LEFT JOIN user_presence up ON up.user_id = u.id
     ORDER BY u.created_at DESC`
  );
  return res.rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    created_at: r.created_at,
    status: r.status ?? undefined,
    first_name: r.first_name ?? undefined,
    last_name: r.last_name ?? undefined,
    phone: r.phone ?? undefined,
    avatar_url: r.avatar_url ?? undefined,
    verification_status: r.verification_status ?? undefined,
    verification_document_url: r.verification_document_url ?? undefined,
    last_seen_at: r.last_seen_at ?? undefined,
  }));
}

export async function getUserDetail(userId: string): Promise<{
  user: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  address: Record<string, unknown> | null;
  wallets: Record<string, unknown>[];
  verification: { verified: boolean; verified_at: string | null; status?: string; document_url?: string } | null;
  shops: Record<string, unknown>[];
  registrations: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  payouts: Record<string, unknown>[];
  last_seen_at: string | null;
}> {
  const [userRes, profileRes, walletsRes, verRes, shopsRes, regRes, presenceRes, payoutsRes] = await Promise.all([
    query("SELECT * FROM users WHERE id = $1", [userId]),
    query("SELECT * FROM profiles WHERE user_id = $1", [userId]),
    query("SELECT * FROM wallets WHERE user_id = $1 ORDER BY is_primary DESC, created_at DESC", [userId]),
    query("SELECT verified, verified_at, status, document_url FROM user_verification WHERE user_id = $1", [userId]),
    query("SELECT * FROM shops WHERE user_id = $1", [userId]),
    query("SELECT * FROM shop_registrations WHERE user_id = $1", [userId]),
    query("SELECT last_seen_at FROM user_presence WHERE user_id = $1 LIMIT 1", [userId]),
    query<{ id: string; order_id: string; amount: string; status: string; paid_at: Date | null; created_at: Date }>(
      `SELECT sp.id, sp.order_id, sp.amount::text AS amount, sp.status, sp.paid_at, sp.created_at
       FROM shop_payouts sp INNER JOIN shops s ON s.id = sp.shop_id WHERE s.user_id = $1 ORDER BY sp.created_at DESC`,
      [userId]
    ),
  ]);
  const user = userRes.rows[0] as Record<string, unknown> | undefined;
  const profile = profileRes.rows[0] as Record<string, unknown> | undefined;
  const verification = verRes.rows[0] as { verified: boolean; verified_at: string | null; status?: string | null; document_url?: string | null } | undefined;
  const lastSeenAt = (presenceRes.rows[0] as { last_seen_at?: string } | undefined)?.last_seen_at ?? null;
  const addressId = profile && typeof profile.address_id === "string" ? profile.address_id : null;
  const addressRow = addressId ? await getAddressById(addressId) : null;
  const address = addressRow ? (addressRow as unknown as Record<string, unknown>) : null;
  const shops = (shopsRes.rows as Record<string, unknown>[]) ?? [];
  for (const s of shops) {
    const sid = s.id as string;
    if (sid) (s as Record<string, unknown>).shop_parcel_ids = await getShopParcelIds(sid);
  }
  const payouts = (payoutsRes.rows ?? []).map((r) => ({
    id: r.id,
    order_id: r.order_id,
    amount: parseFloat(r.amount || "0"),
    status: r.status,
    paid_at: r.paid_at ? r.paid_at.toISOString() : null,
    created_at: r.created_at.toISOString(),
  }));
  return {
    user: user ?? null,
    profile: profile ?? null,
    address,
    wallets: (walletsRes.rows as Record<string, unknown>[]) ?? [],
    verification: verification
      ? {
          verified: verification.verified,
          verified_at: verification.verified_at,
          status: verification.status ?? undefined,
          document_url: verification.document_url ?? undefined,
        }
      : null,
    shops,
    registrations: (regRes.rows as Record<string, unknown>[]) ?? [],
    payments: [],
    payouts,
    last_seen_at: lastSeenAt,
  };
}

export type ProfileUpdate = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
};

export async function updateProfileByUserId(
  userId: string,
  data: ProfileUpdate
): Promise<Record<string, unknown> | null> {
  const keys: (keyof ProfileUpdate)[] = ["first_name", "last_name", "email", "phone", "avatar_url"];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const key of keys) {
    if (data[key] !== undefined) {
      setClauses.push(`${key} = $${i}`);
      values.push(data[key]);
      i += 1;
    }
  }
  if (setClauses.length === 0) return null;
  setClauses.push(`updated_at = NOW()`);
  values.push(userId);
  const res = await query(
    `UPDATE profiles SET ${setClauses.join(", ")} WHERE user_id = $${i} RETURNING *`,
    values
  );
  return (res.rows[0] as Record<string, unknown>) ?? null;
}

/** ชื่อแสดงของ user (จาก profiles) — ใช้แสดงเจ้าของร้านในหน้าร้านสาธารณะ */
export async function getDisplayNameByUserId(userId: string): Promise<string | null> {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return null;
  const res = await query<{ display_name: string | null; first_name: string | null; last_name: string | null }>(
    "SELECT display_name, first_name, last_name FROM profiles WHERE user_id = $1 LIMIT 1",
    [uid]
  );
  const row = res.rows[0];
  if (!row) return null;
  const displayName = typeof row.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : null;
  if (displayName) return displayName;
  const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
  const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
  const combined = [first, last].filter(Boolean).join(" ");
  return combined || null;
}

// ==================== Address upsert ====================
export type AddressUpsertData = {
  full_address?: string;
  map_url?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  sub_district?: string | null;
  district?: string | null;
  province?: string | null;
  postal_code?: string | null;
  delivery_note?: string | null;
};

/** สร้างหรืออัปเดตที่อยู่หลักของผู้ใช้ แล้วผูก profiles.address_id */
export async function upsertAddressForUser(
  userId: string,
  data: AddressUpsertData
): Promise<Record<string, unknown>> {
  const profileRes = await query<{ id: string; address_id: string | null }>(
    "SELECT id, address_id FROM profiles WHERE user_id = $1",
    [userId]
  );
  const profile = profileRes.rows[0];
  if (!profile) throw new Error("ไม่พบ profile ของผู้ใช้");

  const fields: (keyof AddressUpsertData)[] = [
    "full_address", "map_url", "recipient_name", "phone",
    "address_line1", "address_line2", "sub_district", "district",
    "province", "postal_code", "delivery_note",
  ];

  if (profile.address_id) {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const key of fields) {
      if (data[key] !== undefined) {
        setClauses.push(`${key} = $${i}`);
        values.push(data[key]);
        i++;
      }
    }
    setClauses.push(`updated_at = NOW()`);
    values.push(profile.address_id);
    const res = await query(
      `UPDATE addresses SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    return (res.rows[0] as Record<string, unknown>) ?? {};
  } else {
    const cols = ["user_id", "is_default"];
    const vals: unknown[] = [userId, true];
    let _i = 3;
    for (const key of fields) {
      if (data[key] !== undefined) {
        cols.push(key);
        vals.push(data[key]);
        _i++;
      }
    }
    const placeholders = vals.map((_, idx) => `$${idx + 1}`).join(", ");
    const res = await query(
      `INSERT INTO addresses (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      vals
    );
    const row = res.rows[0] as Record<string, unknown>;
    await query(
      "UPDATE profiles SET address_id = $1, updated_at = NOW() WHERE user_id = $2",
      [row.id, userId]
    );
    return row;
  }
}

// ==================== Shop info update (สำหรับผู้ใช้) ====================
export type ShopInfoUpdate = {
  shop_name?: string;
  description?: string;
  logo_url?: string | null;
  logo_background_color?: string | null;
  cover_url?: string | null;
  market_display_url?: string | null;
};

/** อัปเดตข้อมูลร้านใน shops (ถ้ามีร้านแล้ว) */
export async function updateShopByUserId(
  userId: string,
  data: ShopInfoUpdate
): Promise<Record<string, unknown> | null> {
  const keys: (keyof ShopInfoUpdate)[] = [
    "shop_name", "description", "logo_url", "logo_background_color", "cover_url", "market_display_url",
  ];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const key of keys) {
    if (data[key] !== undefined) {
      setClauses.push(`${key} = $${i}`);
      values.push(data[key]);
      i++;
    }
  }
  if (setClauses.length === 0) return null;
  setClauses.push("updated_at = NOW()");
  values.push(userId);
  const res = await query(
    `UPDATE shops SET ${setClauses.join(", ")} WHERE user_id = $${i} RETURNING *`,
    values
  );
  return (res.rows[0] as Record<string, unknown>) ?? null;
}

/** อัปเดตข้อมูล registration ล่าสุดของผู้ใช้ */
export async function updateShopRegistrationByUserId(
  userId: string,
  data: ShopInfoUpdate
): Promise<Record<string, unknown> | null> {
  const regRes = await query<{ id: string }>(
    "SELECT id FROM shop_registrations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  const regId = regRes.rows[0]?.id;
  if (!regId) return null;
  const keys: (keyof ShopInfoUpdate)[] = [
    "shop_name", "description", "logo_url", "logo_background_color", "cover_url",
  ];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const key of keys) {
    if (data[key] !== undefined) {
      setClauses.push(`${key} = $${i}`);
      values.push(data[key]);
      i++;
    }
  }
  if (setClauses.length === 0) return null;
  setClauses.push("updated_at = NOW()");
  values.push(regId);
  const res = await query(
    `UPDATE shop_registrations SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return (res.rows[0] as Record<string, unknown>) ?? null;
}

// ==================== Contact Channels ====================
export type ContactChannelData = { type: string; value: string; label?: string | null; visible?: boolean };
/** คืนจาก getShopContactsByUserId (มี id, visible สำหรับแก้ไข) */
export type ShopContactChannelRow = { id: string; type: string; value: string; label: string | null; visible: boolean };

export type UserWalletData = {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  is_primary: boolean;
  created_at: string;
};

/** ดึงกระเป๋าที่ผูกของผู้ใช้ เรียง primary ก่อน */
export async function getWalletsByUserId(userId: string): Promise<UserWalletData[]> {
  const res = await query<{
    id: string;
    user_id: string;
    address: string;
    chain: string;
    is_primary: boolean;
    created_at: Date;
  }>(
    `SELECT id, user_id, address, chain, is_primary, created_at
     FROM wallets
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at DESC`,
    [userId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    address: r.address,
    chain: r.chain,
    is_primary: r.is_primary,
    created_at: r.created_at.toISOString(),
  }));
}

/** ผูกหรือเปลี่ยนกระเป๋าหลักของผู้ใช้ (เก็บกระเป๋าเดิมไว้ แต่สลับ primary) */
export async function upsertPrimaryWalletByUserId(
  userId: string,
  address: string,
  chain = "polygon"
): Promise<UserWalletData> {
  const normalizedAddress = address.trim().toLowerCase();
  const normalizedChain = chain.trim().toLowerCase() || "polygon";
  if (!normalizedAddress) throw new Error("wallet address ว่าง");

  return withTransaction(async (client: PoolClient) => {
    await client.query("UPDATE wallets SET is_primary = false WHERE user_id = $1", [userId]);
    const inserted = await client.query<{
      id: string;
      user_id: string;
      address: string;
      chain: string;
      is_primary: boolean;
      created_at: Date;
    }>(
      `INSERT INTO wallets (user_id, address, chain, is_primary)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (user_id, address, chain)
       DO UPDATE SET is_primary = true
       RETURNING id, user_id, address, chain, is_primary, created_at`,
      [userId, normalizedAddress, normalizedChain]
    );
    const row = inserted.rows[0];
    if (!row) throw new Error("ผูกกระเป๋าไม่สำเร็จ");
    return {
      id: row.id,
      user_id: row.user_id,
      address: row.address,
      chain: row.chain,
      is_primary: row.is_primary,
      created_at: row.created_at.toISOString(),
    };
  });
}

/** ดึง profile_contact_channels ของผู้ใช้ */
export async function getProfileContactsByUserId(
  userId: string
): Promise<ContactChannelData[]> {
  const profileRes = await query<{ id: string }>(
    "SELECT id FROM profiles WHERE user_id = $1",
    [userId]
  );
  const profileId = profileRes.rows[0]?.id;
  if (!profileId) return [];
  const res = await query<{ type: string; value: string; label: string | null }>(
    "SELECT type, value, label FROM profile_contact_channels WHERE profile_id = $1 ORDER BY type",
    [profileId]
  );
  return res.rows;
}

/** แทนที่ profile_contact_channels ของผู้ใช้ทั้งหมด */
export async function replaceProfileContactsByUserId(
  userId: string,
  channels: ContactChannelData[]
): Promise<void> {
  const profileRes = await query<{ id: string }>(
    "SELECT id FROM profiles WHERE user_id = $1",
    [userId]
  );
  const profileId = profileRes.rows[0]?.id;
  if (!profileId) throw new Error("ไม่พบ profile ของผู้ใช้");
  await query("DELETE FROM profile_contact_channels WHERE profile_id = $1", [profileId]);
  for (const ch of channels) {
    if (ch.value?.trim()) {
      await query(
        "INSERT INTO profile_contact_channels (profile_id, type, value, label) VALUES ($1, $2, $3, $4)",
        [profileId, ch.type, ch.value.trim(), ch.label ?? null]
      );
    }
  }
}

/** ดึง shop_contact_channels ของผู้ใช้ (มี id, visible สำหรับจัดการแสดง/ซ่อน) */
export async function getShopContactsByUserId(
  userId: string
): Promise<ShopContactChannelRow[]> {
  const shopRes = await query<{ id: string }>(
    "SELECT id FROM shops WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  const shopId = shopRes.rows[0]?.id;
  if (shopId) {
    const res = await query<{ id: string; type: string; value: string; label: string | null; visible: boolean | null }>(
      "SELECT id, type, value, label, COALESCE(visible, true) AS visible FROM shop_contact_channels WHERE shop_id = $1 ORDER BY type",
      [shopId]
    );
    if (res.rows.length > 0) {
      return res.rows.map((r) => ({
        id: r.id,
        type: r.type,
        value: r.value,
        label: r.label,
        visible: r.visible ?? true,
      }));
    }
  }
  const regRes = await query<{ id: string }>(
    "SELECT id FROM shop_registrations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  const regId = regRes.rows[0]?.id;
  if (!regId) return [];
  const res = await query<{ type: string; value: string; label: string | null }>(
    "SELECT type, value, label FROM shop_registration_contacts WHERE registration_id = $1 ORDER BY type",
    [regId]
  );
  return res.rows.map((r, i) => ({
    id: `reg-${regId}-${i}`,
    type: r.type,
    value: r.value,
    label: r.label,
    visible: true,
  }));
}

/** แทนที่ shop_contact_channels (หรือ shop_registration_contacts) ของผู้ใช้ทั้งหมด */
export async function replaceShopContactsByUserId(
  userId: string,
  channels: ContactChannelData[]
): Promise<void> {
  const shopRes = await query<{ id: string }>(
    "SELECT id FROM shops WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  const shopId = shopRes.rows[0]?.id;
  if (shopId) {
    await query("DELETE FROM shop_contact_channels WHERE shop_id = $1", [shopId]);
    for (const ch of channels) {
      if (ch.value?.trim()) {
        const visible = ch.visible !== false;
        await query(
          "INSERT INTO shop_contact_channels (shop_id, type, value, label, visible) VALUES ($1, $2, $3, $4, $5)",
          [shopId, ch.type, ch.value.trim(), ch.label ?? null, visible]
        );
      }
    }
    return;
  }
  const regRes = await query<{ id: string }>(
    "SELECT id FROM shop_registrations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  const regId = regRes.rows[0]?.id;
  if (!regId) return;
  await query("DELETE FROM shop_registration_contacts WHERE registration_id = $1", [regId]);
  for (const ch of channels) {
    if (ch.value?.trim()) {
      await query(
        "INSERT INTO shop_registration_contacts (registration_id, type, value, label) VALUES ($1, $2, $3, $4)",
        [regId, ch.type, ch.value.trim(), ch.label ?? null]
      );
    }
  }
}

// ==================== Shops (สำหรับ CMS) ====================
function gridToLockLabel(roomName: string, grid_x: number, grid_y: number): string {
  const col = grid_x < 26
    ? String.fromCharCode(65 + grid_x)
    : String.fromCharCode(65 + Math.floor(grid_x / 26) - 1) + String.fromCharCode(65 + (grid_x % 26));
  const row = grid_y + 1;
  return `${roomName} ล็อค ${col} ${row}`;
}

export async function getShopsList(): Promise<Record<string, unknown>[]> {
  const res = await query("SELECT * FROM shops ORDER BY created_at DESC");
  const shops = res.rows as Record<string, unknown>[];
  if (shops.length === 0) return shops;

  const shopParcelRows = await query<{ shop_id: string; parcel_id: string }>(
    `SELECT id AS shop_id, parcel_id FROM shops WHERE parcel_id IS NOT NULL
     UNION ALL
     SELECT shop_id, parcel_id FROM shop_parcels`
  );
  const parcelIds = [...new Set(shopParcelRows.rows.map((r) => r.parcel_id))];
  if (parcelIds.length === 0) {
    shops.forEach((s) => { s.lock_labels = []; });
    return shops;
  }
  const placeholders = parcelIds.map((_, i) => `$${i + 1}`).join(", ");
  const parcelRoomRes = await query<{ id: string; room_id: number; grid_x: number; grid_y: number }>(
    `SELECT id, room_id, grid_x, grid_y FROM parcels WHERE id IN (${placeholders})`,
    parcelIds
  );
  const roomRes = await query<{ id: number; name: string }>("SELECT id, name FROM rooms");
  const roomByName = Object.fromEntries(roomRes.rows.map((r: { id: number; name: string }) => [r.id, r.name ?? `ห้อง ${r.id}`]));
  const parcelInfo = new Map(
    parcelRoomRes.rows.map((p: { id: string; room_id: number; grid_x: number; grid_y: number }) => [
      p.id,
      { room_name: roomByName[p.room_id] ?? `ห้อง ${p.room_id}`, grid_x: p.grid_x, grid_y: p.grid_y },
    ])
  );
  const lockLabelsByShop = new Map<string, string[]>();
  for (const row of shopParcelRows.rows) {
    const info = parcelInfo.get(row.parcel_id);
    if (!info) continue;
    const label = gridToLockLabel(info.room_name, info.grid_x, info.grid_y);
    const arr = lockLabelsByShop.get(row.shop_id) ?? [];
    arr.push(label);
    lockLabelsByShop.set(row.shop_id, arr);
  }
  shops.forEach((s) => {
    const id = s.id as string;
    s.lock_labels = lockLabelsByShop.get(id) ?? [];
  });
  return shops;
}

export async function getShopById(shopId: string): Promise<Record<string, unknown> | null> {
  const res = await query("SELECT * FROM shops WHERE id = $1", [shopId]);
  return (res.rows[0] as Record<string, unknown>) ?? null;
}

export async function getShopRegistrationsList(): Promise<Record<string, unknown>[]> {
  const res = await query("SELECT * FROM shop_registrations ORDER BY created_at DESC");
  return res.rows as Record<string, unknown>[];
}

/** ร้านที่ผูกกับ parcel_id (สำหรับหน้าร้านสาธารณะ) — ตรวจทั้ง shops.parcel_id และ shop_parcels */
export async function getShopByParcelId(parcelId: string): Promise<Record<string, unknown> | null> {
  let res = await query("SELECT * FROM shops WHERE parcel_id = $1", [parcelId]);
  if (res.rows.length > 0) return res.rows[0] as Record<string, unknown>;
  res = await query(
    "SELECT s.* FROM shops s JOIN shop_parcels sp ON sp.shop_id = s.id WHERE sp.parcel_id = $1",
    [parcelId]
  );
  return (res.rows[0] as Record<string, unknown>) ?? null;
}

// ==================== USER PRESENCE ====================

/** บันทึก / อัปเดต last_seen_at ของผู้ใช้ (เรียกจาก heartbeat API ทุก 30 วิ) */
export async function upsertUserPresence(userId: string): Promise<void> {
  await query(
    `INSERT INTO user_presence (user_id, last_seen_at)
     VALUES ($1, now())
     ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()`,
    [userId]
  );
}

/** ดึง last_seen_at ของเจ้าของ parcel (สำหรับ Sidebar และหน้าร้าน) */
export async function getOwnerLastSeenAtByParcelId(parcelId: string): Promise<string | null> {
  const res = await query<{ last_seen_at: string }>(
    `SELECT up.last_seen_at
     FROM parcels p
     JOIN user_presence up ON up.user_id = p.owner_id
     WHERE p.id = $1
     LIMIT 1`,
    [parcelId]
  );
  return res.rows[0]?.last_seen_at ?? null;
}

/** ดึง last_seen_at ของผู้ใช้ตาม id โดยตรง */
export async function getUserLastSeenAt(userId: string): Promise<string | null> {
  const res = await query<{ last_seen_at: string }>(
    "SELECT last_seen_at FROM user_presence WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  return res.rows[0]?.last_seen_at ?? null;
}

/** ดึง shop_contact_channels ที่ visible เท่านั้น (สำหรับแสดงให้ผู้ใช้คนอื่นในแผนที่/ Sidebar) */
export async function getContactChannelsByShopId(
  shopId: string
): Promise<{ type: string; value: string; label: string | null }[]> {
  const res = await query<{ type: string; value: string; label: string | null }>(
    "SELECT type, value, label FROM shop_contact_channels WHERE shop_id = $1 AND (visible IS NULL OR visible = true) ORDER BY type",
    [shopId]
  );
  return res.rows;
}

/** owner_id ของ parcel (ใช้ดึงชื่อเจ้าของร้านเมื่อไม่มี shop.user_id) */
export async function getParcelOwnerId(parcelId: string): Promise<string | null> {
  const res = await query<{ owner_id: string }>("SELECT owner_id FROM parcels WHERE id = $1 LIMIT 1", [parcelId]);
  const id = res.rows[0]?.owner_id;
  return typeof id === "string" && id ? id : null;
}

/**
 * ชื่อเจ้าของร้านสำหรับหน้าร้านสาธารณะ — มาจากตาราง profiles เท่านั้น
 * การเชื่อม: parcels.owner_id = profiles.user_id
 * ใช้ display_name หรือ first_name || ' ' || last_name
 */
export async function getOwnerDisplayNameByParcelId(parcelId: string): Promise<string | null> {
  const res = await query<{
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  }>(
    `SELECT pr.display_name, pr.first_name, pr.last_name
     FROM parcels p
     INNER JOIN profiles pr ON pr.user_id = p.owner_id
     WHERE p.id = $1
     LIMIT 1`,
    [parcelId]
  );
  const row = res.rows[0];
  if (!row) return null;
  const displayName = typeof row.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : null;
  if (displayName) return displayName;
  const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
  const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
  const combined = [first, last].filter(Boolean).join(" ");
  return combined || null;
}

/** รายการ parcel_id ทั้งหมดของร้าน (ล็อคหลัก + ล็อคเพิ่มจาก shop_parcels) — ถ้ายังไม่มีตาราง shop_parcels จะคืนแค่ล็อคหลัก */
export async function getShopParcelIds(shopId: string): Promise<string[]> {
  const main = await query<{ parcel_id: string | null }>("SELECT parcel_id FROM shops WHERE id = $1", [shopId]);
  const primary = main.rows[0]?.parcel_id ?? null;
  const ids: string[] = [];
  if (primary) ids.push(primary);
  try {
    const extra = await query<{ parcel_id: string }>(
      "SELECT parcel_id FROM shop_parcels WHERE shop_id = $1 ORDER BY created_at ASC",
      [shopId]
    );
    ids.push(...extra.rows.map((r) => r.parcel_id));
  } catch {
    // ตาราง shop_parcels ยังไม่มี (ยังไม่รัน migration) — ใช้แค่ล็อคหลัก
  }
  return ids;
}

/** คืนค่า label ของล็อคที่ร้านจอง (สำหรับแสดงในหน้าจัดการร้าน / me/shop) */
export async function getLockLabelsForShop(shopId: string): Promise<string[]> {
  const parcelIds = await getShopParcelIds(shopId);
  if (parcelIds.length === 0) return [];
  const placeholders = parcelIds.map((_, i) => `$${i + 1}`).join(", ");
  const parcelRoomRes = await query<{ id: string; room_id: number; grid_x: number; grid_y: number }>(
    `SELECT id, room_id, grid_x, grid_y FROM parcels WHERE id IN (${placeholders})`,
    parcelIds
  );
  const roomRes = await query<{ id: number; name: string }>("SELECT id, name FROM rooms");
  const roomByName = Object.fromEntries(roomRes.rows.map((r: { id: number; name: string }) => [r.id, r.name ?? `ห้อง ${r.id}`]));
  return parcelRoomRes.rows.map((p: { room_id: number; grid_x: number; grid_y: number }) => {
    const roomName = roomByName[p.room_id] ?? `ห้อง ${p.room_id}`;
    return gridToLockLabel(roomName, p.grid_x, p.grid_y);
  });
}

// ==================== Products & Categories (ร้านบนแผนที่) ====================
export async function getProductsByShopId(shopId: string): Promise<Record<string, unknown>[]> {
  const res = await query(
    "SELECT id, shop_id, name, price, description, image_url, recommended, status, stock_quantity, created_at, updated_at FROM products WHERE shop_id = $1 ORDER BY created_at ASC",
    [shopId]
  );
  return res.rows as Record<string, unknown>[];
}

export async function getCategoriesByShopId(shopId: string): Promise<Record<string, unknown>[]> {
  const res = await query(
    "SELECT id, shop_id, name FROM categories WHERE shop_id = $1 ORDER BY name ASC",
    [shopId]
  );
  return res.rows as Record<string, unknown>[];
}

/** ดึง category_ids ของแต่ละ product (product_id -> category_id[]) */
export async function getProductCategoryIds(shopId: string): Promise<Map<string, string[]>> {
  const res = await query(
    "SELECT product_id, category_id FROM product_categories pc JOIN products p ON p.id = pc.product_id WHERE p.shop_id = $1",
    [shopId]
  );
  const map = new Map<string, string[]>();
  for (const row of res.rows as { product_id: string; category_id: string }[]) {
    const arr = map.get(row.product_id) ?? [];
    arr.push(row.category_id);
    map.set(row.product_id, arr);
  }
  return map;
}

export async function createProduct(
  shopId: string,
  data: { name: string; price: number; description: string; image_url: string; recommended: boolean; status: string; category_ids: string[]; stock_quantity?: number }
): Promise<Record<string, unknown>> {
  const stockQty = typeof data.stock_quantity === "number" && data.stock_quantity >= 0 ? data.stock_quantity : 0;
  const status = stockQty === 0 ? "out_of_stock" : (data.status ?? "active");
  const res = await query<{ id: string }>(
    `INSERT INTO products (shop_id, name, price, description, image_url, recommended, status, stock_quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      shopId,
      data.name.trim(),
      data.price,
      (data.description ?? "").trim(),
      (data.image_url ?? "").trim(),
      data.recommended ?? false,
      status,
      stockQty,
    ]
  );
  const productId = res.rows[0]?.id;
  if (!productId) throw new Error("สร้างสินค้าไม่สำเร็จ");
  if (Array.isArray(data.category_ids) && data.category_ids.length > 0) {
    for (const catId of data.category_ids) {
      await query("INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)", [productId, catId]);
    }
  }
  const row = await query("SELECT * FROM products WHERE id = $1", [productId]);
  return row.rows[0] as Record<string, unknown>;
}

export async function updateProduct(
  productId: string,
  data: { name?: string; price?: number; description?: string; image_url?: string; recommended?: boolean; status?: string; category_ids?: string[]; stock_quantity?: number }
): Promise<Record<string, unknown>> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.name !== undefined) {
    updates.push(`name = $${i++}`);
    values.push(data.name.trim());
  }
  if (data.price !== undefined) {
    updates.push(`price = $${i++}`);
    values.push(data.price);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${i++}`);
    values.push(data.description.trim());
  }
  if (data.image_url !== undefined) {
    updates.push(`image_url = $${i++}`);
    values.push(data.image_url.trim());
  }
  if (data.recommended !== undefined) {
    updates.push(`recommended = $${i++}`);
    values.push(data.recommended);
  }
  if (data.stock_quantity !== undefined) {
    const qty = typeof data.stock_quantity === "number" && data.stock_quantity >= 0 ? data.stock_quantity : 0;
    updates.push(`stock_quantity = $${i++}`);
    values.push(qty);
    if (qty > 0) {
      updates.push(`status = CASE WHEN status = 'out_of_stock' THEN 'active' ELSE status END`);
    } else {
      updates.push(`status = CASE WHEN status = 'active' THEN 'out_of_stock' ELSE status END`);
    }
  } else if (data.status !== undefined) {
    updates.push(`status = $${i++}`);
    values.push(data.status);
  }
  if (updates.length > 0) {
    updates.push(`updated_at = now()`);
    values.push(productId);
    await query(`UPDATE products SET ${updates.join(", ")} WHERE id = $${i}`, values);
  }
  if (data.category_ids !== undefined) {
    await query("DELETE FROM product_categories WHERE product_id = $1", [productId]);
    for (const catId of data.category_ids) {
      await query("INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)", [productId, catId]);
    }
  }
  const row = await query("SELECT * FROM products WHERE id = $1", [productId]);
  return (row.rows[0] as Record<string, unknown>) ?? null;
}

export async function deleteProduct(productId: string): Promise<boolean> {
  await query("DELETE FROM product_categories WHERE product_id = $1", [productId]);
  const res = await query("DELETE FROM products WHERE id = $1 RETURNING id", [productId]);
  return (res.rowCount ?? 0) > 0;
}

export async function createCategory(shopId: string, name: string): Promise<Record<string, unknown>> {
  const res = await query<{ id: string }>(
    "INSERT INTO categories (shop_id, name) VALUES ($1, $2) RETURNING id",
    [shopId, name.trim()]
  );
  const id = res.rows[0]?.id;
  const row = await query("SELECT * FROM categories WHERE id = $1", [id]);
  return row.rows[0] as Record<string, unknown>;
}

export async function updateCategory(categoryId: string, name: string): Promise<Record<string, unknown> | null> {
  await query("UPDATE categories SET name = $2 WHERE id = $1", [categoryId, name.trim()]);
  const row = await query("SELECT * FROM categories WHERE id = $1", [categoryId]);
  return (row.rows[0] as Record<string, unknown>) ?? null;
}

export async function deleteCategory(categoryId: string): Promise<boolean> {
  await query("DELETE FROM product_categories WHERE category_id = $1", [categoryId]);
  const res = await query("DELETE FROM categories WHERE id = $1 RETURNING id", [categoryId]);
  return (res.rowCount ?? 0) > 0;
}

// ==================== Shop follows ====================
export async function getFollowedShopIds(userId: string): Promise<string[]> {
  const res = await query<{ shop_id: string }>("SELECT shop_id FROM shop_follows WHERE user_id = $1", [userId]);
  return res.rows.map((r) => r.shop_id);
}

/** คืนค่า followed_shop_ids และ followed_parcel_ids (สำหรับ filter รายการร้านที่ติดตาม) */
export async function getFollowedShopsAndParcels(userId: string): Promise<{ shopIds: string[]; parcelIds: string[] }> {
  const res = await query<{ shop_id: string }>("SELECT shop_id FROM shop_follows WHERE user_id = $1", [userId]);
  const shopIds = res.rows.map((r) => r.shop_id);
  if (shopIds.length === 0) return { shopIds: [], parcelIds: [] };
  const placeholders = shopIds.map((_, i) => `$${i + 1}`).join(", ");
  const parcelRes = await query<{ parcel_id: string }>(
    `SELECT DISTINCT p.parcel_id
     FROM (
       SELECT s.parcel_id
       FROM shops s
       WHERE s.id IN (${placeholders}) AND s.parcel_id IS NOT NULL
       UNION ALL
       SELECT sp.parcel_id
       FROM shop_parcels sp
       WHERE sp.shop_id IN (${placeholders}) AND sp.parcel_id IS NOT NULL
     ) p`,
    shopIds
      .concat(shopIds)
  );
  const parcelIds = parcelRes.rows.map((r) => r.parcel_id).filter(Boolean);
  return { shopIds, parcelIds };
}

export async function addShopFollow(userId: string, shopId: string): Promise<boolean> {
  const res = await query(
    "INSERT INTO shop_follows (user_id, shop_id) VALUES ($1, $2) ON CONFLICT (user_id, shop_id) DO NOTHING RETURNING id",
    [userId, shopId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function removeShopFollow(userId: string, shopId: string): Promise<boolean> {
  const res = await query("DELETE FROM shop_follows WHERE user_id = $1 AND shop_id = $2 RETURNING id", [userId, shopId]);
  return (res.rowCount ?? 0) > 0;
}

export async function isFollowingShop(userId: string, shopId: string): Promise<boolean> {
  const res = await query<{ id: string }>("SELECT id FROM shop_follows WHERE user_id = $1 AND shop_id = $2", [
    userId,
    shopId,
  ]);
  return res.rows.length > 0;
}

// ==================== Shop reviews ====================
export async function getReviewsByShopId(shopId: string): Promise<
  Array<{
    id: string;
    shop_id: string;
    user_id: string;
    rating: number;
    comment: string;
    created_at: string;
    display_name?: string;
  }>
> {
  const res = await query(
    `SELECT r.id, r.shop_id, r.user_id, r.rating, r.comment, r.created_at, p.display_name
     FROM shop_reviews r
     LEFT JOIN profiles p ON p.user_id = r.user_id
     WHERE r.shop_id = $1 ORDER BY r.created_at DESC`,
    [shopId]
  );
  return res.rows as Array<{
    id: string;
    shop_id: string;
    user_id: string;
    rating: number;
    comment: string;
    created_at: string;
    display_name?: string;
  }>;
}

export async function addShopReview(
  shopId: string,
  userId: string,
  data: { rating: number; comment: string }
): Promise<Record<string, unknown>> {
  const res = await query<{ id: string }>(
    "INSERT INTO shop_reviews (shop_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id",
    [shopId, userId, Math.min(5, Math.max(1, data.rating)), (data.comment ?? "").trim()]
  );
  const row = await query(
    "SELECT r.*, p.display_name FROM shop_reviews r LEFT JOIN profiles p ON p.user_id = r.user_id WHERE r.id = $1",
    [res.rows[0]?.id]
  );
  return (row.rows[0] as Record<string, unknown>) ?? {};
}

// ==================== Product Reviews ====================

export type ProductReview = {
  id: string;
  product_id: string;
  user_id: string;
  order_item_id: string;
  rating: number;
  comment: string;
  created_at: string;
  display_name?: string;
  avatar_url?: string;
};

/** รายการรีวิวของสินค้า พร้อม display_name ผู้รีวิว */
export async function getProductReviews(productId: string): Promise<ProductReview[]> {
  const res = await query(
    `SELECT pr.id, pr.product_id, pr.user_id, pr.order_item_id, pr.rating, pr.comment, pr.created_at,
            p.display_name, p.avatar_url
     FROM product_reviews pr
     LEFT JOIN profiles p ON p.user_id = pr.user_id
     WHERE pr.product_id = $1
     ORDER BY pr.created_at DESC`,
    [productId]
  );
  return (res.rows as Array<ProductReview & { display_name?: string; avatar_url?: string }>).map((r) => ({
    id: String(r.id),
    product_id: String(r.product_id),
    user_id: String(r.user_id),
    order_item_id: String(r.order_item_id),
    rating: Number(r.rating),
    comment: String(r.comment ?? ""),
    created_at: String(r.created_at),
    display_name: r.display_name ?? undefined,
    avatar_url: r.avatar_url ?? undefined,
  }));
}

/** จำนวนสินค้าที่ขายได้จริง (นับจาก order_items ที่ received เท่านั้น) */
export async function getProductSoldCount(productId: string): Promise<number> {
  const res = await query<{ total: string }>(
    `SELECT COALESCE(SUM(quantity), 0)::text AS total
     FROM order_items
     WHERE product_id = $1 AND shipping_status = 'received'`,
    [productId]
  );
  return parseInt(res.rows[0]?.total ?? "0", 10);
}

/** ค่าเฉลี่ยดาวและจำนวนรีวิวของสินค้า */
export async function getProductRatingSummary(productId: string): Promise<{ avg_rating: number; review_count: number }> {
  const res = await query<{ avg_rating: string; review_count: string }>(
    `SELECT ROUND(AVG(rating)::numeric, 2)::text AS avg_rating, COUNT(*)::text AS review_count
     FROM product_reviews WHERE product_id = $1`,
    [productId]
  );
  return {
    avg_rating: parseFloat(res.rows[0]?.avg_rating ?? "0"),
    review_count: parseInt(res.rows[0]?.review_count ?? "0", 10),
  };
}

/** สถิติรีวิวและยอดขายของทุกสินค้าในร้าน (ใช้ batch แทน N ครั้ง getProductRatingSummary + getProductSoldCount) */
export async function getProductStatsByShopId(
  shopId: string
): Promise<Record<string, { avg_rating: number; review_count: number; sold_count: number }>> {
  const [ratingRows, soldRows] = await Promise.all([
    query<{ product_id: string; avg_rating: string; review_count: string }>(
      `SELECT pr.product_id,
              ROUND(AVG(pr.rating)::numeric, 2)::text AS avg_rating,
              COUNT(*)::text AS review_count
       FROM product_reviews pr
       INNER JOIN products p ON p.id = pr.product_id AND p.shop_id = $1
       GROUP BY pr.product_id`,
      [shopId]
    ),
    query<{ product_id: string; total: string }>(
      `SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0)::text AS total
       FROM order_items oi
       INNER JOIN products p ON p.id = oi.product_id AND p.shop_id = $1
       WHERE oi.shipping_status = 'received'
       GROUP BY oi.product_id`,
      [shopId]
    ),
  ]);
  const map: Record<string, { avg_rating: number; review_count: number; sold_count: number }> = {};
  for (const r of ratingRows.rows) {
    map[r.product_id] = {
      avg_rating: parseFloat(r.avg_rating ?? "0"),
      review_count: parseInt(r.review_count ?? "0", 10),
      sold_count: 0,
    };
  }
  for (const s of soldRows.rows) {
    if (!map[s.product_id]) map[s.product_id] = { avg_rating: 0, review_count: 0, sold_count: 0 };
    map[s.product_id].sold_count = parseInt(s.total ?? "0", 10);
  }
  return map;
}

/**
 * เพิ่มรีวิวสินค้า — ตรวจสอบ:
 * 1. order_item ต้อง shipping_status = 'received'
 * 2. order ต้องเป็นของ userId คนนี้
 * 3. ยังไม่เคยรีวิว order_item นี้ (UNIQUE constraint)
 * 4. เจ้าของร้านรีวิวตัวเองไม่ได้
 */
export async function addProductReview(
  userId: string,
  data: { product_id: string; order_item_id: string; rating: number; comment: string }
): Promise<ProductReview> {
  const itemRes = await query<{
    id: string; product_id: string; shipping_status: string; order_user_id: string; shop_user_id: string;
  }>(
    `SELECT oi.id, oi.product_id, COALESCE(oi.shipping_status,'pending_confirmation') AS shipping_status,
            o.user_id AS order_user_id, s.user_id AS shop_user_id
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN shops s ON s.id = oi.shop_id
     WHERE oi.id = $1`,
    [data.order_item_id]
  );
  const item = itemRes.rows[0];
  if (!item) throw new Error("ไม่พบรายการสั่งซื้อ");
  if (item.order_user_id !== userId) throw new Error("คุณไม่มีสิทธิ์รีวิวรายการนี้");
  if (item.shipping_status !== "received") throw new Error("กรุณารับสินค้าก่อน จึงจะรีวิวได้");
  if (item.product_id !== data.product_id) throw new Error("สินค้าไม่ตรงกับรายการสั่งซื้อ");
  if (item.shop_user_id === userId) throw new Error("เจ้าของร้านไม่สามารถรีวิวสินค้าตัวเองได้");

  const rating = Math.min(5, Math.max(1, Math.round(data.rating)));
  const res = await query<{ id: string }>(
    `INSERT INTO product_reviews (product_id, user_id, order_item_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [data.product_id, userId, data.order_item_id, rating, (data.comment ?? "").trim()]
  );
  const row = await query(
    `SELECT pr.*, p.display_name, p.avatar_url
     FROM product_reviews pr
     LEFT JOIN profiles p ON p.user_id = pr.user_id
     WHERE pr.id = $1`,
    [res.rows[0].id]
  );
  const r = row.rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    product_id: String(r.product_id),
    user_id: String(r.user_id),
    order_item_id: String(r.order_item_id),
    rating: Number(r.rating),
    comment: String(r.comment ?? ""),
    created_at: String(r.created_at),
    display_name: r.display_name ? String(r.display_name) : undefined,
    avatar_url: r.avatar_url ? String(r.avatar_url) : undefined,
  };
}

/**
 * ดึงรายการ order_items ที่ผู้ใช้รับแล้ว (received) และยังไม่ได้รีวิว product นั้น
 * ใช้สำหรับแสดงปุ่ม "เขียนรีวิว" ในหน้า tracking
 */
export async function getUnreviewedReceivedItems(userId: string): Promise<Array<{
  order_item_id: string;
  product_id: string;
  product_name: string;
  product_image_url: string;
  shop_name: string;
}>> {
  const res = await query(
    `SELECT oi.id AS order_item_id, oi.product_id, oi.product_name, oi.product_image_url, s.shop_name
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN shops s ON s.id = oi.shop_id
     WHERE o.user_id = $1
       AND oi.shipping_status = 'received'
       AND NOT EXISTS (
         SELECT 1 FROM product_reviews pr WHERE pr.order_item_id = oi.id
       )
     ORDER BY oi.id`,
    [userId]
  );
  return (res.rows as Array<Record<string, unknown>>).map((r) => ({
    order_item_id: String(r.order_item_id),
    product_id: String(r.product_id),
    product_name: String(r.product_name),
    product_image_url: String(r.product_image_url ?? ""),
    shop_name: String(r.shop_name ?? ""),
  }));
}

// ==================== Orders ====================
export async function getOrdersList(): Promise<Record<string, unknown>[]> {
  const res = await query("SELECT * FROM orders ORDER BY created_at DESC");
  return res.rows as Record<string, unknown>[];
}

export async function getOrderItemsList(): Promise<Record<string, unknown>[]> {
  const res = await query("SELECT * FROM order_items ORDER BY order_id, id");
  return res.rows as Record<string, unknown>[];
}

// ==================== Orders ====================
export type CreateOrderItem = {
  shopId: string;
  productId: string;
  productName: string;
  productImageUrl: string;
  price: number;
  quantity: number;
};

/** การซื้อจากร้านในตลาด: สร้างคำสั่งซื้อ + ตัดเหรียญ (escrow). เมื่อลูกค้ารับของ (received) จะสร้าง shop_payouts โอนให้ร้าน */
export async function createOrder(
  userId: string,
  data: {
    subtotal: number;
    gas_fee: number;
    total: number;
    items: CreateOrderItem[];
  }
): Promise<{ id: string; status: string; total: number; created_at: string }> {
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("ไม่มีสินค้าในคำสั่งซื้อ");
  }

  return withTransaction(async (client: PoolClient) => {
    const normalizedItems: Array<{
      shopId: string;
      productId: string;
      productName: string;
      productImageUrl: string;
      price: number;
      quantity: number;
      lineTotal: number;
    }> = [];

    for (const item of data.items) {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 0));
      if (!item.shopId || !item.productId || qty <= 0) {
        throw new Error("ข้อมูลสินค้าไม่ครบถ้วน");
      }
      const productRes = await client.query<{
        id: string;
        shop_id: string;
        name: string;
        price: string;
        image_url: string | null;
        stock_quantity: number;
        status: string | null;
      }>(
        `SELECT id, shop_id, name, price::text AS price, image_url, COALESCE(stock_quantity, 0) AS stock_quantity, status
         FROM products
         WHERE id = $1
         FOR UPDATE`,
        [item.productId]
      );
      const product = productRes.rows[0];
      if (!product) throw new Error("ไม่พบสินค้า");
      if (product.shop_id !== item.shopId) throw new Error("ข้อมูลร้านค้าไม่ถูกต้อง");
      if ((product.status ?? "active") === "out_of_stock") throw new Error(`สินค้า ${product.name} หมดสต็อก`);
      if (product.stock_quantity < qty) throw new Error(`สินค้า ${product.name} คงเหลือไม่พอ`);

      const dbPrice = Number(product.price);
      const lineTotal = dbPrice * qty;
      normalizedItems.push({
        shopId: product.shop_id,
        productId: product.id,
        productName: product.name,
        productImageUrl: product.image_url ?? "",
        price: dbPrice,
        quantity: qty,
        lineTotal,
      });
    }

    // รวมรายการสินค้าเดียวกัน (ร้านเดียวกัน + product เดียวกัน) เป็น 1 บรรทัด เพื่อไม่ให้ขายแล้วนับซ้ำ
    const mergedByProduct = new Map<
      string,
      { shopId: string; productId: string; productName: string; productImageUrl: string; price: number; quantity: number; lineTotal: number }
    >();
    for (const i of normalizedItems) {
      const key = `${i.shopId}:${i.productId}`;
      const existing = mergedByProduct.get(key);
      if (existing) {
        existing.quantity += i.quantity;
        existing.lineTotal += i.lineTotal;
      } else {
        mergedByProduct.set(key, { ...i });
      }
    }
    const mergedItems = Array.from(mergedByProduct.values());

    // ตรวจสต็อกอีกครั้งหลังรวมบรรทัด (จำนวนที่รวมอาจมากกว่าที่เช็คทีละบรรทัด)
    for (const item of mergedItems) {
      const stockRes = await client.query<{ stock_quantity: number }>(
        "SELECT COALESCE(stock_quantity, 0) AS stock_quantity FROM products WHERE id = $1",
        [item.productId]
      );
      const stock = Number(stockRes.rows[0]?.stock_quantity ?? 0);
      if (stock < item.quantity) {
        throw new Error(`สินค้า ${item.productName} คงเหลือไม่พอ (ต้องการ ${item.quantity} ชิ้น)`);
      }
    }

    const subtotal = mergedItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const gasFee = subtotal > 0 ? Math.max(0, Number(data.gas_fee) || 0) : 0;
    const total = subtotal + gasFee;
    const isFree = total === 0;

    if (!isFree && !isDemoMode()) {
      const balRes = await client.query<{ balance: string }>(
        "SELECT balance::text AS balance FROM user_balances WHERE user_id = $1 FOR UPDATE",
        [userId]
      );
      const balance = parseFloat(balRes.rows[0]?.balance ?? "0");
      if (balance < total) {
        throw new Error(`เหรียญไม่เพียงพอ (มี ${balance} เหรียญ ต้องใช้ ${total} เหรียญ)`);
      }
    }

    const orderRes = await client.query<{ id: string; status: string; total: string; created_at: string }>(
      `INSERT INTO orders (user_id, status, subtotal, gas_fee, total)
       VALUES ($1, 'pending', $2, $3, $4)
       RETURNING id, status, total, created_at`,
      [userId, subtotal, gasFee, total]
    );
    const order = orderRes.rows[0];
    if (!order) throw new Error("สร้างคำสั่งซื้อไม่สำเร็จ");

    for (const item of mergedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, shop_id, product_id, product_name, product_image_url, price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [order.id, item.shopId, item.productId, item.productName, item.productImageUrl, item.price, item.quantity, item.lineTotal]
      );
      // หักสต็อก และถ้าเหลือ 0 ให้เปลี่ยนสถานะเป็นไม่แสดง (out_of_stock)
      await client.query(
        `UPDATE products
         SET stock_quantity = GREATEST(0, stock_quantity - $2),
             status = CASE WHEN (stock_quantity - $2) <= 0 THEN 'out_of_stock' ELSE status END,
             updated_at = now()
         WHERE id = $1`,
        [item.productId, item.quantity]
      );
    }

    if (!isFree && !isDemoMode()) {
      await client.query(
        "UPDATE user_balances SET balance = balance - $2 WHERE user_id = $1",
        [userId, total]
      );
    }

    return {
      id: order.id,
      status: order.status,
      total: parseFloat(order.total),
      created_at: new Date(order.created_at).toISOString(),
    };
  });
}

/** คำสั่งซื้อของลูกค้า (ผู้รับ) พร้อมรายการแยกตามร้าน — สำหรับหน้าติดตามสินค้า */
export async function getOrdersWithItemsForBuyer(userId: string): Promise<{
  orders: Array<{
    id: string;
    user_id: string;
    status: string;
    total: number;
    created_at: string;
    items: Array<{
      id: string;
      order_id: string;
      shop_id: string;
      shop_name: string;
      product_name: string;
      product_image_url: string;
      quantity: number;
      line_total: number;
      shipping_status: string;
      tracking_number: string | null;
      shipping_notes: string | null;
      shipped_at: string | null;
      received_at: string | null;
      proof_url: string | null;
    }>;
  }>;
}> {
  const ordersRes = await query<{ id: string; user_id: string; status: string; total: string; created_at: string }>(
    "SELECT id, user_id, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  const orders = ordersRes.rows;
  if (orders.length === 0) return { orders: [] };
  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(", ");
  const itemsRes = await query(
    `SELECT oi.id, oi.order_id, oi.shop_id, s.shop_name, oi.product_name, oi.product_image_url, oi.quantity, oi.line_total,
            COALESCE(oi.shipping_status, 'pending_confirmation') AS shipping_status,
            oi.tracking_number, oi.shipping_notes, oi.shipped_at, oi.received_at, oi.proof_url
     FROM order_items oi
     JOIN shops s ON s.id = oi.shop_id
     WHERE oi.order_id IN (${placeholders})
     ORDER BY oi.order_id, oi.id`,
    orderIds
  );
  type OrderItemRow = {
    id: string;
    order_id: string;
    shop_id: string;
    shop_name: string;
    product_name: string;
    product_image_url: string;
    quantity: number;
    line_total: number;
    shipping_status: string;
    tracking_number: string | null;
    shipping_notes: string | null;
    shipped_at: string | null;
    received_at: string | null;
    proof_url: string | null;
  };
  const items = itemsRes.rows as Array<Omit<OrderItemRow, "line_total"> & { line_total: string }>;
  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const row of items) {
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push({ ...row, line_total: Number(row.line_total) });
    itemsByOrder.set(row.order_id, list);
  }
  return {
    orders: orders.map((o) => ({
      id: o.id,
      user_id: o.user_id,
      status: o.status,
      total: Number(o.total),
      created_at: o.created_at,
      items: itemsByOrder.get(o.id) ?? [],
    })),
  };
}

/** รายการที่ต้องจ่ายจากการเช่าพื้นที่ (ใบแจ้งชำระ) ของ user */
export async function getRentalInvoicesByUserId(userId: string): Promise<
  Array<{
    id: string;
    user_id: string;
    shop_id: string;
    amount: number;
    description: string;
    status: string;
    due_date: string | null;
    paid_at: string | null;
    created_at: string;
  }>
> {
  const res = await query<{
    id: string;
    user_id: string;
    shop_id: string;
    amount: string;
    description: string;
    status: string;
    due_date: string | null;
    paid_at: string | null;
    created_at: string;
  }>(
    `SELECT id, user_id, shop_id, amount, description, status, due_date, paid_at, created_at
     FROM parcel_rental_invoices
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
  }));
}

/** รายการสั่งซื้อที่ร้านเป็นผู้ขาย (ผู้ส่ง) — สำหรับหน้าร้านกดยืนยัน/จัดส่ง */
export async function getOrderItemsForShop(shopId: string): Promise<
  Array<{
    id: string;
    order_id: string;
    shop_id: string;
    product_name: string;
    product_image_url: string;
    quantity: number;
    line_total: number;
    shipping_status: string;
    tracking_number: string | null;
    shipping_notes: string | null;
    shipped_at: string | null;
    received_at: string | null;
    proof_url: string | null;
    order_created_at: string;
  }>
> {
  const res = await query(
    `SELECT oi.id, oi.order_id, oi.shop_id, oi.product_name, oi.product_image_url, oi.quantity, oi.line_total,
            COALESCE(oi.shipping_status, 'pending_confirmation') AS shipping_status,
            oi.tracking_number, oi.shipping_notes, oi.shipped_at, oi.received_at, oi.proof_url,
            o.created_at AS order_created_at
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.shop_id = $1
     ORDER BY o.created_at DESC, oi.id`,
    [shopId]
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    order_id: String(r.order_id),
    shop_id: String(r.shop_id),
    product_name: String(r.product_name),
    product_image_url: String(r.product_image_url ?? ""),
    quantity: Number(r.quantity),
    line_total: Number(r.line_total),
    shipping_status: String(r.shipping_status ?? "pending_confirmation"),
    tracking_number: r.tracking_number != null ? String(r.tracking_number) : null,
    shipping_notes: r.shipping_notes != null ? String(r.shipping_notes) : null,
    shipped_at: r.shipped_at != null ? String(r.shipped_at) : null,
    received_at: r.received_at != null ? String(r.received_at) : null,
    proof_url: r.proof_url != null ? String(r.proof_url) : null,
    order_created_at: String(r.order_created_at),
  }));
}

export async function getOrderItemById(itemId: string): Promise<{
  item: Record<string, unknown>;
  order: Record<string, unknown>;
  shop: Record<string, unknown>;
} | null> {
  const res = await query(
    `SELECT oi.*, o.user_id AS order_user_id, o.created_at AS order_created_at,
            s.id AS shop_id, s.user_id AS shop_user_id, s.shop_name
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN shops s ON s.id = oi.shop_id
     WHERE oi.id = $1`,
    [itemId]
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const order = { id: row.order_id, user_id: row.order_user_id, created_at: row.order_created_at };
  const shop = { id: row.shop_id, user_id: row.shop_user_id, shop_name: row.shop_name };
  const item = { ...row };
  delete item.order_user_id;
  delete item.order_created_at;
  delete item.shop_id;
  delete item.shop_user_id;
  delete item.shop_name;
  return { item, order, shop };
}

export type OrderItemShippingUpdate = {
  shipping_status?: "pending_confirmation" | "preparing" | "shipped" | "received";
  tracking_number?: string;
  shipping_notes?: string;
  proof_url?: string;
};

export async function updateOrderItemShipping(
  itemId: string,
  data: OrderItemShippingUpdate
): Promise<Record<string, unknown> | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.shipping_status !== undefined) {
    updates.push(`shipping_status = $${i}`);
    values.push(data.shipping_status);
    i += 1;
    if (data.shipping_status === "shipped") {
      updates.push("shipped_at = NOW()");
    }
    if (data.shipping_status === "received") {
      updates.push("received_at = NOW()");
    }
  }
  if (data.tracking_number !== undefined) {
    updates.push(`tracking_number = $${i}`);
    values.push(data.tracking_number);
    i += 1;
  }
  if (data.shipping_notes !== undefined) {
    updates.push(`shipping_notes = $${i}`);
    values.push(data.shipping_notes);
    i += 1;
  }
  if (data.proof_url !== undefined) {
    updates.push(`proof_url = $${i}`);
    values.push(data.proof_url);
    i += 1;
  }
  if (updates.length === 0) return null;
  values.push(itemId);
  const res = await query(
    `UPDATE order_items SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (row && data.shipping_status === "received") {
    const shopId = row.shop_id as string;
    const orderId = row.order_id as string;
    const orderItemId = row.id as string;
    const lineTotal = Number(row.line_total ?? 0);
    if (shopId && orderId && orderItemId && lineTotal >= 0) {
      await query(
        `INSERT INTO shop_payouts (shop_id, order_id, order_item_id, amount, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (order_item_id) DO NOTHING`,
        [shopId, orderId, orderItemId, lineTotal]
      ).catch((err) => {
        console.error("insert shop_payout on received:", err);
      });
    }
  }
  return row ?? null;
}

// ==================== Verification documents ====================
export async function getShopDetail(shopId: string): Promise<{
  shop: Record<string, unknown> | null;
  reg: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  address: Record<string, unknown> | null;
  productCount: number;
  products: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  payouts: Record<string, unknown>[];
  rooms: { id: number; name: string; background_url: string | null; slot_price_per_day: number; min_rent_days: number }[];
  parcels: Record<string, unknown>[];
  shop_parcel_ids: string[];
}> {
  let shop = await getShopById(shopId);
  const rooms = await getRooms();
  const parcelsRes = await query(
    "SELECT id, room_id, grid_x, grid_y, width, height FROM parcels"
  );
  const parcels = parcelsRes.rows as Record<string, unknown>[];
  const shop_parcel_ids = shop ? await getShopParcelIds(shopId) : [];

  // ถ้าหา shop ไม่เจอ ให้ลองหาจาก shop_registrations แทน (เมื่อ CMS ส่ง reg.id มา)
  let regFromId: Record<string, unknown> | null = null;
  if (!shop) {
    const regRes2 = await query("SELECT * FROM shop_registrations WHERE id = $1", [shopId]);
    if (regRes2.rows.length > 0) {
      regFromId = regRes2.rows[0] as Record<string, unknown>;
      // ลองหา shop จาก user_id ของ registration นั้น
      const regUserId = (regFromId as { user_id: string }).user_id;
      const shopFromReg = await query("SELECT * FROM shops WHERE user_id = $1 LIMIT 1", [regUserId]);
      if (shopFromReg.rows.length > 0) {
        shop = shopFromReg.rows[0] as Record<string, unknown>;
      }
    }
  }

  if (!shop && !regFromId) {
    return {
      shop: null,
      reg: null,
      profile: null,
      address: null,
      productCount: 0,
      products: [],
      categories: [],
      payouts: [],
      rooms,
      parcels,
      shop_parcel_ids: [],
    };
  }

  // ถ้ามีแค่ registration (ยังไม่มี shop) ให้คืน reg + profile
  if (!shop && regFromId) {
    const regUserId2 = (regFromId as { user_id: string }).user_id;
    const profileRes2 = await query("SELECT * FROM profiles WHERE user_id = $1", [regUserId2]);
    const profile2 = (profileRes2.rows[0] as Record<string, unknown>) ?? null;
    let addressId2: string | null = null;
    const regUseSame2 = (regFromId as { use_same_as_user_address?: boolean }).use_same_as_user_address;
    if (regUseSame2 && profile2 && typeof (profile2 as { address_id?: string }).address_id === "string") {
      addressId2 = (profile2 as { address_id: string }).address_id;
    } else if (typeof (regFromId as { address_id?: string }).address_id === "string") {
      addressId2 = (regFromId as { address_id: string }).address_id;
    }
    const addressRow2 = addressId2 ? await getAddressById(addressId2) : null;
    return {
      shop: null,
      reg: regFromId,
      profile: profile2,
      address: addressRow2 ? (addressRow2 as unknown as Record<string, unknown>) : null,
      productCount: 0,
      products: [],
      categories: [],
      payouts: [],
      rooms,
      parcels,
      shop_parcel_ids: [],
    };
  }

  const userId = (shop as { user_id: string }).user_id;
  const [regRes, profileRes, products, categories, categoryIdsMap, payoutsRes] = await Promise.all([
    query("SELECT * FROM shop_registrations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [userId]),
    query("SELECT * FROM profiles WHERE user_id = $1", [userId]),
    getProductsByShopId(shopId),
    getCategoriesByShopId(shopId),
    getProductCategoryIds(shopId),
    query<{ id: string; order_id: string; order_item_id: string; amount: string; status: string; paid_at: Date | null; created_at: Date }>(
      "SELECT id, order_id, order_item_id, amount::text AS amount, status, paid_at, created_at FROM shop_payouts WHERE shop_id = $1 ORDER BY created_at DESC",
      [shopId]
    ),
  ]);
  const reg = (regRes.rows[0] as Record<string, unknown>) ?? null;
  const profile = (profileRes.rows[0] as Record<string, unknown>) ?? null;
  const productCount = products.length;
  const productsWithCategories = (products as Record<string, unknown>[]).map((p) => ({
    ...p,
    category_ids: categoryIdsMap.get((p.id as string) ?? "") ?? [],
  }));
  const payouts = (payoutsRes.rows ?? []).map((r) => ({
    id: r.id,
    order_id: r.order_id,
    order_item_id: r.order_item_id,
    amount: parseFloat(r.amount || "0"),
    status: r.status,
    paid_at: r.paid_at ? r.paid_at.toISOString() : null,
    created_at: r.created_at.toISOString(),
  }));
  let addressId: string | null = null;
  const useSame = (shop as { use_same_as_user_address?: boolean }).use_same_as_user_address;
  if (useSame && profile && typeof (profile as { address_id?: string }).address_id === "string") {
    addressId = (profile as { address_id: string }).address_id;
  } else if (typeof (shop as { address_id?: string }).address_id === "string") {
    addressId = (shop as { address_id: string }).address_id;
  }
  if (!addressId && reg) {
    const regUseSame = (reg as { use_same_as_user_address?: boolean }).use_same_as_user_address;
    if (regUseSame && profile && typeof (profile as { address_id?: string }).address_id === "string") {
      addressId = (profile as { address_id: string }).address_id;
    } else if (typeof (reg as { address_id?: string }).address_id === "string") {
      addressId = (reg as { address_id: string }).address_id;
    }
  }
  const addressRow = addressId ? await getAddressById(addressId) : null;
  const address = addressRow ? (addressRow as unknown as Record<string, unknown>) : null;
  return {
    shop,
    reg,
    profile,
    address,
    productCount,
    shop_parcel_ids,
    products: productsWithCategories,
    categories,
    payouts,
    rooms,
    parcels,
  };
}

export async function getVerificationDocumentsList(): Promise<Record<string, unknown>[]> {
  const res = await query(
    "SELECT id, shop_id, document_type, file_url, file_name, status, created_at FROM shop_verification_documents ORDER BY created_at DESC"
  );
  return res.rows as Record<string, unknown>[];
}

export async function insertShopVerificationDocument(data: {
  shop_id: string;
  document_type: string;
  file_url: string;
}): Promise<void> {
  await query(
    "INSERT INTO shop_verification_documents (shop_id, document_type, file_url, status) VALUES ($1, $2, $3, 'pending')",
    [data.shop_id, data.document_type, data.file_url]
  );
}

// ==================== Shop payouts ====================
/** รายการรายได้ร้านของ user (เจ้าของร้าน) — ใช้ในหน้า ตรวจสอบรายรับ */
export async function getPayoutsByUserId(userId: string): Promise<
  { id: string; order_id: string; order_item_id: string; amount: number; status: string; paid_at: string | null; created_at: string }[]
> {
  const res = await query<{ id: string; order_id: string; order_item_id: string; amount: string; status: string; paid_at: Date | null; created_at: Date }>(
    `SELECT sp.id, sp.order_id, sp.order_item_id, sp.amount::text AS amount, sp.status, sp.paid_at, sp.created_at
     FROM shop_payouts sp INNER JOIN shops s ON s.id = sp.shop_id WHERE s.user_id = $1 ORDER BY sp.created_at DESC`,
    [userId]
  );
  return (res.rows ?? []).map((r) => ({
    id: r.id,
    order_id: r.order_id,
    order_item_id: r.order_item_id,
    amount: parseFloat(r.amount || "0"),
    status: r.status,
    paid_at: r.paid_at ? r.paid_at.toISOString() : null,
    created_at: r.created_at.toISOString(),
  }));
}

/** จ่ายให้ร้าน (อัปเดต status เป็น completed + เพิ่ม balance ให้เจ้าของร้าน) — คืน error ถ้าไม่พบหรือจ่ายไปแล้ว */
export async function completeShopPayout(payoutId: string): Promise<{ ok: true } | { error: string }> {
  const row = await query<{ id: string; shop_id: string; amount: string; status: string }>(
    "SELECT id, shop_id, amount::text AS amount, status FROM shop_payouts WHERE id = $1",
    [payoutId]
  );
  const p = row.rows[0];
  if (!p) return { error: "ไม่พบรายการจ่าย" };
  if (p.status !== "pending") return { error: "รายการนี้จ่ายไปแล้วหรือยกเลิกแล้ว" };
  const shopRow = await query<{ user_id: string }>("SELECT user_id FROM shops WHERE id = $1", [p.shop_id]);
  const shopOwnerId = shopRow.rows[0]?.user_id;
  if (!shopOwnerId) return { error: "ไม่พบเจ้าของร้าน" };
  const amount = parseFloat(p.amount || "0");
  if (amount <= 0) return { error: "ยอดไม่ถูกต้อง" };
  await withTransaction(async (client) => {
    await client.query(
      "UPDATE shop_payouts SET status = 'completed', paid_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'pending'",
      [payoutId]
    );
    await client.query(
      `INSERT INTO user_balances (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = user_balances.balance + EXCLUDED.balance`,
      [shopOwnerId, amount]
    );
  });
  await addUserNotification(
    shopOwnerId,
    "payout_completed",
    "เงินเข้าแล้ว",
    `รายการจ่ายจำนวน ${amount} เหรียญเข้าบัญชีแล้ว — ตรวจสอบได้ที่เมนูตรวจสอบรายรับ`,
    "/manage-shop/revenue",
    { payoutId, amount }
  ).catch((err) => console.error("addUserNotification payout_completed:", err));
  return { ok: true };
}

// ==================== Promo zones ====================
export async function getPromoZonesByRoom(): Promise<Record<number, Record<string, { isLabel: boolean; imageUrl?: string }>>> {
  const res = await query<{ room_id: number; zone_key: string; is_label: boolean; image_url: string | null }>(
    "SELECT room_id, zone_key, is_label, image_url FROM promo_zones"
  );
  const out: Record<number, Record<string, { isLabel: boolean; imageUrl?: string }>> = {};
  for (const row of res.rows) {
    if (!out[row.room_id]) out[row.room_id] = {};
    out[row.room_id][row.zone_key] = {
      isLabel: row.is_label,
      imageUrl: row.image_url ?? undefined,
    };
  }
  return out;
}

export async function setPromoZones(
  roomId: number,
  promos: Record<string, { isLabel: boolean; imageUrl?: string }>
): Promise<void> {
  await query("DELETE FROM promo_zones WHERE room_id = $1", [roomId]);
  for (const [zoneKey, entry] of Object.entries(promos)) {
    await query(
      "INSERT INTO promo_zones (room_id, zone_key, is_label, image_url) VALUES ($1, $2, $3, $4)",
      [roomId, zoneKey, entry.isLabel, entry.imageUrl ?? null]
    );
  }
}

// ==================== Parcel booking audit ====================
export type ParcelBookingAuditInsert = {
  actor_type: "user" | "admin";
  actor_id: string;
  room_id: number;
  parcel_id: string | null;
  slots: { grid_x: number; grid_y: number }[];
  amount_paid: number;
  registration_id?: string | null;
  shop_id?: string | null;
  outcome?: "success" | "failed";
};

export async function insertParcelBookingAudit(
  data: ParcelBookingAuditInsert,
  client?: PoolClient
): Promise<void> {
  const slotsJson = JSON.stringify(data.slots);
  const slotCount = data.slots.length;
  const outcome = data.outcome ?? "success";
  const run = client ? (q: string, v: unknown[]) => client.query(q, v) : (q: string, v: unknown[]) => query(q, v);
  await run(
    `INSERT INTO parcel_booking_audit (actor_type, actor_id, room_id, parcel_id, slots, slot_count, amount_paid, registration_id, shop_id, outcome)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)`,
    [
      data.actor_type,
      data.actor_id,
      data.room_id,
      data.parcel_id ?? null,
      slotsJson,
      slotCount,
      data.amount_paid,
      data.registration_id ?? null,
      data.shop_id ?? null,
      outcome,
    ]
  );
}

export type ParcelBookingAuditFilters = {
  room_id?: number;
  actor_type?: "user" | "admin";
  actor_id?: string;
  shop_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
};

export async function getParcelBookingAudit(
  filters: ParcelBookingAuditFilters
): Promise<
  {
    id: string;
    created_at: string;
    actor_type: string;
    actor_id: string;
    room_id: number;
    parcel_id: string | null;
    slot_count: number;
    amount_paid: number;
    registration_id: string | null;
    shop_id: string | null;
    outcome: string;
  }[]
> {
  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];
  let idx = 1;
  if (filters.room_id != null) {
    conditions.push(`room_id = $${idx++}`);
    values.push(filters.room_id);
  }
  if (filters.actor_type) {
    conditions.push(`actor_type = $${idx++}`);
    values.push(filters.actor_type);
  }
  if (filters.actor_id) {
    conditions.push(`actor_id = $${idx++}`);
    values.push(filters.actor_id);
  }
  if (filters.shop_id) {
    conditions.push(`shop_id = $${idx++}`);
    values.push(filters.shop_id);
  }
  if (filters.from_date) {
    conditions.push(`created_at >= $${idx++}::timestamptz`);
    values.push(filters.from_date);
  }
  if (filters.to_date) {
    conditions.push(`created_at <= $${idx++}::timestamptz`);
    values.push(filters.to_date);
  }
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);
  values.push(limit, offset);
  const res = await query<{
    id: string;
    created_at: Date;
    actor_type: string;
    actor_id: string;
    room_id: number;
    parcel_id: string | null;
    slot_count: number;
    amount_paid: string;
    registration_id: string | null;
    shop_id: string | null;
    outcome: string;
  }>(
    `SELECT id, created_at, actor_type, actor_id, room_id, parcel_id, slot_count, amount_paid::text AS amount_paid, registration_id, shop_id, outcome
     FROM parcel_booking_audit WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    values
  );
  return res.rows.map((r) => ({
    id: r.id,
    created_at: r.created_at.toISOString(),
    actor_type: r.actor_type,
    actor_id: r.actor_id,
    room_id: r.room_id,
    parcel_id: r.parcel_id,
    slot_count: r.slot_count,
    amount_paid: parseFloat(r.amount_paid || "0"),
    registration_id: r.registration_id,
    shop_id: r.shop_id,
    outcome: r.outcome,
  }));
}

// ==================== Book parcel ====================
/** จองล็อคเพิ่มให้ร้าน (ร้านมีที่แล้ว — เพิ่ม parcel แล้วใส่ shop_parcels) — ใช้จาก CMS จองเพิ่ม */
export async function addParcelToShop(
  shopId: string,
  roomId: number,
  slots: { grid_x: number; grid_y: number }[]
): Promise<
  | { parcel: { id: string; room_id: number; grid_x: number; grid_y: number; width: number; height: number; title: string }; shop_id: string }
  | { error: string }
> {
  if (slots.length === 0) return { error: "ไม่มีช่องที่เลือก" };
  const shopRes = await query<{ id: string; user_id: string; shop_name: string; description: string; logo_url: string | null; cover_url: string | null; logo_background_color: string | null }>(
    "SELECT id, user_id, shop_name, description, logo_url, cover_url, logo_background_color FROM shops WHERE id = $1",
    [shopId]
  );
  const shop = shopRes.rows[0];
  if (!shop) return { error: "ไม่พบร้าน" };
  const parcelRangesRes = await query<{ grid_x: number; grid_y: number; width: number; height: number }>(
    "SELECT grid_x, grid_y, width, height FROM parcels WHERE room_id = $1",
    [roomId]
  );
  const buildOccupied = (rows: { grid_x: number; grid_y: number; width: number; height: number }[]) => {
    const set = new Set<string>();
    for (const r of rows) {
      for (let dx = 0; dx < (r.width || 1); dx++) {
        for (let dy = 0; dy < (r.height || 1); dy++) set.add(`${r.grid_x + dx},${r.grid_y + dy}`);
      }
    }
    return set;
  };
  const occupied = buildOccupied(parcelRangesRes.rows);
  const blocked = await getBlockedSlotsForRoom(roomId);
  for (const b of blocked) occupied.add(`${b.grid_x},${b.grid_y}`);
  for (const s of slots) {
    if (occupied.has(`${s.grid_x},${s.grid_y}`)) return { error: `ช่อง (${s.grid_x}, ${s.grid_y}) ถูกจองแล้วหรือปิดจอง` };
  }
  const minX = Math.min(...slots.map((s) => s.grid_x));
  const minY = Math.min(...slots.map((s) => s.grid_y));
  const maxX = Math.max(...slots.map((s) => s.grid_x));
  const maxY = Math.max(...slots.map((s) => s.grid_y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const parcelId = `p-room${roomId}-${Date.now()}`;
  const parcelImageUrl = (shop.cover_url ?? shop.logo_url ?? "").trim() || "";
  await query(
    `INSERT INTO parcels (id, room_id, owner_id, grid_x, grid_y, width, height, title, description, image_url, is_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)`,
    [parcelId, roomId, shop.user_id, minX, minY, width, height, shop.shop_name, shop.description ?? "", parcelImageUrl]
  );
  await query("INSERT INTO shop_parcels (shop_id, parcel_id) VALUES ($1, $2)", [shopId, parcelId]);
  return {
    parcel: { id: parcelId, room_id: roomId, grid_x: minX, grid_y: minY, width, height, title: shop.shop_name },
    shop_id: shopId,
  };
}

export async function bookParcel(
  registrationId: string,
  roomId: number,
  slots: { grid_x: number; grid_y: number }[],
  adminId?: string
): Promise<
  | { parcel: { id: string; room_id: number; owner_id: string; grid_x: number; grid_y: number; width: number; height: number; title: string; is_label: boolean }; shop: { id: string; user_id: string; parcel_id: string; shop_name: string; verification_status: string; membership_plan: string | null; membership_expires_at: null } }
  | { error: string }
> {
  if (slots.length === 0) return { error: "ไม่มีช่องที่เลือก" };
  const regRes = await query<{ user_id: string; shop_name: string; description: string; logo_url: string | null; cover_url: string | null; logo_background_color: string | null }>(
    "SELECT user_id, shop_name, description, logo_url, cover_url, logo_background_color FROM shop_registrations WHERE id = $1",
    [registrationId]
  );
  const reg = regRes.rows[0];
  if (!reg) return { error: "ไม่พบการลงทะเบียนร้าน" };
  const existingShop = await getShopByUserId(reg.user_id);
  if (existingShop?.parcel_id != null) return { error: "ร้านนี้มีที่เช่าแล้ว" };
  const parcelRangesRes = await query<{ grid_x: number; grid_y: number; width: number; height: number }>(
    "SELECT grid_x, grid_y, width, height FROM parcels WHERE room_id = $1",
    [roomId]
  );
  const buildOccupiedAdmin = (rows: { grid_x: number; grid_y: number; width: number; height: number }[]) => {
    const set = new Set<string>();
    for (const r of rows) {
      for (let dx = 0; dx < (r.width || 1); dx++) {
        for (let dy = 0; dy < (r.height || 1); dy++) set.add(`${r.grid_x + dx},${r.grid_y + dy}`);
      }
    }
    return set;
  };
  const occupiedAdmin = buildOccupiedAdmin(parcelRangesRes.rows);
  const blockedAdmin = await getBlockedSlotsForRoom(roomId);
  for (const b of blockedAdmin) occupiedAdmin.add(`${b.grid_x},${b.grid_y}`);
  for (const s of slots) {
    if (occupiedAdmin.has(`${s.grid_x},${s.grid_y}`)) return { error: `ช่อง (${s.grid_x}, ${s.grid_y}) ถูกจองแล้วหรือปิดจอง` };
  }
  const minX = Math.min(...slots.map((s) => s.grid_x));
  const minY = Math.min(...slots.map((s) => s.grid_y));
  const maxX = Math.max(...slots.map((s) => s.grid_x));
  const maxY = Math.max(...slots.map((s) => s.grid_y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const parcelId = `p-room${roomId}-${Date.now()}`;
  const parcelImageUrl = (reg.cover_url ?? reg.logo_url ?? "").trim() || "";
  await query(
    `INSERT INTO parcels (id, room_id, owner_id, grid_x, grid_y, width, height, title, description, image_url, is_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)`,
    [parcelId, roomId, reg.user_id, minX, minY, width, height, reg.shop_name, reg.description ?? "", parcelImageUrl]
  );
  let shop: { id: string; user_id: string; parcel_id: string; shop_name: string; verification_status: string; membership_plan: string | null; membership_expires_at: null };
  if (existingShop?.id) {
    await query(
      `UPDATE shops SET parcel_id = $2, shop_name = $3, description = $4, logo_url = $5, logo_background_color = $6, cover_url = $7, verification_status = 'none', updated_at = now() WHERE id = $1`,
      [
        existingShop.id,
        parcelId,
        reg.shop_name,
        reg.description ?? "",
        reg.logo_url,
        reg.logo_background_color ?? "#ec4899",
        reg.cover_url,
      ]
    );
    const updated = await query<{ id: string; user_id: string; parcel_id: string; shop_name: string; verification_status: string; membership_plan: string | null; membership_expires_at: null }>(
      "SELECT id, user_id, parcel_id, shop_name, verification_status, membership_plan, membership_expires_at FROM shops WHERE id = $1",
      [existingShop.id]
    );
    const row = updated.rows[0];
    if (!row) return { error: "อัปเดตร้านไม่สำเร็จ" };
    shop = { ...row, membership_expires_at: null };
  } else {
    const shopRes = await query<{ id: string; user_id: string; parcel_id: string; shop_name: string; verification_status: string; membership_plan: string | null; membership_expires_at: null }>(
      `INSERT INTO shops (parcel_id, user_id, shop_name, description, logo_url, logo_background_color, verification_status, membership_plan)
       VALUES ($1, $2, $3, $4, $5, $6, 'none', NULL)
       RETURNING id, user_id, parcel_id, shop_name, verification_status, membership_plan, membership_expires_at`,
      [
        parcelId,
        reg.user_id,
        reg.shop_name,
        reg.description ?? "",
        reg.logo_url,
        reg.logo_background_color ?? "#ec4899",
      ]
    );
    const row = shopRes.rows[0];
    if (!row) return { error: "สร้างร้านไม่สำเร็จ" };
    shop = { ...row, membership_expires_at: null };
  }
  if (adminId) {
    await insertParcelBookingAudit({
      actor_type: "admin",
      actor_id: adminId,
      room_id: roomId,
      parcel_id: parcelId,
      slots,
      amount_paid: 0,
      registration_id: registrationId,
      shop_id: shop.id,
      outcome: "success",
    });
  }
  await addNotification(
    "parcel_assigned",
    "ร้านได้รับการจองที่แล้ว",
    `ร้าน "${reg.shop_name}" ได้รับการจัดสรรที่บนแผนที่แล้ว (ห้อง ${roomId})`,
    { registrationId, roomId, shop_name: reg.shop_name, user_id: reg.user_id, parcel_id: parcelId }
  ).catch(() => {});
  return {
    parcel: {
      id: parcelId,
      room_id: roomId,
      owner_id: reg.user_id,
      grid_x: minX,
      grid_y: minY,
      width,
      height,
      title: reg.shop_name,
      is_label: false,
    },
    shop: {
      id: shop.id,
      user_id: reg.user_id,
      parcel_id: parcelId,
      shop_name: reg.shop_name,
      verification_status: "none",
      membership_plan: shop.membership_plan ?? null,
      membership_expires_at: null,
    },
  };
}

type BookParcelForUserResult = {
  parcel: { id: string; room_id: number; grid_x: number; grid_y: number; width: number; height: number; title: string };
  shop: { id: string; shop_name: string; parcel_id: string };
};

/** จองที่ฝั่งลูกค้า (ใน transaction + ล็อกห้อง) — ราคาห้อง 0 ไม่หักเหรียญ ไม่ต้องผูกกระเป๋า */
export async function bookParcelForUser(
  userId: string,
  roomId: number,
  slots: { grid_x: number; grid_y: number }[]
): Promise<BookParcelForUserResult | { error: string }> {
  if (slots.length === 0) return { error: "ไม่มีช่องที่เลือก" };

  /** ตรวจว่าช่องที่เลือกติดกันเป็นผืนเดียว (เชื่อมกันทางบน/ล่าง/ซ้าย/ขวา เท่านั้น) */
  function areSlotsContiguous(s: { grid_x: number; grid_y: number }[]): boolean {
    if (s.length <= 1) return true;
    const set = new Set(s.map((c) => `${c.grid_x},${c.grid_y}`));
    const start = s[0];
    const visited = new Set<string>();
    const queue: string[] = [`${start.grid_x},${start.grid_y}`];
    const dirs = [ [0, 1], [0, -1], [1, 0], [-1, 0] ] as const;
    while (queue.length > 0) {
      const key = queue.pop()!;
      if (visited.has(key)) continue;
      visited.add(key);
      const [x, y] = key.split(",").map(Number);
      for (const [dx, dy] of dirs) {
        const nk = `${x + dx},${y + dy}`;
        if (set.has(nk) && !visited.has(nk)) queue.push(nk);
      }
    }
    return visited.size === set.size;
  }
  if (!areSlotsContiguous(slots)) {
    return { error: "ช่องที่เลือกต้องติดกันเป็นผืนเดียว (บน/ล่าง/ซ้าย/ขวา)" };
  }

  function buildOccupiedSet(
    ranges: { grid_x: number; grid_y: number; width: number; height: number }[]
  ): Set<string> {
    const set = new Set<string>();
    for (const r of ranges) {
      for (let dx = 0; dx < (r.width || 1); dx++) {
        for (let dy = 0; dy < (r.height || 1); dy++) {
          set.add(`${r.grid_x + dx},${r.grid_y + dy}`);
        }
      }
    }
    return set;
  }

  /**
   * ตรวจว่า slots ที่เลือกใหม่ ติดกัน (cardinal: บน/ล่าง/ซ้าย/ขวา) กับ parcel นี้หรือไม่
   * ไม่นับมุมเฉียง
   */
  function isAdjacentToParcel(
    newSlots: { grid_x: number; grid_y: number }[],
    parcel: { grid_x: number; grid_y: number; width: number; height: number }
  ): boolean {
    const px = parcel.grid_x;
    const py = parcel.grid_y;
    const pw = parcel.width;
    const ph = parcel.height;
    for (const { grid_x: nx, grid_y: ny } of newSlots) {
      // ชิดซ้ายหรือขวา (x ±1) แต่ y อยู่ในแนวเดียวกัน
      if ((nx === px - 1 || nx === px + pw) && ny >= py && ny <= py + ph - 1) return true;
      // ชิดบนหรือล่าง (y ±1) แต่ x อยู่ในแนวเดียวกัน
      if ((ny === py - 1 || ny === py + ph) && nx >= px && nx <= px + pw - 1) return true;
    }
    return false;
  }

  /**
   * คำนวณ bounding rectangle ที่ครอบทั้งของเดิมและของใหม่
   */
  function mergeBoundingBox(
    parcel: { grid_x: number; grid_y: number; width: number; height: number },
    newSlots: { grid_x: number; grid_y: number }[]
  ): { grid_x: number; grid_y: number; width: number; height: number } {
    const existMaxX = parcel.grid_x + parcel.width - 1;
    const existMaxY = parcel.grid_y + parcel.height - 1;
    const newMinX = Math.min(...newSlots.map((s) => s.grid_x));
    const newMinY = Math.min(...newSlots.map((s) => s.grid_y));
    const newMaxX = Math.max(...newSlots.map((s) => s.grid_x));
    const newMaxY = Math.max(...newSlots.map((s) => s.grid_y));
    const mergedMinX = Math.min(parcel.grid_x, newMinX);
    const mergedMinY = Math.min(parcel.grid_y, newMinY);
    const mergedMaxX = Math.max(existMaxX, newMaxX);
    const mergedMaxY = Math.max(existMaxY, newMaxY);
    return {
      grid_x: mergedMinX,
      grid_y: mergedMinY,
      width: mergedMaxX - mergedMinX + 1,
      height: mergedMaxY - mergedMinY + 1,
    };
  }

  try {
    const result = await withTransaction(async (client: PoolClient) => {
      await client.query("INSERT INTO room_booking_lock (room_id) VALUES ($1) ON CONFLICT (room_id) DO NOTHING", [roomId]);
      await client.query("SELECT room_id FROM room_booking_lock WHERE room_id = $1 FOR UPDATE", [roomId]);

      const roomRes = await client.query<{ slot_price_per_day: string; min_rent_days: number }>(
        "SELECT COALESCE(slot_price_per_day, 0)::numeric::text AS slot_price_per_day, COALESCE(min_rent_days, 1) AS min_rent_days FROM rooms WHERE id = $1",
        [roomId]
      );
      const room = roomRes.rows[0];
      if (!room) throw new Error("ไม่พบห้อง");

      const pricePerDay = parseFloat(room.slot_price_per_day || "0") || 0;
      const minDays = Math.max(1, room.min_rent_days ?? 1);
      const totalPrice = pricePerDay * slots.length * minDays;

      if (totalPrice > 0 && !isDemoMode()) {
        const balRes = await client.query<{ balance: string }>(
          "SELECT balance FROM user_balances WHERE user_id = $1 FOR UPDATE",
          [userId]
        );
        const balance = balRes.rows[0]?.balance;
        if (balance == null) throw new Error("กรุณาผูกกระเป๋าเงินก่อนจอง (ห้องนี้มีค่าธรรมเนียม)");
        if (parseFloat(balance) < totalPrice) {
          throw new Error(`เหรียญไม่เพียงพอ (ต้องใช้ ${totalPrice} เหรียญ)`);
        }
      }

      const regRes = await client.query<{ id: string; user_id: string; shop_name: string; description: string; logo_url: string | null; cover_url: string | null; logo_background_color: string | null }>(
        "SELECT id, user_id, shop_name, description, logo_url, cover_url, logo_background_color FROM shop_registrations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId]
      );
      const reg = regRes.rows[0];
      if (!reg) throw new Error("ไม่พบการลงทะเบียนร้าน กรุณาลงทะเบียนร้านก่อน");

      const shopRes = await client.query<{ id: string; parcel_id: string | null; shop_name: string; membership_plan: string | null; membership_expires_at: Date | null }>(
        "SELECT id, parcel_id, shop_name, membership_plan, membership_expires_at FROM shops WHERE user_id = $1",
        [userId]
      );
      const existingShop = shopRes.rows[0];
      if (!existingShop) {
        throw new Error("ต้องเลือกแพ็กเกจก่อนถึงจะจองล็อคได้");
      }
      if (existingShop.membership_plan == null) {
        throw new Error("ต้องเลือกแพ็กเกจก่อนถึงจะจองล็อคได้");
      }
      if (existingShop.parcel_id != null) {
        const expiresAt = existingShop.membership_expires_at ? new Date(existingShop.membership_expires_at) : null;
        if (!expiresAt || expiresAt.getTime() <= Date.now()) {
          throw new Error("แพ็กเกจหมดอายุ กรุณาต่ออายุแพ็กเกจก่อนจองล็อคในแผนที่");
        }
      }

      const parcelRangesRes = await client.query<{ grid_x: number; grid_y: number; width: number; height: number }>(
        "SELECT grid_x, grid_y, width, height FROM parcels WHERE room_id = $1",
        [roomId]
      );
      const occupied = buildOccupiedSet(parcelRangesRes.rows);
      const blockedRes = await client.query<{ grid_x: number; grid_y: number }>(
        "SELECT grid_x, grid_y FROM room_blocked_slots WHERE room_id = $1",
        [roomId]
      );
      for (const b of blockedRes.rows) occupied.add(`${b.grid_x},${b.grid_y}`);
      for (const s of slots) {
        if (occupied.has(`${s.grid_x},${s.grid_y}`)) {
          throw new Error(`ช่อง (${s.grid_x}, ${s.grid_y}) ถูกจองแล้วหรือปิดจอง กรุณาเลือกช่องอื่น`);
        }
      }

      const minX = Math.min(...slots.map((s) => s.grid_x));
      const minY = Math.min(...slots.map((s) => s.grid_y));
      const maxX = Math.max(...slots.map((s) => s.grid_x));
      const maxY = Math.max(...slots.map((s) => s.grid_y));
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      const parcelId = `p-room${roomId}-${Date.now()}`;
      const parcelImageUrl = (reg.cover_url ?? reg.logo_url ?? "").trim() || "";

      if (existingShop.parcel_id != null) {
        const shopId = existingShop.id;

        // ดึง parcel ทั้งหมดของร้านนี้ในห้องนี้ (main + shop_parcels)
        const myParcelsRes = await client.query<{
          id: string;
          grid_x: number;
          grid_y: number;
          width: number;
          height: number;
        }>(
          `SELECT p.id, p.grid_x, p.grid_y, p.width, p.height
           FROM parcels p
           WHERE p.owner_id = $1 AND p.room_id = $2 AND p.is_label = false`,
          [userId, roomId]
        );
        const myParcels = myParcelsRes.rows;

        // หา parcel ที่ติดกับ slots ที่เลือกใหม่
        const adjacentParcel = myParcels.find((p) => isAdjacentToParcel(slots, p)) ?? null;

        if (adjacentParcel) {
          // --- MERGE: ขยาย bounding box ของ parcel เดิมที่ติดกัน ---
          const merged = mergeBoundingBox(adjacentParcel, slots);
          await client.query(
            `UPDATE parcels
             SET grid_x = $2, grid_y = $3, width = $4, height = $5, updated_at = now()
             WHERE id = $1`,
            [adjacentParcel.id, merged.grid_x, merged.grid_y, merged.width, merged.height]
          );
          await client.query("DELETE FROM parcel_selection_hold WHERE user_id = $1 AND room_id = $2", [userId, roomId]);
          if (totalPrice > 0 && !isDemoMode()) {
            await client.query("UPDATE user_balances SET balance = balance - $2 WHERE user_id = $1", [userId, totalPrice]);
          }
          await insertParcelBookingAudit(
            {
              actor_type: "user",
              actor_id: userId,
              room_id: roomId,
              parcel_id: adjacentParcel.id,
              slots,
              amount_paid: totalPrice,
              registration_id: reg.id,
              shop_id: shopId,
              outcome: "success",
            },
            client
          );
          return {
            parcel: {
              id: adjacentParcel.id,
              room_id: roomId,
              grid_x: merged.grid_x,
              grid_y: merged.grid_y,
              width: merged.width,
              height: merged.height,
              title: reg.shop_name,
            },
            shop: { id: shopId, shop_name: existingShop.shop_name, parcel_id: existingShop.parcel_id },
          };
        } else {
          // --- NEW PARCEL: ไม่ติดกับล็อคเดิม → สร้าง parcel แยกใหม่ ---
          await client.query(
            `INSERT INTO parcels (id, room_id, owner_id, grid_x, grid_y, width, height, title, description, image_url, is_label)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)`,
            [parcelId, roomId, userId, minX, minY, width, height, reg.shop_name, reg.description ?? "", parcelImageUrl]
          );
          await client.query("INSERT INTO shop_parcels (shop_id, parcel_id) VALUES ($1, $2)", [shopId, parcelId]);
          await client.query("DELETE FROM parcel_selection_hold WHERE user_id = $1 AND room_id = $2", [userId, roomId]);
          if (totalPrice > 0 && !isDemoMode()) {
            await client.query("UPDATE user_balances SET balance = balance - $2 WHERE user_id = $1", [userId, totalPrice]);
          }
          await insertParcelBookingAudit(
            {
              actor_type: "user",
              actor_id: userId,
              room_id: roomId,
              parcel_id: parcelId,
              slots,
              amount_paid: totalPrice,
              registration_id: reg.id,
              shop_id: shopId,
              outcome: "success",
            },
            client
          );
          return {
            parcel: { id: parcelId, room_id: roomId, grid_x: minX, grid_y: minY, width, height, title: reg.shop_name },
            shop: { id: shopId, shop_name: existingShop.shop_name, parcel_id: existingShop.parcel_id },
          };
        }
      }

      await client.query(
        `INSERT INTO parcels (id, room_id, owner_id, grid_x, grid_y, width, height, title, description, image_url, is_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)`,
        [parcelId, roomId, reg.user_id, minX, minY, width, height, reg.shop_name, reg.description ?? "", parcelImageUrl]
      );

      await client.query(
        `UPDATE shops SET parcel_id = $2, shop_name = $3, description = $4, logo_url = $5, logo_background_color = $6, cover_url = $7, verification_status = 'none', updated_at = now() WHERE id = $1`,
        [
          existingShop.id,
          parcelId,
          reg.shop_name,
          reg.description ?? "",
          reg.logo_url,
          reg.logo_background_color ?? "#ec4899",
          reg.cover_url,
        ]
      );

      await client.query("DELETE FROM parcel_selection_hold WHERE user_id = $1 AND room_id = $2", [userId, roomId]);

      if (totalPrice > 0 && !isDemoMode()) {
        await client.query("UPDATE user_balances SET balance = balance - $2 WHERE user_id = $1", [userId, totalPrice]);
      }

      const finalShopRes = await client.query<{ id: string; shop_name: string; parcel_id: string }>(
        "SELECT id, shop_name, parcel_id FROM shops WHERE user_id = $1",
        [userId]
      );
      const shopRow = finalShopRes.rows[0];
      if (!shopRow) throw new Error("อัปเดตร้านไม่สำเร็จ");

      await insertParcelBookingAudit(
        {
          actor_type: "user",
          actor_id: userId,
          room_id: roomId,
          parcel_id: parcelId,
          slots,
          amount_paid: totalPrice,
          registration_id: reg.id,
          shop_id: shopRow.id,
          outcome: "success",
        },
        client
      );
      return {
        parcel: {
          id: parcelId,
          room_id: roomId,
          grid_x: minX,
          grid_y: minY,
          width,
          height,
          title: reg.shop_name,
        },
        shop: {
          id: shopRow.id,
          shop_name: shopRow.shop_name,
          parcel_id: shopRow.parcel_id,
        },
      };
    });

    await addNotification(
      "parcel_assigned",
      "ร้านได้รับการจองที่แล้ว",
      `ร้าน "${(result as BookParcelForUserResult).shop.shop_name}" ได้รับการจัดสรรที่บนแผนที่แล้ว (ห้อง ${roomId})`,
      { roomId, user_id: userId, parcel_id: (result as BookParcelForUserResult).parcel.id }
    ).catch(() => {});

    return result as BookParcelForUserResult;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}

/** ปลดการจองที่ (ลบ parcel) — ถ้าไม่ระบุ parcelId จะปลดล็อคหลัก (shops.parcel_id) ถ้าร้านมีหลายล็อคให้ส่ง parcelId เพื่อปลดทีละล็อค */
export async function unassignShopParcel(shopId: string, parcelId?: string): Promise<{ error?: string }> {
  const shopRes = await query<{ parcel_id: string | null }>("SELECT parcel_id FROM shops WHERE id = $1", [shopId]);
  const shop = shopRes.rows[0];
  if (!shop) return { error: "ไม่พบร้าน" };
  const primaryParcelId = shop.parcel_id ?? null;
  if (parcelId) {
    if (primaryParcelId === parcelId) {
      await query("UPDATE shops SET parcel_id = NULL, updated_at = now() WHERE id = $1", [shopId]);
      await query("DELETE FROM parcels WHERE id = $1", [parcelId]);
      await query("DELETE FROM shop_parcels WHERE shop_id = $1 AND parcel_id = $2", [shopId, parcelId]);
      return {};
    }
    const extra = await query("SELECT 1 FROM shop_parcels WHERE shop_id = $1 AND parcel_id = $2", [shopId, parcelId]);
    if (extra.rows.length === 0) return { error: "ไม่พบล็อคนี้ในร้าน" };
    await query("DELETE FROM shop_parcels WHERE shop_id = $1 AND parcel_id = $2", [shopId, parcelId]);
    await query("DELETE FROM parcels WHERE id = $1", [parcelId]);
    return {};
  }
  if (!primaryParcelId) return { error: "ร้านนี้ยังไม่ได้จองที่" };
  await query("UPDATE shops SET parcel_id = NULL, updated_at = now() WHERE id = $1", [shopId]);
  await query("DELETE FROM parcels WHERE id = $1", [primaryParcelId]);
  return {};
}

const DEFAULT_OFFLINE_DAYS_RELEASE = 7;

/**
 * ปลดล็อคจองแผนที่ของร้านที่เจ้าของไม่ออนไลน์ติดต่อกันเกิน N วัน
 * ใช้ user_presence.last_seen_at (อัปเดตทุก 30 วิจาก heartbeat)
 * คืนจำนวนร้านที่ปลดล็อคแล้ว
 */
export async function releaseParcelLocksForOfflineOwners(
  offlineDays: number = DEFAULT_OFFLINE_DAYS_RELEASE
): Promise<{ released: number; errors: string[] }> {
  const days = Math.max(1, Math.min(365, Math.floor(offlineDays)));
  const res = await query<{ id: string; parcel_id: string; shop_name: string }>(
    `SELECT s.id, s.parcel_id, s.shop_name
     FROM shops s
     LEFT JOIN user_presence up ON up.user_id = s.user_id
     WHERE s.parcel_id IS NOT NULL
       AND (up.last_seen_at IS NULL OR up.last_seen_at < now() - make_interval(days => $1::int))`,
    [days]
  );
  const shopRows = res.rows;
  const errors: string[] = [];
  let released = 0;

  for (const row of shopRows) {
    const shopId = row.id;
    const shopName = row.shop_name ?? "ร้าน";
    const _primaryParcelId = row.parcel_id;

    const extraRes = await query<{ parcel_id: string }>(
      "SELECT parcel_id FROM shop_parcels WHERE shop_id = $1",
      [shopId]
    );
    const extraParcelIds = extraRes.rows.map((r) => r.parcel_id);

    const err = await unassignShopParcel(shopId);
    if (err?.error) {
      errors.push(`shop ${shopId}: ${err.error}`);
      continue;
    }
    released += 1;
    await addNotification(
      "shop_lock_released",
      "ร้านหลุดล็อคในแผนที่",
      `ร้าน "${shopName}" ถูกปลดล็อคเพราะเจ้าของไม่ออนไลน์ติดต่อกันเกิน ${days} วัน`,
      { shop_id: shopId, shop_name: shopName }
    ).catch(() => {});

    for (const parcelId of extraParcelIds) {
      const errExtra = await unassignShopParcel(shopId, parcelId);
      if (errExtra?.error) errors.push(`shop ${shopId} parcel ${parcelId}: ${errExtra.error}`);
    }
  }

  return { released, errors };
}

/**
 * ปลดล็อคจองแผนที่ของร้านที่แพ็กเกจหมดอายุ (membership_expires_at < now())
 * ต่ออายุก่อนหมด = ไม่เข้าเงื่อนไขนี้ จึงได้ที่เดิม
 */
export async function releaseParcelLocksForExpiredMemberships(): Promise<{
  released: number;
  errors: string[];
}> {
  const res = await query<{ id: string; parcel_id: string; shop_name: string }>(
    `SELECT id, parcel_id, shop_name FROM shops
     WHERE parcel_id IS NOT NULL
       AND membership_expires_at IS NOT NULL
       AND membership_expires_at < now()`
  );
  const errors: string[] = [];
  let released = 0;

  for (const row of res.rows) {
    const shopId = row.id;
    const shopName = row.shop_name ?? "ร้าน";

    const extraRes = await query<{ parcel_id: string }>(
      "SELECT parcel_id FROM shop_parcels WHERE shop_id = $1",
      [shopId]
    );
    const extraParcelIds = extraRes.rows.map((r) => r.parcel_id);

    const err = await unassignShopParcel(shopId);
    if (err?.error) {
      errors.push(`shop ${shopId}: ${err.error}`);
      continue;
    }
    released += 1;
    await addNotification(
      "shop_lock_released",
      "แพ็กเกจหมดอายุ — หลุดล็อคในแผนที่",
      `ร้าน "${shopName}" ถูกปลดล็อคเพราะแพ็กเกจหมดอายุ กรุณาต่ออายุเพื่อจองล็อคใหม่`,
      { shop_id: shopId, shop_name: shopName }
    ).catch(() => {});

    for (const parcelId of extraParcelIds) {
      const errExtra = await unassignShopParcel(shopId, parcelId);
      if (errExtra?.error) errors.push(`shop ${shopId} parcel ${parcelId}: ${errExtra.error}`);
    }
  }

  return { released, errors };
}

// ==================== Parcel booking draft (real-time สีส้ม) ====================
export async function upsertParcelBookingDraft(
  adminId: string,
  roomId: number,
  slots: { grid_x: number; grid_y: number }[],
  expiresAt: Date
): Promise<void> {
  await query(
    `INSERT INTO parcel_booking_draft (admin_id, room_id, slots, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (admin_id, room_id) DO UPDATE SET slots = $3, expires_at = $4`,
    [adminId, roomId, JSON.stringify(slots), expiresAt]
  );
}

export async function getParcelBookingDraftsForRoom(
  roomId: number,
  excludeAdminId?: string
): Promise<{ admin_id: string; slots: { grid_x: number; grid_y: number }[] }[]> {
  const res = await query<{ admin_id: string; slots: unknown }>(
    `SELECT admin_id, slots FROM parcel_booking_draft
     WHERE room_id = $1 AND expires_at > now() ${excludeAdminId ? "AND admin_id != $2" : ""}`,
    excludeAdminId ? [roomId, excludeAdminId] : [roomId]
  );
  return res.rows.map((r) => ({
    admin_id: r.admin_id,
    slots: normalizeSlots(r.slots),
  }));
}

export async function deleteParcelBookingDraft(adminId: string, roomId: number): Promise<void> {
  await query("DELETE FROM parcel_booking_draft WHERE admin_id = $1 AND room_id = $2", [adminId, roomId]);
}

// ==================== Parcel selection hold (ลูกค้ากำลังเลือกช่อง — real-time สีส้ม) ====================
export async function getParcelSelectionHoldsForRoom(
  roomId: number,
  excludeUserId?: string
): Promise<{ user_id: string; slots: { grid_x: number; grid_y: number }[] }[]> {
  const res = await query<{ user_id: string; slots: unknown }>(
    `SELECT user_id, slots FROM parcel_selection_hold
     WHERE room_id = $1 AND expires_at > now() ${excludeUserId ? "AND user_id != $2" : ""}`,
    excludeUserId ? [roomId, excludeUserId] : [roomId]
  );
  return res.rows.map((r) => ({
    user_id: r.user_id,
    slots: normalizeSlots(r.slots),
  }));
}

function normalizeSlots(raw: unknown): { grid_x: number; grid_y: number }[] {
  const toSafeArray = (value: unknown): { grid_x: number; grid_y: number }[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((v) => {
        const item = v as { grid_x?: unknown; grid_y?: unknown };
        const gridX = Number(item?.grid_x);
        const gridY = Number(item?.grid_y);
        if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) return null;
        return { grid_x: gridX, grid_y: gridY };
      })
      .filter((v): v is { grid_x: number; grid_y: number } => v !== null);
  };

  if (typeof raw === "string") {
    try {
      return toSafeArray(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return toSafeArray(raw);
}

export async function upsertParcelSelectionHold(
  userId: string,
  roomId: number,
  slots: { grid_x: number; grid_y: number }[],
  expiresAt: Date
): Promise<void> {
  await query(
    `INSERT INTO parcel_selection_hold (user_id, room_id, slots, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, room_id) DO UPDATE SET slots = $3, expires_at = $4`,
    [userId, roomId, JSON.stringify(slots), expiresAt]
  );
}

export async function deleteParcelSelectionHold(userId: string, roomId: number): Promise<void> {
  await query("DELETE FROM parcel_selection_hold WHERE user_id = $1 AND room_id = $2", [userId, roomId]);
}

/** คืนค่ารายการ parcel ใน room (grid_x, grid_y, width, height) สำหรับเช็คช่อง occupied */
export async function getParcelGridRangesForRoom(
  roomId: number
): Promise<{ grid_x: number; grid_y: number; width: number; height: number }[]> {
  const res = await query<{ grid_x: number; grid_y: number; width: number; height: number }>(
    "SELECT grid_x, grid_y, width, height FROM parcels WHERE room_id = $1",
    [roomId]
  );
  return res.rows;
}

/** ช่องที่แอดมินปิดจอง (ห้ามจอง) ในห้องนี้ */
export async function getBlockedSlotsForRoom(
  roomId: number
): Promise<{ grid_x: number; grid_y: number }[]> {
  const res = await query<{ grid_x: number; grid_y: number }>(
    "SELECT grid_x, grid_y FROM room_blocked_slots WHERE room_id = $1 ORDER BY grid_y, grid_x",
    [roomId]
  );
  return res.rows;
}

/** ตั้งค่าช่องปิดจองของห้อง (แทนที่ทั้งหมด) — เฉพาะแอดมิน */
export async function setBlockedSlotsForRoom(
  roomId: number,
  slots: { grid_x: number; grid_y: number }[]
): Promise<void> {
  await query("DELETE FROM room_blocked_slots WHERE room_id = $1", [roomId]);
  if (slots.length === 0) return;
  const values: (number | string)[] = [roomId];
  const placeholders: string[] = [];
  slots.forEach((s, i) => {
    placeholders.push(`($1, $${i * 2 + 2}, $${i * 2 + 3})`);
    values.push(s.grid_x, s.grid_y);
  });
  await query(
    `INSERT INTO room_blocked_slots (room_id, grid_x, grid_y) VALUES ${placeholders.join(", ")}`,
    values
  );
}

// ==================== Item shop products ====================
type ItemShopCategory = "frame" | "megaphone" | "board" | "other";
type ItemShopProductRow = {
  id: string;
  name: string;
  category: ItemShopCategory;
  image_url: string;
  price: number;
  price_unit: string;
  status: string;
  is_free: boolean;
  allow_logo?: boolean;
  board_format?: BoardFormat;
  dimension_width_px?: number;
  dimension_height_px?: number;
  created_at: string;
  updated_at: string;
};

export type BoardFormat = "text_only" | "text_link" | "text_link_logo";

export async function getItemShopProducts(): Promise<ItemShopProductRow[]> {
  const res = await query<ItemShopProductRow & { created_at: string; updated_at: string }>(
    "SELECT id, name, category, image_url, price, price_unit, status, COALESCE(is_free, false) AS is_free, COALESCE(allow_logo, false) AS allow_logo, COALESCE(board_format, 'text_link') AS board_format, dimension_width_px, dimension_height_px, created_at, updated_at FROM item_shop_products ORDER BY created_at"
  );
  return res.rows.map((r) => ({
    ...r,
    is_free: Boolean(r.is_free),
    allow_logo: Boolean((r as { allow_logo?: boolean }).allow_logo),
    board_format: normalizeBoardFormat((r as { board_format?: string }).board_format),
    price: parseFloat(String(r.price)),
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
  }));
}

function normalizeBoardFormat(v: string | undefined): BoardFormat {
  if (v === "text_only" || v === "text_link" || v === "text_link_logo") return v;
  return "text_link";
}

export async function getItemShopProductById(id: string): Promise<ItemShopProductRow | null> {
  const res = await query(
    "SELECT id, name, category, image_url, price, price_unit, status, COALESCE(is_free, false) AS is_free, COALESCE(allow_logo, false) AS allow_logo, COALESCE(board_format, 'text_link') AS board_format, dimension_width_px, dimension_height_px, created_at, updated_at FROM item_shop_products WHERE id = $1",
    [id]
  );
  const row = res.rows[0] as (ItemShopProductRow & { created_at: string; updated_at: string }) | undefined;
  if (!row) return null;
  return {
    ...row,
    is_free: Boolean(row.is_free),
    allow_logo: Boolean((row as { allow_logo?: boolean }).allow_logo),
    board_format: normalizeBoardFormat((row as { board_format?: string }).board_format),
    price: parseFloat(String(row.price)),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export async function createItemShopProduct(body: {
  name: string;
  category: ItemShopCategory;
  image_url: string;
  price: number;
  price_unit: string;
  is_free?: boolean;
  allow_logo?: boolean;
  board_format?: BoardFormat;
  dimension_width_px?: number;
  dimension_height_px?: number;
}): Promise<ItemShopProductRow> {
  const id = `isp-${Date.now()}`;
  const fmt = body.board_format && ["text_only", "text_link", "text_link_logo"].includes(body.board_format) ? body.board_format : "text_link";
  await query(
    `INSERT INTO item_shop_products (id, name, category, image_url, price, price_unit, is_free, allow_logo, board_format, dimension_width_px, dimension_height_px)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      body.name,
      body.category,
      body.image_url,
      body.price,
      body.price_unit,
      body.is_free === true,
      fmt === "text_link_logo",
      fmt,
      body.dimension_width_px ?? null,
      body.dimension_height_px ?? null,
    ]
  );
  const row = await getItemShopProductById(id);
  return row!;
}

export async function updateItemShopProduct(
  id: string,
  body: Partial<{
    name: string;
    category: ItemShopCategory;
    image_url: string;
    price: number;
    price_unit: string;
    status: string;
    is_free: boolean;
    allow_logo: boolean;
    board_format: BoardFormat;
    dimension_width_px: number;
    dimension_height_px: number;
  }>
): Promise<ItemShopProductRow | null> {
  const updates: string[] = ["updated_at = now()"];
  const params: unknown[] = [];
  let idx = 1;
  if (body.name !== undefined) {
    updates.push(`name = $${idx++}`);
    params.push(body.name);
  }
  if (body.category !== undefined) {
    updates.push(`category = $${idx++}`);
    params.push(body.category);
  }
  if (body.allow_logo !== undefined) {
    updates.push(`allow_logo = $${idx++}`);
    params.push(body.allow_logo);
  }
  if (body.board_format !== undefined && ["text_only", "text_link", "text_link_logo"].includes(body.board_format)) {
    updates.push(`board_format = $${idx++}`);
    params.push(body.board_format);
    updates.push(`allow_logo = $${idx++}`);
    params.push(body.board_format === "text_link_logo");
  }
  if (body.image_url !== undefined) {
    updates.push(`image_url = $${idx++}`);
    params.push(body.image_url);
  }
  if (body.price !== undefined) {
    updates.push(`price = $${idx++}`);
    params.push(body.price);
  }
  if (body.price_unit !== undefined) {
    updates.push(`price_unit = $${idx++}`);
    params.push(body.price_unit);
  }
  if (body.status !== undefined) {
    updates.push(`status = $${idx++}`);
    params.push(body.status);
  }
  if (body.is_free !== undefined) {
    updates.push(`is_free = $${idx++}`);
    params.push(body.is_free);
  }
  if (body.dimension_width_px !== undefined) {
    updates.push(`dimension_width_px = $${idx++}`);
    params.push(body.dimension_width_px);
  }
  if (body.dimension_height_px !== undefined) {
    updates.push(`dimension_height_px = $${idx++}`);
    params.push(body.dimension_height_px);
  }
  if (params.length === 0) return getItemShopProductById(id);
  params.push(id);
  await query(`UPDATE item_shop_products SET ${updates.join(", ")} WHERE id = $${idx}`, params);
  return getItemShopProductById(id);
}

export async function deleteItemShopProduct(id: string): Promise<boolean> {
  const res = await query("DELETE FROM item_shop_products WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

// ==================== User inventory ====================
type UserInventoryRow = {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  category: "megaphone" | "board";
  image_url: string;
  price_unit: string;
  purchased_at: string;
  expires_at: string | null;
  uses_left: number | null;
  status: string;
};

export type UserInventoryRowWithProduct = UserInventoryRow & { allow_logo?: boolean; board_format?: BoardFormat };

export async function getInventoryForUser(userId: string): Promise<UserInventoryRowWithProduct[]> {
  const res = await query<UserInventoryRow & { purchased_at: string; expires_at: string | null; allow_logo?: boolean; board_format?: string }>(
    `SELECT ui.id, ui.user_id, ui.product_id, ui.product_name, ui.category, ui.image_url, ui.price_unit, ui.purchased_at, ui.expires_at, ui.uses_left, ui.status,
      COALESCE(isp.allow_logo, false) AS allow_logo,
      COALESCE(isp.board_format, 'text_link') AS board_format
     FROM user_inventory ui
     LEFT JOIN item_shop_products isp ON isp.id = ui.product_id
     WHERE ui.user_id = $1 AND ui.status = 'active' ORDER BY ui.purchased_at DESC`,
    [userId]
  );
  const now = new Date().toISOString();
  return res.rows
    .map((r) => ({
      ...r,
      allow_logo: Boolean(r.allow_logo),
      board_format: normalizeBoardFormat(r.board_format),
      purchased_at: new Date(r.purchased_at).toISOString(),
      expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    }))
    .filter((r) => {
      if (r.expires_at && r.expires_at < now) return false;
      return true;
    }) as UserInventoryRowWithProduct[];
}

/** ประวัติการซื้อจาก Item Shop ทั้งหมด (ฟรีและเสียเงิน) สำหรับแสดงในประวัติการชำระเงิน */
export async function getPurchaseHistoryForUser(userId: string): Promise<{ id: string; product_name: string; category: string; price_unit: string; purchased_at: string; status: string }[]> {
  const res = await query<{ id: string; product_name: string; category: string; price_unit: string; purchased_at: string; status: string }>(
    "SELECT id, product_name, category, price_unit, purchased_at, status FROM user_inventory WHERE user_id = $1 ORDER BY purchased_at DESC",
    [userId]
  );
  return res.rows.map((r) => ({
    ...r,
    purchased_at: new Date(r.purchased_at).toISOString(),
  }));
}

export async function getInventoryItemById(id: string): Promise<UserInventoryRow | null> {
  const res = await query<UserInventoryRow>(
    "SELECT id, user_id, product_id, product_name, category, image_url, price_unit, purchased_at, expires_at, uses_left, status FROM user_inventory WHERE id = $1",
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...row,
    purchased_at: new Date(row.purchased_at).toISOString(),
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}

function computeExpiresAt(priceUnit: string): string | null {
  const d = new Date();
  // รองรับ "เหรียญ/N วัน" (จำนวนวันตามที่กำหนด)
  const dayMatch = priceUnit.match(/(\d+)\s*วัน/);
  if (dayMatch) {
    const days = Math.min(365, Math.max(1, parseInt(dayMatch[1], 10)));
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }
  if (priceUnit.includes("วัน") && !priceUnit.includes("สัปดาห์") && !priceUnit.includes("เดือน")) {
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  if (priceUnit.includes("สัปดาห์")) {
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }
  if (priceUnit.includes("เดือน")) {
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }
  return null;
}

export async function addPurchase(
  userId: string,
  product: ItemShopProductRow
): Promise<UserInventoryRow | null> {
  if (product.category !== "megaphone" && product.category !== "board") return null;
  const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const expires_at = product.price_unit.includes("ครั้ง") ? null : computeExpiresAt(product.price_unit);
  const uses_left = product.price_unit.includes("ครั้ง") ? 1 : null;
  const res = await query<UserInventoryRow>(
    `INSERT INTO user_inventory (id, user_id, product_id, product_name, category, image_url, price_unit, expires_at, uses_left)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, user_id, product_id, product_name, category, image_url, price_unit, purchased_at, expires_at, uses_left, status`,
    [
      id,
      userId,
      product.id,
      product.name,
      product.category,
      product.image_url,
      product.price_unit,
      expires_at,
      uses_left,
    ]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...row,
    purchased_at: new Date(row.purchased_at).toISOString(),
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}

/**
 * รายได้แพลตฟอร์ม (Item Shop): ซื้อโข่ง/ป้าย ฯลฯ — ไม่มี shop_payouts; บันทึกใน platform_revenue_log
 * - ล็อก balance ด้วย FOR UPDATE, หักเหรียญ + insert user_inventory ใน transaction เดียวกัน
 */
export async function purchaseInventoryItems(
  userId: string,
  product: ItemShopProductRow,
  quantity: number
): Promise<{ items: UserInventoryRow[]; totalPrice: number }> {
  if (product.category !== "megaphone" && product.category !== "board") {
    return { items: [], totalPrice: 0 };
  }
  const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
  const unitPrice = product.is_free ? 0 : Number(product.price) || 0;
  const totalPrice = unitPrice * qty;

  return withTransaction(async (client: PoolClient) => {
    if (totalPrice > 0 && !isDemoMode()) {
      const balRes = await client.query<{ balance: string }>(
        "SELECT balance::text AS balance FROM user_balances WHERE user_id = $1 FOR UPDATE",
        [userId]
      );
      const balance = parseFloat(balRes.rows[0]?.balance ?? "0");
      if (balance < totalPrice) {
        throw new Error(`เหรียญไม่เพียงพอ (มี ${balance} เหรียญ ต้องใช้ ${totalPrice} เหรียญ)`);
      }
      const debitRes = await client.query(
        "UPDATE user_balances SET balance = balance - $2 WHERE user_id = $1 AND balance >= $2 RETURNING user_id",
        [userId, totalPrice]
      );
      if ((debitRes.rowCount ?? 0) <= 0) {
        throw new Error("หักเหรียญไม่สำเร็จ");
      }
    }

    const items: UserInventoryRow[] = [];
    for (let i = 0; i < qty; i++) {
      const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const expires_at = product.price_unit.includes("ครั้ง") ? null : computeExpiresAt(product.price_unit);
      const uses_left = product.price_unit.includes("ครั้ง") ? 1 : null;
      const ins = await client.query<UserInventoryRow>(
        `INSERT INTO user_inventory (id, user_id, product_id, product_name, category, image_url, price_unit, expires_at, uses_left)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, user_id, product_id, product_name, category, image_url, price_unit, purchased_at, expires_at, uses_left, status`,
        [
          id,
          userId,
          product.id,
          product.name,
          product.category,
          product.image_url,
          product.price_unit,
          expires_at,
          uses_left,
        ]
      );
      const row = ins.rows[0];
      if (!row) throw new Error("บันทึก inventory ไม่สำเร็จ");
      items.push({
        ...row,
        purchased_at: new Date(row.purchased_at).toISOString(),
        expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      });
    }
    if (totalPrice > 0 && !isDemoMode()) {
      await client.query(
        `INSERT INTO platform_revenue_log (user_id, type, amount, product_id, product_name, quantity) VALUES ($1, 'item_shop', $2, $3, $4, $5)`,
        [userId, totalPrice, product.id, product.name ?? null, qty]
      );
    }
    return { items, totalPrice };
  });
}

export async function consumeInventoryItem(
  inventoryId: string,
  message: string,
  roomId: number = 1,
  linkUrl?: string | null,
  logoUrl?: string | null
): Promise<{ ok: boolean; error?: string; announcement?: { shopName: string; lockLabel: string | null; message: string } }> {
  return withTransaction(async (client: PoolClient) => {
    const invRes = await client.query<UserInventoryRow>(
      "SELECT id, user_id, product_id, product_name, category, image_url, price_unit, purchased_at, expires_at, uses_left, status FROM user_inventory WHERE id = $1 FOR UPDATE",
      [inventoryId]
    );
    const row = invRes.rows[0];
    if (!row) return { ok: false, error: "ไม่พบรายการ" };
    if (row.status !== "active") return { ok: false, error: "รายการนี้ใช้ไปแล้วหรือหมดอายุ" };

    const now = Date.now();
    const expiredAtMs = row.expires_at ? new Date(row.expires_at).getTime() : null;
    if (expiredAtMs !== null && Number.isFinite(expiredAtMs) && expiredAtMs < now) {
      await client.query("UPDATE user_inventory SET status = 'expired' WHERE id = $1", [inventoryId]);
      return { ok: false, error: "หมดอายุแล้ว" };
    }

    if (row.uses_left !== null) {
      if (row.uses_left <= 0) {
        await client.query("UPDATE user_inventory SET status = 'used' WHERE id = $1", [inventoryId]);
        return { ok: false, error: "รายการนี้ใช้ไปแล้วหรือหมดอายุ" };
      }
      const newUses = row.uses_left - 1;
      await client.query(
        "UPDATE user_inventory SET uses_left = $2, status = CASE WHEN $2 <= 0 THEN 'used' ELSE status END WHERE id = $1",
        [inventoryId, newUses]
      );
    }

    const productRes = await client.query<{ category: string; board_format: string | null; price_unit: string | null }>(
      "SELECT category, board_format, price_unit FROM item_shop_products WHERE id = $1",
      [row.product_id]
    );
    const product = productRes.rows[0];
    const category = (product?.category as string) ?? "megaphone";
    const announcementSource = category === "board" ? "board" : "megaphone";

    const shopRes = await client.query<{ id: string; shop_name: string }>(
      "SELECT id, shop_name FROM shops WHERE user_id = $1 LIMIT 1",
      [row.user_id]
    );
    const shop = shopRes.rows[0];
    let shopName: string;
    let shopId: string | null = null;
    let lockLabel: string | null = null;

    if (shop) {
      shopName = (shop.shop_name ?? "").trim() || "ร้าน";
      shopId = shop.id;
      const labels = await getLockLabelsForShop(shop.id);
      lockLabel = labels.length > 0 ? labels.join(", ") : null;
    } else {
      const profileRes = await client.query<{ display_name: string | null; first_name: string | null }>(
        "SELECT display_name, first_name FROM profiles WHERE user_id = $1",
        [row.user_id]
      );
      const profile = profileRes.rows[0];
      shopName = profile?.display_name ?? profile?.first_name ?? "ผู้ใช้";
    }

    const formatRaw = typeof product?.board_format === "string" ? product.board_format : "";
    const format: BoardFormat = ["text_only", "text_link", "text_link_logo"].includes(formatRaw) ? (formatRaw as BoardFormat) : "text_link";
    const allowLink = format === "text_link" || format === "text_link_logo";
    const allowLogo = format === "text_link_logo";
    const link = allowLink && typeof linkUrl === "string" ? linkUrl.trim() || null : null;
    const logo = allowLogo && typeof logoUrl === "string" ? logoUrl.trim() || null : null;

    const announcementExpiresAt = computeExpiresAt(product?.price_unit ?? "");
    const expiresAt = announcementExpiresAt ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString();
    })();

    const roomRes = await client.query<{ id: number }>("SELECT id FROM rooms WHERE id = $1", [roomId]);
    if (!roomRes.rows[0]) {
      return { ok: false, error: "ไม่พบห้องที่เลือก" };
    }

    await client.query(
      "INSERT INTO announcements (room_id, shop_id, shop_name, lock_label, message, link_url, logo_url, announcement_source, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [roomId, shopId, shopName, lockLabel, message.trim() || "(ไม่มีข้อความ)", link, logo, announcementSource, expiresAt]
    );

    const displayMessage = message.trim() || "(ไม่มีข้อความ)";
    return {
      ok: true,
      announcement: { shopName, lockLabel, message: displayMessage },
    };
  });
}
