"use client";

import React, { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore } from "../store";
import { useNavigationLoading } from "@/components/NavigationLoadingOverlay";
import { X, Search, Store, Megaphone } from "lucide-react";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

interface ShopListSlideOutProps {
  open: boolean;
  onClose: () => void;
}

export function ShopListSlideOut({ open, onClose }: ShopListSlideOutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { startNavigation } = useNavigationLoading();
  const parcels = useStore((s) => s.parcels);
  const selectParcel = useStore((s) => s.selectParcel);
  const [search, setSearch] = useState("");

  // เฉพาะร้านค้า (ไม่รวม zone label) — เรียง: ร้านที่โฆษณาอยู่บนสุด, ในกลุ่มโฆษณาเรียงตามยอดจ่ายสูงไปต่ำ, แล้วเรียงตามชื่อ
  const shops = useMemo(() => {
    const list = parcels.filter((p) => !p.is_label);
    return [...list].sort((a, b) => {
      const aAd = a.has_active_ad ? 1 : 0;
      const bAd = b.has_active_ad ? 1 : 0;
      if (bAd !== aAd) return bAd - aAd;
      const aSpend = a.ad_total_spend ?? 0;
      const bSpend = b.ad_total_spend ?? 0;
      if (bSpend !== aSpend) return bSpend - aSpend;
      return a.title.localeCompare(b.title);
    });
  }, [parcels]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.owner_id.toLowerCase().includes(q)
    );
  }, [shops, search]);

  const handleSelectShop = (id: string) => {
    selectParcel(id);
    onClose();
    if (pathname !== "/map") {
      startNavigation();
      router.push("/map");
    }
  };

  if (!open) return null;

  const shortDescription = (text: string, maxLen = 80) =>
    text.length <= maxLen ? text : text.slice(0, maxLen).trim() + "…";

  return (
    <>
      {/* Backdrop - เปิดรับคลิกเพื่อปิด */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity pointer-events-auto"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel - เปิดรับคลิกและ scroll */}
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-md app-glass border-l border-white/10 shadow-2xl z-50 flex flex-col animate-slide-in-from-right pointer-events-auto safe-top safe-bottom"
        role="dialog"
        aria-label="รายการร้านค้า"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Store size={22} className="text-pink-400" />
            <h2 className="text-lg font-bold text-white">รายการร้านค้า</h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-lg text-pink-400 hover:bg-pink-950/30 hover:text-white transition-colors"
            aria-label="ปิด"
          >
            <X size={20} />
          </button>
        </div>

        {/* คำอธิบาย */}
        <p className="text-xs text-pink-300/70 px-4 pt-2 pb-3 shrink-0">
          แสดงรายการร้านค้าทั้งหมดในระบบ (เรียงตามร้านที่ซื้อแพ็กเกจหรือโฆษณา)
        </p>

        {/* ช่องค้นหา */}
        <div className="px-4 pb-4 shrink-0">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400/60"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อหรือไอดีร้านค้า"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/80 border border-pink-900/30 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-pink-400/40 focus:outline-none focus:border-pink-500/50"
            />
          </div>
        </div>

        {/* รายการ - min-h-0 ให้ flex ลูกเลื่อนได้ */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-pink-400/60 py-8 text-center">
              {search.trim() ? "ไม่พบร้านค้าตามคำค้น" : "ยังไม่มีรายการร้านค้า"}
            </p>
          ) : (
            <ul className="space-y-3 pb-2">
              {filtered.map((shop) => (
                <li key={shop.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectShop(shop.id)}
                    className="w-full text-left rounded-lg bg-slate-900/60 border border-pink-900/20 hover:bg-pink-950/20 hover:border-pink-500/30 transition-colors overflow-hidden"
                  >
                    <div className="flex gap-3 p-3">
                      {/* รูปร้าน */}
                      <div className="w-16 h-16 shrink-0 rounded-lg bg-slate-800 overflow-hidden border border-pink-900/20">
                        {shop.image_url ? (
                          <img
                            src={getDriveImageDisplayUrl(shop.image_url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-pink-500/50">
                            <Store size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate flex items-center gap-2 flex-wrap">
                          {shop.title}
                          {shop.has_active_ad && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pink-600/90 text-white shrink-0" title="ร้านนี้เปิดโฆษณาอยู่">
                              <Megaphone size={10} />
                              ad
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-pink-300/70 mt-1 line-clamp-2">
                          {shortDescription(shop.description)}
                        </p>
                        <div className="text-[11px] text-pink-400/60 mt-1 font-mono">
                          ID: {shop.id} · {shop.width}×{shop.height}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
