/**
 * Client สำหรับเรียก API ข้อมูล — ใช้ทั้ง CMS และแอปแผนที่
 */

const BASE = "/api/data";

/** ใส่ credentials เพื่อให้มือถือ/LINE browser ส่ง cookie กับทุก request (same-origin ก็ส่งอยู่แล้ว แต่ชัดเจนช่วยเรื่อง mobile) */
const FETCH_OPTIONS: RequestInit = { credentials: "include" };

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params
    ? `${BASE}${path}?${new URLSearchParams(params).toString()}`
    : `${BASE}${path}`;
  const res = await fetch(url, FETCH_OPTIONS);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...FETCH_OPTIONS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...FETCH_OPTIONS,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...FETCH_OPTIONS, method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}

// Rooms
export async function fetchRooms() {
  return get<{ id: number; name: string }[]>(`/rooms`);
}

// Parcels — ไม่ส่ง roomId ได้รายการทั้งหมด (สำหรับ CMS), ส่ง roomId ได้รูปแบบสำหรับแผนที่
export async function fetchParcels(roomId?: number) {
  const params = roomId != null ? { roomId: String(roomId) } : undefined;
  return get<{ parcels: unknown[]; blocked_slots?: unknown[] }>(`/parcels`, params);
}

// Announcements
export async function fetchAnnouncements(roomId?: number) {
  const params = roomId != null ? { roomId: String(roomId) } : undefined;
  return get<{ announcements: unknown[] }>(`/announcements`, params);
}

// Users
export async function fetchUsers() {
  return get<unknown[]>(`/users`);
}

export async function fetchUserDetail(id: string) {
  return get<{
    user: unknown;
    profile: unknown;
    wallets: unknown[];
    verification: unknown;
    shops: unknown[];
    registrations: unknown[];
    payments: unknown[];
    payouts: unknown[];
  }>(`/users/${encodeURIComponent(id)}`);
}

// Shop registrations & shops
export async function fetchShopRegistrations() {
  return get<unknown[]>(`/shop-registrations`);
}

export async function fetchShops() {
  return get<unknown[]>(`/shops`);
}

export async function fetchShopDetail(id: string) {
  return get<{
    shop: unknown;
    reg: unknown;
    profile: unknown;
    productCount: number;
    payouts: unknown[];
    rooms: unknown[];
    parcels: unknown[];
  }>(`/shops/${encodeURIComponent(id)}`);
}

// จองที่ — slots = array of { grid_x, grid_y }
export async function bookParcel(body: {
  registrationId: string;
  roomId: number;
  slots: { grid_x: number; grid_y: number }[];
}) {
  return post<{ parcel: unknown; shop: unknown }>(`/book-parcel`, body);
}

// Orders
export async function fetchOrders() {
  return get<{ orders: unknown[]; orderItems: unknown[] }>(`/orders`);
}

// Verification documents
export async function fetchVerificationDocuments() {
  return get<unknown[]>(`/verification-documents`);
}

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  meta?: Record<string, unknown>;
};

export async function fetchNotifications() {
  return get<{ notifications: NotificationItem[] }>(`/notifications`);
}

/** ล้างการแจ้งเตือนของ CMS ทั้งหมด — ต้องเป็นแอดมิน */
export async function clearNotifications(): Promise<{ ok: boolean; deleted: number }> {
  return del<{ ok: boolean; deleted: number }>(`/notifications`);
}

// Dashboard counts
export async function fetchDashboard() {
  return get<{
    usersCount: number;
    shopRegistrationsCount: number;
    shopsCount: number;
    verificationDocumentsCount: number;
    announcementsCount: number;
    ordersCount: number;
    parcelsCount: number;
    notificationsTodayCount: number;
  }>(`/dashboard`);
}

// Admins
export type AdminListItem = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  created_at: string;
  isFirst: boolean;
};

export async function fetchAdmins() {
  return get<{ admins: AdminListItem[] }>(`/admins`);
}

export async function createAdmin(body: {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
}) {
  return post<{ admin: AdminListItem }>(`/admins`, body);
}

export async function updateAdminById(
  id: string,
  body: { first_name?: string; last_name?: string; display_name?: string; newPassword?: string }
) {
  return patch<{ admin: AdminListItem }>(`/admins/${encodeURIComponent(id)}`, body);
}

export async function deleteAdminById(id: string) {
  return del<{ ok: true }>(`/admins/${encodeURIComponent(id)}`);
}

// Item Shop Products (CMS สินค้า — กรอบ/ประกาศ/ป้าย/อื่นๆ)
export type ItemShopCategory = "frame" | "megaphone" | "board" | "other";

export type ItemShopProduct = {
  id: string;
  name: string;
  category: ItemShopCategory;
  image_url: string;
  price: number;
  price_unit: string;
  status: "active" | "disabled";
  is_free?: boolean;
  allow_logo?: boolean;
  board_format?: "text_only" | "text_link" | "text_link_logo";
  dimension_width_px?: number;
  dimension_height_px?: number;
  created_at: string;
  updated_at: string;
};

