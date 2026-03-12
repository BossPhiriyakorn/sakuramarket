"use client";

import React, { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import { ShopListSlideOut } from "@/components/ShopListSlideOut";
import { FollowingSlideOut } from "@/components/FollowingSlideOut";
import { useStore } from "@/store";

/**
 * สไลด์รายการร้านค้า + การติดตาม ใช้ได้ทุกหน้า (ไม่ต้องกลับหน้าแรก)
 * โหลด parcels เมื่อเปิดรายการร้านค้าบนหน้าอื่นที่ยังไม่มีข้อมูล
 */
export function GlobalSlideOuts() {
  const shopListOpen = useUIStore((s) => s.shopListOpen);
  const setShopListOpen = useUIStore((s) => s.setShopListOpen);
  const followingOpen = useUIStore((s) => s.followingOpen);
  const setFollowingOpen = useUIStore((s) => s.setFollowingOpen);
  const fetchParcels = useStore((s) => s.fetchParcels);

  useEffect(() => {
    if (shopListOpen) fetchParcels();
  }, [shopListOpen, fetchParcels]);

  return (
    <>
      <ShopListSlideOut open={shopListOpen} onClose={() => setShopListOpen(false)} />
      <FollowingSlideOut open={followingOpen} onClose={() => setFollowingOpen(false)} />
    </>
  );
}
