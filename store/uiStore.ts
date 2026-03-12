import { create } from "zustand";

interface UIState {
  shopListOpen: boolean;
  followingOpen: boolean;
  setShopListOpen: (open: boolean) => void;
  setFollowingOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  shopListOpen: false,
  followingOpen: false,
  setShopListOpen: (open) => set({ shopListOpen: open }),
  setFollowingOpen: (open) => set({ followingOpen: open }),
}));
