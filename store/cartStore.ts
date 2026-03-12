"use client";

import { create } from "zustand";
import type { CartItem, CartShopGroup } from "@/types/cart";

export const useCartStore = create<{
  itemsByShop: Record<string, { shopName: string; shopImageUrl?: string | null; items: CartItem[] }>;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addItem: (params: {
    shopId: string;
    shopName: string;
    shopImageUrl?: string | null;
    product: { id: string; name: string; price: number; image_url: string };
    quantity?: number;
  }) => void;
  removeItem: (shopId: string, productId: string) => void;
  updateQuantity: (shopId: string, productId: string, quantity: number) => void;
  toggleItemSelected: (shopId: string, productId: string) => void;
  setShopGroupSelected: (shopId: string, selected: boolean) => void;
  totalItemCount: () => number;
  getGroups: () => CartShopGroup[];
}>((set, get) => ({
  itemsByShop: {},
  cartOpen: false,
  setCartOpen: (open) => set({ cartOpen: open }),

  addItem: ({ shopId, shopName, shopImageUrl, product, quantity = 1 }) => {
    set((state) => {
      const shop = state.itemsByShop[shopId] ?? { shopName, shopImageUrl: shopImageUrl ?? null, items: [] };
      const existing = shop.items.find((i) => i.productId === product.id);
      const items = existing
        ? shop.items.map((i) =>
            i.productId === product.id
              ? { ...i, quantity: i.quantity + quantity }
              : i
          )
        : [
            ...shop.items,
            {
              productId: product.id,
              name: product.name,
              price: product.price,
              image_url: product.image_url,
              quantity,
              selected: true,
            },
          ];
      const nextShopImageUrl = shopImageUrl !== undefined ? shopImageUrl : shop.shopImageUrl;
      return {
        itemsByShop: {
          ...state.itemsByShop,
          [shopId]: { shopName, shopImageUrl: nextShopImageUrl ?? null, items },
        },
      };
    });
  },

  removeItem: (shopId, productId) => {
    set((state) => {
      const shop = state.itemsByShop[shopId];
      if (!shop) return state;
      const items = shop.items.filter((i) => i.productId !== productId);
      const next = { ...state.itemsByShop };
      if (items.length === 0) {
        delete next[shopId];
      } else {
        next[shopId] = { ...shop, items };
      }
      return { itemsByShop: next };
    });
  },

  updateQuantity: (shopId, productId, quantity) => {
    if (quantity < 1) {
      get().removeItem(shopId, productId);
      return;
    }
    set((state) => {
      const shop = state.itemsByShop[shopId];
      if (!shop) return state;
      const items = shop.items.map((i) =>
        i.productId === productId ? { ...i, quantity } : i
      );
      return {
        itemsByShop: {
          ...state.itemsByShop,
          [shopId]: { ...shop, items },
        },
      };
    });
  },

  toggleItemSelected: (shopId, productId) => {
    set((state) => {
      const shop = state.itemsByShop[shopId];
      if (!shop) return state;
      const items = shop.items.map((i) =>
        i.productId === productId
          ? { ...i, selected: !(i.selected !== false) }
          : i
      );
      return {
        itemsByShop: {
          ...state.itemsByShop,
          [shopId]: { ...shop, items },
        },
      };
    });
  },

  setShopGroupSelected: (shopId, selected) => {
    set((state) => {
      const shop = state.itemsByShop[shopId];
      if (!shop) return state;
      const items = shop.items.map((i) => ({ ...i, selected }));
      return {
        itemsByShop: {
          ...state.itemsByShop,
          [shopId]: { ...shop, items },
        },
      };
    });
  },

  totalItemCount: () => {
    const { itemsByShop } = get();
    return Object.values(itemsByShop).reduce(
      (sum, g) => sum + g.items.reduce((s, i) => s + i.quantity, 0),
      0
    );
  },

  getGroups: () => {
    const { itemsByShop } = get();
    return Object.entries(itemsByShop).map(([shopId, g]) => ({
      shopId,
      shopName: g.shopName,
      shopImageUrl: g.shopImageUrl,
      items: g.items,
    }));
  },
}));
