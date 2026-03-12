"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, ShoppingCart, Store, Minus, Plus, Trash2, Check, Package } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useNavigationLoading } from "@/components/NavigationLoadingOverlay";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

interface CartSlideOutProps {
  open: boolean;
  onClose: () => void;
}

export function CartSlideOut({ open, onClose }: CartSlideOutProps) {
  const router = useRouter();
  const { startNavigation } = useNavigationLoading();
  const itemsByShop = useCartStore((s) => s.itemsByShop);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const toggleItemSelected = useCartStore((s) => s.toggleItemSelected);
  const setShopGroupSelected = useCartStore((s) => s.setShopGroupSelected);

  const { groups, totalItems, selectedCount, selectedTotalPrice } = useMemo(() => {
    const entries = Object.entries(itemsByShop);
    const grps = entries.map(([shopId, g]) => ({
      shopId,
      shopName: g.shopName,
      shopImageUrl: g.shopImageUrl,
      items: g.items,
    }));
    const total = grps.reduce(
      (sum, g) => sum + g.items.reduce((s, i) => s + i.quantity, 0),
      0
    );
    let count = 0;
    let price = 0;
    grps.forEach((g) => {
      g.items.forEach((i) => {
        if (i.selected !== false) {
          count += i.quantity;
          price += i.price * i.quantity;
        }
      });
    });
    return { groups: grps, totalItems: total, selectedCount: count, selectedTotalPrice: price };
  }, [itemsByShop]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity pointer-events-auto"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-md app-glass border-l border-white/10 shadow-2xl z-50 flex flex-col animate-slide-in-from-right pointer-events-auto safe-top"
        role="dialog"
        aria-label="ตะกร้าสินค้า"
      >
        <div className="flex items-center justify-between p-4 border-b border-pink-900/30 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={22} className="text-pink-400" />
            <h2 className="text-lg font-bold text-white">ตะกร้าสินค้า</h2>
            {totalItems > 0 && (
              <span className="rounded-full bg-pink-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                {totalItems}
              </span>
            )}
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

        <p className="text-xs text-pink-300/70 px-4 pt-2 pb-3 shrink-0">
          แยกรายการตามร้าน — เหมือน Shopee
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart size={48} className="text-pink-500/40 mb-3" />
              <p className="text-sm text-pink-400/80">ตะกร้าว่าง</p>
              <p className="text-xs text-slate-400 mt-1">
                เข้าร้านแล้วกด ใส่ตะกร้า หรือ ซื้อเลย
              </p>
            </div>
          ) : (
            <ul className="space-y-6 pb-4">
              {groups.map((group) => (
                <li key={group.shopId} className="rounded-xl border border-pink-900/30 bg-slate-900/40 overflow-hidden">
                  {/* หัวข้อร้าน — แสดงรูปโปรไฟล์ร้าน + ติ๊กเลือกทั้งหมดในร้าน */}
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-pink-950/20 border-b border-pink-900/20">
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = group.items.every((i) => i.selected !== false);
                        setShopGroupSelected(group.shopId, !allSelected);
                      }}
                      className="shrink-0 w-5 h-5 rounded border-2 border-pink-500/60 flex items-center justify-center hover:bg-pink-950/40 transition-colors"
                      aria-label="เลือกทั้งหมดในร้าน"
                      title="เลือกทั้งหมดในร้าน"
                    >
                      {group.items.every((i) => i.selected !== false) && (
                        <Check size={12} className="text-pink-400" />
                      )}
                    </button>
                    {group.shopImageUrl && getDriveImageDisplayUrl(group.shopImageUrl) ? (
                      <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-pink-900/30 bg-slate-800">
                        <img
                          src={getDriveImageDisplayUrl(group.shopImageUrl)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <Store size={16} className="text-pink-400 shrink-0" />
                    )}
                    <span className="font-semibold text-white text-sm truncate">
                      {group.shopName}
                    </span>
                  </div>
                  <ul className="divide-y divide-pink-900/20">
                    {group.items.map((item) => {
                      const isSelected = item.selected !== false;
                      return (
                      <li
                        key={`${group.shopId}-${item.productId}`}
                        className={`flex gap-3 p-3 ${!isSelected ? "opacity-60" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleItemSelected(group.shopId, item.productId)}
                          className="shrink-0 w-5 h-5 mt-6 rounded border-2 border-pink-500/60 flex items-center justify-center hover:bg-pink-950/40 transition-colors"
                          aria-label={isSelected ? "ยกเลิกเลือกรายการ" : "เลือกรายการ"}
                          title={isSelected ? "ไม่คิดเงินรายการนี้" : "คิดเงินรายการนี้"}
                        >
                          {isSelected && <Check size={12} className="text-pink-400" />}
                        </button>
                        <div className="w-14 h-14 shrink-0 rounded-lg bg-slate-800 overflow-hidden border border-pink-900/20">
                          {item.image_url ? (
                            <img
                              src={getDriveImageDisplayUrl(item.image_url)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-pink-500/50">
                              <Package size={20} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm truncate">
                            {item.name}
                          </p>
                          <p className="text-pink-400 text-sm mt-0.5">
                            {item.price.toLocaleString()} เหรียญ × {item.quantity} = {item.price * item.quantity} เหรียญ
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center rounded-lg border border-pink-900/30 overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    group.shopId,
                                    item.productId,
                                    item.quantity - 1
                                  )
                                }
                                className="p-1.5 text-pink-400 hover:bg-pink-950/30 hover:text-white"
                                aria-label="ลดจำนวน"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="min-w-[28px] text-center text-sm text-white">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    group.shopId,
                                    item.productId,
                                    item.quantity + 1
                                  )
                                }
                                className="p-1.5 text-pink-400 hover:bg-pink-950/30 hover:text-white"
                                aria-label="เพิ่มจำนวน"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                removeItem(group.shopId, item.productId)
                              }
                              className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/20"
                              aria-label="ลบออกจากตะกร้า"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ); })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        {groups.length > 0 && (
          <div className="shrink-0 p-4 border-t border-pink-900/30 bg-slate-900/60 safe-bottom">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-slate-300">
                รวมทั้งสิ้น {selectedCount > 0 ? `(${selectedCount} รายการที่เลือก)` : "(ไม่เลือกรายการ)"}
              </span>
              <span className="font-bold text-pink-400">{selectedTotalPrice.toLocaleString()} เหรียญ</span>
            </div>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                if (selectedCount > 0) {
                  onClose();
                  startNavigation();
                  router.push("/checkout");
                }
              }}
              className="w-full py-3 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              ดำเนินการชำระเงิน {selectedCount > 0 ? `(${selectedCount} รายการ)` : ""}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
