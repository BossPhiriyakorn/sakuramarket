/** รายการในตะกร้า (ต่อร้าน) */
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image_url: string;
  quantity: number;
  /** ติ๊กเลือกเพื่อคิดเงิน (ค่าเริ่มต้น true — ไม่ติ๊กจะไม่นับรวม) */
  selected?: boolean;
}

/** กลุ่มตะกร้าต่อร้าน — แยกหัวข้อตามร้านแบบ Shopee */
export interface CartShopGroup {
  shopId: string;
  shopName: string;
  /** รูปโปรไฟล์/โลโก้ร้าน (แสดงแทนไอคอน) */
  shopImageUrl?: string | null;
  items: CartItem[];
}

export interface CartState {
  /** ร้าน -> { shopName, shopImageUrl?, items } */
  itemsByShop: Record<string, { shopName: string; shopImageUrl?: string | null; items: CartItem[] }>;
  /** เปิด/ปิด panel ตะกร้า (ใช้ทั้งหน้าแผนที่และหน้าร้าน) */
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  /** ใส่สินค้าในตะกร้า (ถ้ามีแล้วในร้านเดียวกัน +1 จำนวน) */
  addItem: (params: {
    shopId: string;
    shopName: string;
    /** รูปโปรไฟล์ร้าน (แสดงในหัวข้อกลุ่ม) */
    shopImageUrl?: string | null;
    product: { id: string; name: string; price: number; image_url: string };
    quantity?: number;
  }) => void;
  /** ลบรายการออก */
  removeItem: (shopId: string, productId: string) => void;
  /** เปลี่ยนจำนวน */
  updateQuantity: (shopId: string, productId: string, quantity: number) => void;
  /** สลับสถานะติ๊กรายการ (เลือก/ไม่เลือกคิดเงิน) */
  toggleItemSelected: (shopId: string, productId: string) => void;
  /** ติ๊ก/ยกติ๊กทั้งหมดในร้าน */
  setShopGroupSelected: (shopId: string, selected: boolean) => void;
  /** จำนวนชิ้นรวมทั้งตะกร้า */
  totalItemCount: () => number;
  /** รายการแยกตามร้าน (สำหรับแสดงใน UI) */
  getGroups: () => CartShopGroup[];
}
