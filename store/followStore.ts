"use client";

import { create } from "zustand";

/**
 * เก็บร้านค้าที่ผู้ใช้ติดตาม (ฝั่ง UI ใช้ parcel.id ตรงกับ /shop/[id])
 * โหลดจาก GET /api/data/me/follows (followedParcelIds)
 * Toggle ส่ง POST/DELETE /api/data/me/follows ด้วย shop_id (UUID ของ shops)
 */
interface FollowState {
  /** รายการ parcel.id ที่ผู้ใช้ติดตาม (สำหรับแสดงปุ่มหัวใจ) */
  followedShopIds: string[];
  setFollowedShopIds: (ids: string[]) => void;
  /** โหลดรายการติดตามจาก API */
  loadFollows: () => Promise<void>;
  /** สลับสถานะติดตาม: parcelId = parcel.id สำหรับ UI, shopId = shops.id สำหรับ API */
  toggle: (parcelId: string, shopId?: string) => Promise<void>;
  isFollowing: (parcelId: string) => boolean;
}

export const useFollowStore = create<FollowState>((set, get) => ({
  followedShopIds: [],

  setFollowedShopIds: (ids: string[]) => set({ followedShopIds: ids }),

  loadFollows: async () => {
    try {
      const res = await fetch("/api/data/me/follows", { credentials: "include" });
      const data = await res.json();
      const ids = Array.isArray(data.followedParcelIds) ? data.followedParcelIds : [];
      set({ followedShopIds: ids });
    } catch {
      set({ followedShopIds: [] });
    }
  },

  toggle: async (parcelId: string, shopId?: string) => {
    let resolvedShopId = shopId;
    if (!resolvedShopId) {
      try {
        const res = await fetch(`/api/data/parcels/${parcelId}/shop`, { credentials: "include" });
        const data = await res.json();
        resolvedShopId = data.shop?.id ?? undefined;
      } catch {
        // fallback: update UI only (ไม่ sync กับ API)
      }
    }
    const state = get();
    const has = state.followedShopIds.includes(parcelId);
    if (resolvedShopId) {
      try {
        if (has) {
          const res = await fetch("/api/data/me/follows", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shop_id: resolvedShopId }),
            credentials: "include",
          });
          if (!res.ok) throw new Error("ยกเลิกติดตามไม่สำเร็จ");
        } else {
          const res = await fetch("/api/data/me/follows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shop_id: resolvedShopId }),
            credentials: "include",
          });
          if (!res.ok) throw new Error("ติดตามไม่สำเร็จ");
        }
      } catch {
        return;
      }
    }
    set((s) => {
      const included = s.followedShopIds.includes(parcelId);
      if (included) {
        return { followedShopIds: s.followedShopIds.filter((id) => id !== parcelId) };
      }
      return { followedShopIds: [...s.followedShopIds, parcelId] };
    });
  },

  isFollowing: (parcelId: string) => get().followedShopIds.includes(parcelId),
}));
