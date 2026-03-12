export interface ManageProduct {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  /** หลายหมวดได้ (เก็บเป็น array) */
  category_ids: string[];
  recommended?: boolean;
  /** จำนวนในคลัง — เมื่อขายจะหักอัตโนมัติ; เหลือ 0 จะเปลี่ยนเป็นไม่แสดง */
  stock_quantity?: number;
  /** active=แสดง, hidden=ไม่แสดง(ซ่อนด้วยมือ), out_of_stock=หมด/ไม่แสดง(อัตโนมัติ) */
  status?: string;
}

export interface ManageCategory {
  id: string;
  name: string;
}

export interface ContactChannel {
  id: string;
  type: string;
  value: string;
  label?: string;
  /** false = ซ่อน ไม่แสดงให้ผู้ใช้คนอื่นที่ดูร้านจากแผนที่ */
  visible?: boolean;
}

export interface ManageShopState {
  shopName: string;
  shopDescription: string;
  logoUrl: string | null;
  logoBackgroundColor: string;
  coverUrl: string | null;
  /** รูปแสดงในตลาด (ถ้าไม่ตั้งค่าจะใช้ logoUrl แทน) */
  marketDisplayUrl: string | null;
  products: ManageProduct[];
  categories: ManageCategory[];
  contactChannels: ContactChannel[];
}
