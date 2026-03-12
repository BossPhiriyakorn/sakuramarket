"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Megaphone, Layout, ShoppingCart, Loader2 } from "lucide-react";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { fetchItemShopProducts, purchaseInventoryItem, type ItemShopProduct, type ItemShopCategory } from "@/lib/api/client";
import { useNavigationLoading } from "@/components/NavigationLoadingOverlay";
import { useToastStore } from "@/store/toastStore";
import { LoadingImage } from "@/components/LoadingImage";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

/** หมวดหมู่ที่แสดงใน Item Shop — ซ่อน "กรอบตกแต่ง" (frame) และ "อื่นๆ" (other) ตามที่กำหนด */
const CATEGORY_META: { id: string; label: string; shortLabel: string; desc: string; icon: typeof Megaphone; apiCategory: ItemShopCategory }[] = [
  { id: "megaphones", label: "ประกาศวิ่ง", shortLabel: "ประกาศ", desc: "การประกาศในสไลด์ — ข้อความวิ่งในแถบ Live", icon: Megaphone, apiCategory: "megaphone" },
  { id: "boards", label: "ป้ายประกาศ", shortLabel: "ป้าย", desc: "การประกาศแบบครั้งเดียว — แสดงเป็นป้ายขึ้นมา", icon: Layout, apiCategory: "board" },
];

type TabId = (typeof CATEGORY_META)[number]["id"];

function productToTabId(category: ItemShopCategory): TabId {
  const map: Record<ItemShopCategory, TabId> = {
    frame: "frames",
    megaphone: "megaphones",
    board: "boards",
    other: "other",
  };
  return map[category];
}

const BUYABLE_CATEGORIES: ItemShopCategory[] = ["megaphone", "board"];

function ItemCard({
  item,
  onBuy,
  buying,
}: {
  item: ItemShopProduct;
  onBuy: (quantity: number) => void;
  buying?: boolean;
}) {
  const canBuy = BUYABLE_CATEGORIES.includes(item.category);
  const [quantity, setQuantity] = useState(1);
  const handleClick = () => {
    const q = Math.max(1, Math.min(99, quantity));
    setQuantity(1);
    onBuy(q);
  };
  return (
    <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden hover:border-pink-500/30 transition-colors flex flex-col">
      <div className="aspect-square bg-slate-800 flex items-center justify-center p-4">
        {(() => {
          const imgUrl = getDriveImageDisplayUrl(item.image_url);
          return imgUrl ? (
            <img src={imgUrl} alt={item.name} className="w-full h-full object-contain" />
          ) : (
            <Package size={32} className="text-slate-500" />
          );
        })()}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold text-white text-sm truncate">{item.name}</h3>
        <p className="text-pink-300 font-bold text-sm flex items-center gap-2 flex-wrap">
          {item.is_free ? (
            <span className="inline-flex px-2 py-0.5 rounded bg-green-900/50 text-green-300 text-xs font-medium">ฟรี</span>
          ) : (
            <>{item.price} <span className="text-slate-400 font-normal text-xs">{item.price_unit}</span></>
          )}
        </p>
        {canBuy ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">จำนวน</span>
              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
                className="w-14 rounded bg-slate-800 border border-pink-900/30 text-white text-sm px-2 py-1 text-center"
              />
            </div>
            <button
              type="button"
              onClick={handleClick}
              disabled={buying}
              className="mt-auto w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {buying ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
              {buying ? (item.is_free ? "กำลังรับ..." : "กำลังซื้อ...") : (item.is_free ? `รับฟรี ${quantity > 1 ? `(${quantity} ชิ้น)` : ""}` : `ซื้อ ${quantity > 1 ? quantity + " ชิ้น" : ""}`).trim()}
            </button>
          </>
        ) : (
          <p className="mt-auto text-slate-500 text-xs">ใช้สำหรับตกแต่ง/อื่นๆ</p>
        )}
      </div>
    </div>
  );
}

export default function ItemShopPage() {
  const router = useRouter();
  const { startNavigation } = useNavigationLoading();
  const addToast = useToastStore((s) => s.addToast);
  const [products, setProducts] = useState<ItemShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<TabId>("megaphones");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchItemShopProducts()
      .then((data) => {
        if (!cancelled) {
          const list = (data.products ?? []).filter((p) => p.status === "active");
          setProducts(list);
        }
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeMeta = CATEGORY_META.find((c) => c.id === activeCategory);
  const itemsInCategory = products.filter((p) => productToTabId(p.category) === activeCategory);

  const handleBuy = async (item: ItemShopProduct, quantity: number) => {
    setError(null);
    setBuyingId(item.id);
    try {
      const res = await purchaseInventoryItem(item.id, quantity);
      const count = res?.count ?? 1;
      addToast(`ซื้อสำเร็จ ${count} ชิ้น`, "success");
      if (confirm("ไปที่โปรไฟล์ดูกระเป๋าเก็บของไหม?")) {
        startNavigation();
        router.push("/profile");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ซื้อไม่สำเร็จ — กรุณาเข้าสู่ระบบ";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />
      <div className="relative z-10 flex flex-col flex-1">
      <UnifiedHeader />

      <main className="w-full max-w-5xl mx-auto p-4 md:p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
          <Package size={22} className="text-pink-400 shrink-0" />
          Item Shop
        </h1>
        {/* แท็บหมวดหมู่ — โมบาย: ไอคอน+คำ (short) ขนาดเล็กลง */}
        <div className="flex gap-1 p-1.5 sm:p-1 rounded-xl app-glass-subtle mb-4 sm:mb-6 overflow-x-auto">
          {CATEGORY_META.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            const count = products.filter((p) => productToTabId(p.category) === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2.5 sm:py-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors min-w-0 ${
                  isActive
                    ? "bg-pink-600 text-white"
                    : "text-slate-400 hover:text-pink-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon size={16} className="sm:w-[18px] sm:h-[18px] shrink-0" />
                <span className="whitespace-nowrap sm:hidden">{cat.shortLabel}</span>
                <span className="hidden sm:inline">{cat.label}</span>
                {count > 0 && <span className="text-[10px] sm:text-xs opacity-80">({count})</span>}
              </button>
            );
          })}
        </div>

        {activeMeta && (
          <p className="text-slate-400 text-sm mb-4">
            {activeMeta.desc}
          </p>
        )}

        {loading ? (
          <div className="py-12">
            <LoadingImage message="กำลังโหลดสินค้า..." size={72} />
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-2 text-sm">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {itemsInCategory.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onBuy={(q) => handleBuy(item, q)}
                  buying={buyingId === item.id}
                />
              ))}
            </div>

            {itemsInCategory.length === 0 && (
              <p className="text-slate-500 text-center py-12">ยังไม่มีรายการในหมวดนี้</p>
            )}
          </>
        )}
      </main>
      </div>
    </div>
  );
}
