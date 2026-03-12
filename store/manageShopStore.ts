import { create } from "zustand";
import type { ManageProduct, ManageCategory, ContactChannel } from "@/types/manageShop";

const initialShopName = "";
const initialShopDescription = "";
const initialLogoBackgroundColor = "#ec4899";

interface ManageShopStore {
  shopName: string;
  setShopName: (v: string) => void;
  shopDescription: string;
  setShopDescription: (v: string) => void;
  logoUrl: string | null;
  setLogoUrl: (v: string | null) => void;
  /** สีพื้นหลังรูปโปร (เมื่อรูปโปร่งใส/ไม่มีพื้นหลัง) */
  logoBackgroundColor: string;
  setLogoBackgroundColor: (v: string) => void;
  coverUrl: string | null;
  setCoverUrl: (v: string | null) => void;
  /** รูปแสดงในตลาด (ถ้าไม่ตั้งค่าจะใช้ logoUrl แทน) */
  marketDisplayUrl: string | null;
  setMarketDisplayUrl: (v: string | null) => void;
  products: ManageProduct[];
  setProducts: (v: ManageProduct[] | ((prev: ManageProduct[]) => ManageProduct[])) => void;
  categories: ManageCategory[];
  setCategories: (v: ManageCategory[] | ((prev: ManageCategory[]) => ManageCategory[])) => void;
  contactChannels: ContactChannel[];
  setContactChannels: (v: ContactChannel[] | ((prev: ContactChannel[]) => ContactChannel[])) => void;
  /** ใช้ที่อยู่เดียวกับที่อยู่ตอนสมัคร (โปรไฟล์) */
  useSameAsUserAddress: boolean;
  setUseSameAsUserAddress: (v: boolean) => void;
  shopFullAddress: string;
  setShopFullAddress: (v: string) => void;
  shopMapUrl: string;
  setShopMapUrl: (v: string) => void;
  addProduct: (p: Omit<ManageProduct, "id">) => void;
  deleteProduct: (id: string) => void;
  updateProduct: (id: string, updates: Partial<ManageProduct>) => void;
  addCategory: (name: string) => void;
}

export const useManageShopStore = create<ManageShopStore>((set) => ({
  shopName: initialShopName,
  setShopName: (v) => set({ shopName: v }),
  shopDescription: initialShopDescription,
  setShopDescription: (v) => set({ shopDescription: v }),
  logoUrl: null,
  setLogoUrl: (v) => set({ logoUrl: v }),
  logoBackgroundColor: initialLogoBackgroundColor,
  setLogoBackgroundColor: (v) => set({ logoBackgroundColor: v }),
  coverUrl: null,
  setCoverUrl: (v) => set({ coverUrl: v }),
  marketDisplayUrl: null,
  setMarketDisplayUrl: (v) => set({ marketDisplayUrl: v }),
  products: [],
  setProducts: (v) =>
    set((s) => ({ products: typeof v === "function" ? v(s.products) : v })),
  categories: [],
  setCategories: (v) =>
    set((s) => ({
      categories: typeof v === "function" ? v(s.categories) : v,
    })),
  contactChannels: [],
  setContactChannels: (v) =>
    set((s) => ({
      contactChannels: typeof v === "function" ? v(s.contactChannels) : v,
    })),
  useSameAsUserAddress: true,
  setUseSameAsUserAddress: (v) => set({ useSameAsUserAddress: v }),
  shopFullAddress: "",
  setShopFullAddress: (v) => set({ shopFullAddress: v }),
  shopMapUrl: "",
  setShopMapUrl: (v) => set({ shopMapUrl: v }),
  addProduct: (p) =>
    set((s) => ({
      products: [
        ...s.products,
        {
          ...p,
          id: `prod-${Date.now()}`,
        },
      ],
    })),
  deleteProduct: (id) =>
    set((s) => ({ products: s.products.filter((x) => x.id !== id) })),
  updateProduct: (id, updates) =>
    set((s) => ({
      products: s.products.map((x) =>
        x.id === id ? { ...x, ...updates } : x
      ),
    })),
  addCategory: (name) =>
    set((s) => ({
      categories: [
        ...s.categories,
        { id: `cat-${Date.now()}`, name: name.trim() },
      ],
    })),
}));
