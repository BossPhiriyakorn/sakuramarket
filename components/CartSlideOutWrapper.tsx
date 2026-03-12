"use client";

import React, { useCallback } from "react";
import { useCartStore } from "@/store/cartStore";
import { CartSlideOut } from "./CartSlideOut";

/** ใช้ใน layout เพื่อให้ตะกร้าเปิดได้ทั้งหน้าแผนที่และหน้าร้าน */
export function CartSlideOutWrapper() {
  const cartOpen = useCartStore((s) => s.cartOpen);
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  const onClose = useCallback(() => setCartOpen(false), [setCartOpen]);
  return <CartSlideOut open={cartOpen} onClose={onClose} />;
}