export async function fetchItemShopProducts() {
  return get<{ products: ItemShopProduct[] }>(`/item-shop-products`);
}

export async function fetchItemShopProduct(id: string) {
  return get<{ product: ItemShopProduct }>(`/item-shop-products/${encodeURIComponent(id)}`);
}

export async function createItemShopProduct(body: {
  name: string;
  category: ItemShopCategory;
  image_url: string;
  price: number;
  price_unit: string;
  is_free?: boolean;
  allow_logo?: boolean;
  board_format?: "text_only" | "text_link" | "text_link_logo";
  dimension_width_px?: number;
  dimension_height_px?: number;
}) {
  return post<{ product: ItemShopProduct }>(`/item-shop-products`, body);
}

export async function updateItemShopProduct(
  id: string,
  body: Partial<{
    name: string;
    category: ItemShopCategory;
    image_url: string;
    price: number;
    price_unit: string;
    status: "active" | "disabled";
    is_free: boolean;
    allow_logo: boolean;
    board_format: "text_only" | "text_link" | "text_link_logo";
    dimension_width_px: number;
    dimension_height_px: number;
  }>
) {
  return patch<{ product: ItemShopProduct }>(`/item-shop-products/${encodeURIComponent(id)}`, body);
}

export async function deleteItemShopProduct(id: string) {
  return del<{ success: boolean }>(`/item-shop-products/${encodeURIComponent(id)}`);
}

// User Inventory (กระเป๋าเก็บของ — โข่ง/ป้าย)
export type UserInventoryItem = {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  category: "megaphone" | "board";
  image_url: string;
  price_unit: string;
  allow_logo?: boolean;
  board_format?: "text_only" | "text_link" | "text_link_logo";
  purchased_at: string;
  expires_at: string | null;
  uses_left: number | null;
  status: "active" | "used" | "expired";
};

export async function fetchMyInventory() {
  return get<{ items: UserInventoryItem[]; error?: string }>(`/me/inventory`);
}

export async function purchaseInventoryItem(productId: string, quantity: number = 1) {
  return post<{ items: UserInventoryItem[]; count: number }>(`/me/inventory`, {
    product_id: productId,
    quantity: Math.max(1, Math.min(99, Math.floor(quantity) || 1)),
  });
}

export async function consumeInventoryItem(
  id: string,
  message: string,
  roomId?: number,
  linkUrl?: string | null,
  logoUrl?: string | null
) {
  return patch<{ success: boolean; announcement?: { shopName: string; lockLabel: string | null; message: string } }>(
    `/me/inventory/${encodeURIComponent(id)}/use`,
    {
      message,
      room_id: roomId ?? 1,
      ...(linkUrl != null && { link_url: linkUrl }),
      ...(logoUrl != null && { logo_url: logoUrl }),
    }
  );
}

// ยืนยันตัวตน / ยืนยันร้านค้า
export async function fetchMyVerification() {
  return get<{
    verified: boolean;
    verified_at: string | null;
    status?: string | null;
    has_document?: boolean;
    error?: string;
  }>(`/me/verification`);
}

export async function submitIdentityVerification(body: { id_card_url: string; wallet_address?: string }) {
  return post<{ verified: boolean; status: string; message?: string; verified_at?: string | null }>(`/me/verification`, body);
}

export async function fetchMyShop() {
  return get<{
    shop:
      | {
          id: string;
          verification_status: string;
          shop_name: string;
          parcel_id?: string | null;
          logo_url?: string | null;
          logo_background_color?: string | null;
          cover_url?: string | null;
          market_display_url?: string | null;
          shop_parcel_ids?: string[];
        }
      | null;
    registration: unknown;
    productCount?: number;
    lock_labels?: string[];
    package_plan_name?: string | null;
    package_days_left?: number | null;
    max_products_visible?: number | null;
    map_expansion_limit?: number | null;
    map_expansions_used?: number;
    wallet_linked?: boolean;
  }>(`/me/shop`);
}

export async function submitShopVerification(body: { document_url: string }) {
  return post<{ verification_status: string; message?: string }>(`/me/shop/verify`, body);
}

export type MyWallet = {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  is_primary: boolean;
  created_at: string;
};

export async function fetchMyWallet() {
  return get<{ wallet: MyWallet | null; wallets: MyWallet[]; error?: string }>(`/me/wallet`);
}

export async function connectMyWallet(body: { address: string; chain?: string }) {
  return post<{ wallet: MyWallet; wallets: MyWallet[]; error?: string }>(`/me/wallet`, body);
}

/** เครดิตเหรียญในระบบ (ฐานข้อมูล) */
export async function fetchMyBalance() {
  return get<{ balance: number; error?: string }>(`/me/balance`);
}

/** ยอดโทเค็นของระบบจากกระเป๋าหลักของผู้ใช้ (แสดงในเมนู) */
export async function fetchMyWalletTokenBalance() {
  return get<{ balance: number; balanceText?: string; linked: boolean; walletAddress: string | null; tokenAddress?: string; error?: string }>(
    `/me/wallet/token-balance`
  );
}
