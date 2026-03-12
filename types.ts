
export interface Parcel {
  id: string;
  owner_id: string;
  /** ชื่อแสดงของเจ้าของ (มาจาก profiles.display_name หรือ first_name + last_name) */
  owner_display_name?: string;
  /** รูป avatar ของเจ้าของ (มาจาก profiles.avatar_url) */
  owner_avatar_url?: string;
  title: string;
  description: string;
  image_url: string;
  external_link?: string;
  
  // Grid Coordinates
  grid_x: number;
  grid_y: number;
  width: number;
  height: number;
  
  // UI helper
  color?: number;
  is_label?: boolean;
  /** สถานะยืนยันร้าน (verified = แสดงโล่ให้คนอื่นเห็น) */
  verification_status?: string;
  /** เจ้าของร้านยืนยันตัวตนแล้ว (แสดงโล่ให้คนอื่นเห็น) */
  owner_verified?: boolean;
  /** id ร้าน (มีเมื่อ parcel นี้เป็นร้าน) — ใช้ดึงข้อมูลโฆษณา */
  shop_id?: string;
  /** ร้านนี้มีโฆษณาค้างอยู่ (สำหรับเรียงรายการ + แสดงป้าย ad) */
  has_active_ad?: boolean;
  /** ยอดโฆษณารวมที่จ่ายแล้ว (สำหรับเรียง: จ่ายมากอยู่บน) */
  ad_total_spend?: number;
}

export interface Announcement {
  id: string;
  shopName: string;
  /** ล็อคที่ร้านอยู่ (เช่น ห้อง1 (1,2)) แสดงหลังชื่อร้าน */
  lockLabel?: string | null;
  message: string;
  /** ลิงก์ในประกาศวิ่ง (แถบ Live ให้กดได้) */
  linkUrl?: string | null;
}

/** ข้อความโดเนท/ประกาศที่เด้งขึ้นกลางจอ */
export interface DonationMessage {
  id: string;
  senderName: string;
  amount?: string;
  message: string;
  createdAt: number;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export type RoomId = number;

/** แถวห้องจาก API /api/data/rooms */
export interface RoomRow {
  id: number;
  name: string | null;
  background_url?: string | null;
  slot_price_per_day?: number;
  min_rent_days?: number;
}

export interface GridState {
  viewport: ViewportState;
  isDragging: boolean;
  /** เวลาที่การลากแผนที่จบ (Date.now()) — ใช้กันไม่ให้ปล่อยจากการลากถือเป็น "จิ้มเลือกร้าน" */
  mapDragEndedAt: number | null;
  selectedParcelId: string | null;
  hoveredGridPos: { x: number, y: number } | null;
  parcels: Parcel[];
  announcements: Announcement[];
  /** ห้องแสดงสินค้า (จุดเริ่มเป็นห้อง 1) */
  currentRoom: RoomId;
  /** แสดงเส้นตารางในกรอบตลาด (เปิด/ปิดได้จากปุ่มควบคุม) */
  showGridLines: boolean;
  /** เปิดเสียงแจ้งเตือนเมื่อมีข้อความโดเนท/ประกาศ */
  donationSoundEnabled: boolean;
  /** คิวข้อความโดเนทที่แสดงป๊อปอัป (แสดงทีละรายการ) */
  donationQueue: DonationMessage[];
  /** รายการห้องจาก API (โหลดครั้งเดียวแชร์ระหว่าง GridMap กับ UIOverlay) */
  rooms: RoomRow[];
  setRooms: (rooms: RoomRow[]) => void;
  fetchRooms: () => void;

  // Actions
  setViewport: (viewport: Partial<ViewportState>) => void;
  setDragging: (isDragging: boolean) => void;
  setMapDragEndedAt: (t: number) => void;
  selectParcel: (id: string | null) => void;
  setHoveredGridPos: (pos: { x: number, y: number } | null) => void;
  setCurrentRoom: (room: RoomId) => void;
  fetchParcels: () => void;
  setShowGridLines: (show: boolean) => void;
  setDonationSoundEnabled: (enabled: boolean) => void;
  setAnnouncements: (announcements: Announcement[]) => void;
  addDonation: (item: Omit<DonationMessage, "id" | "createdAt">) => void;
  removeDonation: (id: string) => void;
}
