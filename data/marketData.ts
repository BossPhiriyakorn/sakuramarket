/**
 * ข้อมูลตลาด — ไม่ใช้ mock แล้ว ข้อมูลมาจาก API/DB
 * เหลือเฉพาะ types และ helper ที่คืนค่าว่าง (ใช้เมื่อโหลดจาก API ไม่ได้)
 */
import type { Parcel, Announcement } from "@/types";
import type { RoomId } from "@/types";

export type ParcelWithRoom = Parcel & { room_id: number };

export type ItemShopCategory = "frame" | "megaphone" | "board" | "other";

/** คืนค่า parcels ตามห้อง — ข้อมูลจริงมาจาก API /api/data/parcels?roomId= */
export function getParcelsForRoom(_room: RoomId): Parcel[] {
  return [];
}

/** คืนค่า parcels พร้อม room_id — ใช้ใน CMS (โหลดจาก API) */
export function getParcelsWithRoom(): ParcelWithRoom[] {
  return [];
}

/** คืนค่า announcements ตามห้อง — ข้อมูลจริงมาจาก API */
export function getAnnouncementsForRoom(_room: RoomId): Announcement[] {
  return [];
}
