/** ข้อมูลที่อยู่แบบละเอียด (ตาราง addresses) */
export interface Address {
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
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** สำหรับสร้าง/อัปเดตที่อยู่ (ไม่รวม id, created_at, updated_at) */
export interface AddressInput {
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
