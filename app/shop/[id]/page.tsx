"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  Store,
  ShoppingBag,
  ShoppingCart,
  Heart,
  Star,
  Sparkles,
  Filter,
  Package,
} from "lucide-react";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { OnlineBadge } from "@/components/OnlineBadge";
import { ProductReviewSection } from "@/components/ProductReviewSection";
import { useStore } from "@/store";
import { useCartStore } from "@/store/cartStore";
import { useToastStore } from "@/store/toastStore";
import { useFollowStore } from "@/store/followStore";
import { getCategoryNames } from "@/lib/getCategoryNames";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";
import { useNavigationLoading } from "@/components/NavigationLoadingOverlay";
import type { ManageProduct, ManageCategory } from "@/types/manageShop";

const StarRatingDisplay = ({ rating }: { rating: number }) => (
  <span className="flex items-center gap-0.5 text-amber-400">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={18}
        className={i <= rating ? "fill-amber-400" : "text-slate-600"}
      />
    ))}
  </span>
);

type ShopData = {
  shop: { id: string; user_id?: string; shop_name?: string; logo_url?: string; cover_url?: string } | null;
  products: ManageProduct[];
  categories: ManageCategory[];
  owner_display_name: string | null;
  owner_last_seen_at: string | null;
};
function toManageProduct(p: Record<string, unknown>): ManageProduct {
  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    price: Number(p.price ?? 0),
    description: String(p.description ?? ""),
    image_url: String(p.image_url ?? ""),
    category_ids: Array.isArray(p.category_ids) ? (p.category_ids as string[]) : [],
    recommended: Boolean(p.recommended),
  };
}

function toManageCategory(c: Record<string, unknown>): ManageCategory {
  return { id: String(c.id ?? ""), name: String(c.name ?? "") };
}

export default function ShopViewPage() {
  const params = useParams();
  const router = useRouter();
  const { startNavigation } = useNavigationLoading();
  const id = typeof params?.id === "string" ? params.id : null;
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [productMeta, setProductMeta] = useState<Record<string, { avg_rating: number; review_count: number; sold_count: number }>>({});
  const [reviewProduct, setReviewProduct] = useState<{ id: string; name: string } | null>(null);
  const [productModalTab, setProductModalTab] = useState<"detail" | "reviews">("detail");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const productViewSentRef = useRef<Set<string>>(new Set());

  const parcels = useStore((s) => s.parcels);
  const fetchParcels = useStore((s) => s.fetchParcels);
  const addToCart = useCartStore((s) => s.addItem);
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  const addToast = useToastStore((s) => s.addToast);
  const followedParcelIds = useFollowStore((s) => s.followedShopIds);
  const loadFollows = useFollowStore((s) => s.loadFollows);
  const toggleFollow = useFollowStore((s) => s.toggle);
  const parcel = id ? parcels.find((p) => p.id === id && !p.is_label) : null;

  const shopId = shopData?.shop?.id ?? null;
  const shopDisplayName = shopData?.shop?.shop_name?.trim() || parcel?.title || "ร้านค้า";
  const products = shopData?.products ?? [];
  const categories = shopData?.categories ?? [];
  const coverUrl = shopData?.shop?.cover_url ?? null;
  const logoUrl = shopData?.shop?.logo_url ?? null;

  const recommendedProducts = products.filter((p) => p.recommended);
  const filteredProducts =
    selectedCategoryId == null || selectedCategoryId === ""
      ? products
      : products.filter((p) => p.category_ids?.includes(selectedCategoryId));

  const fetchShopData = useCallback(async (parcelId: string) => {
    setShopLoading(true);
    try {
      const res = await fetch(`/api/data/parcels/${parcelId}/shop`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลร้านไม่สำเร็จ");
      const ownerName =
        typeof data.owner_display_name === "string" && data.owner_display_name.trim()
          ? data.owner_display_name.trim()
          : null;
      setShopData({
        shop: data.shop,
        products: Array.isArray(data.products) ? data.products.map(toManageProduct) : [],
        categories: Array.isArray(data.categories) ? data.categories.map(toManageCategory) : [],
        owner_display_name: ownerName,
        owner_last_seen_at: typeof data.owner_last_seen_at === "string" ? data.owner_last_seen_at : null,
      });
    } catch {
      setShopData({ shop: null, products: [], categories: [], owner_display_name: null, owner_last_seen_at: null });
    } finally {
      setShopLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  useEffect(() => {
    loadFollows();
  }, [loadFollows]);

  useEffect(() => {
    if (id) fetchShopData(id);
  }, [id, fetchShopData]);

  // เจ้าของร้านที่เข้าหน้า /shop/[id] (จากลิงก์หรือรายการติดตาม) → ไปจัดการร้านค้าแทน
  useEffect(() => {
    const shopUserId = shopData?.shop?.user_id;
    if (!shopUserId || shopLoading) return;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          window.location.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((data: { user?: { id?: string } } | null) => {
        if (data == null) return;
        const uid = data?.user?.id;
        if (typeof uid !== "string" || !uid.trim()) {
          window.location.replace("/login");
          return;
        }
        if (typeof uid === "string" && uid === shopUserId) {
          router.replace("/manage-shop");
        }
      })
      .catch(() => {});
  }, [shopData?.shop?.user_id, shopLoading, router]);

  useEffect(() => {
    if (reviewProduct) setProductModalTab("detail");
  }, [reviewProduct?.id]);

  // บันทึกการเข้าชมร้าน (อนาเลติกส์โฆษณา)
  useEffect(() => {
    const shopId = shopData?.shop?.id;
    if (!shopId) return;
    const sessionId = typeof window !== "undefined" && window.sessionStorage
      ? (window.sessionStorage.getItem("shop_view_session") || `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
      : undefined;
    if (typeof window !== "undefined" && window.sessionStorage && !window.sessionStorage.getItem("shop_view_session")) {
      window.sessionStorage.setItem("shop_view_session", sessionId ?? "");
    }
    fetch(`/api/data/shop/${shopId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "shop_view", session_id: sessionId }),
    }).catch(() => {});
  }, [shopData?.shop?.id]);

  useEffect(() => {
    const shopId = shopData?.shop?.id;
    const hasProducts = (shopData?.products?.length ?? 0) > 0;
    if (!shopId || !hasProducts) return;
    const sessionId = typeof window !== "undefined" && window.sessionStorage
      ? window.sessionStorage.getItem("shop_view_session")
      : undefined;
    const t = setTimeout(() => {
      fetch(`/api/data/shop/${shopId}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "product_list_view", session_id: sessionId }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [shopData?.shop?.id, shopData?.products?.length]);

  // บันทึกการดูสินค้า (รายการสินค้าที่คนดูเยอะสุด) — เมื่อการ์ดสินค้าเข้า viewport
  useEffect(() => {
    const shopId = shopData?.shop?.id;
    if (!shopId || products.length === 0) return;
    const sessionId = typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage.getItem("shop_view_session") : null;
    const cards = document.querySelectorAll("[data-product-view-id]");
    if (cards.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const productId = (entry.target as HTMLElement).getAttribute("data-product-view-id");
          if (!productId || productViewSentRef.current.has(productId)) return;
          productViewSentRef.current.add(productId);
          fetch(`/api/data/shop/${shopId}/products/${productId}/view`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          }).catch(() => {});
        });
      },
      { rootMargin: "50px", threshold: 0.2 }
    );
    cards.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [shopData?.shop?.id, products.length]);

  useEffect(() => {
    if (!shopData?.products?.length) return;
    shopData.products.forEach((p) => {
      fetch(`/api/data/products/${p.id}/reviews`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data: { avg_rating?: number; review_count?: number; sold_count?: number }) => {
          setProductMeta((prev) => ({
            ...prev,
            [p.id]: {
              avg_rating: Number(data.avg_rating ?? 0),
              review_count: Number(data.review_count ?? 0),
              sold_count: Number(data.sold_count ?? 0),
            },
          }));
        })
        .catch(() => {});
    });
  }, [shopData?.products]);

  if (!id) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-pink-400">ไม่พบร้านค้า</p>
      </div>
    );
  }

  if (!shopLoading && shopData?.shop === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-pink-400">ไม่พบร้านค้านี้</p>
        <Link
          href="/map"
          className="flex items-center gap-2 text-pink-400 hover:text-white"
        >
          <ArrowLeft size={20} />
          กลับแผนที่
        </Link>
      </div>
    );
  }

  const isFollowing = id ? followedParcelIds.includes(id) : false;
  const parcelTitle = parcel?.title ?? (shopData?.shop?.shop_name?.trim() || "ร้านค้า");
  const parcelDescription = parcel?.description ?? "";
  const parcelImageUrl = parcel?.image_url ?? null;
  const parcelOwnerId = parcel?.owner_id ?? "";

  // คำนวณ avg rating จากรีวิวสินค้าทุกชิ้น (weighted average)
  const allProductMeta = Object.values(productMeta);
  const shopReviewCount = allProductMeta.reduce((sum, m) => sum + m.review_count, 0);
  const shopAvgRating = shopReviewCount > 0
    ? allProductMeta.reduce((sum, m) => sum + m.avg_rating * m.review_count, 0) / shopReviewCount
    : 0;

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />
      <UnifiedHeader />

      <main className="relative z-10 w-full max-w-4xl mx-auto px-3 py-4 sm:p-4 md:p-6 space-y-6 sm:space-y-8 flex-1">
        <h1 className="text-xl font-bold text-white sr-only">{parcelTitle}</h1>
        {/* รูปร้าน + ข้อมูลพื้นฐาน */}
        <section className="rounded-xl overflow-hidden app-glass">
          <div className="w-full aspect-[3/1] min-h-[140px] sm:min-h-[180px] bg-slate-800 relative overflow-hidden">
            {(coverUrl || parcelImageUrl) ? (
              <img
                src={getDriveImageDisplayUrl(coverUrl || parcelImageUrl)}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
          <div className="p-4 md:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              {parcelTitle}
            </h2>

            {/* ดาวเฉลี่ยจากรีวิวสินค้าทุกชิ้น */}
            <div className="flex items-center gap-2 mb-4">
              {shopReviewCount > 0 ? (
                <>
                  <StarRatingDisplay rating={Math.round(shopAvgRating)} />
                  <span className="text-amber-400 font-semibold text-sm">
                    {shopAvgRating.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-slate-500 text-sm">— ดาว</span>
              )}
              <span className="text-slate-400 text-xs">
                ({shopReviewCount} รีวิว)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              {parcel && (
                <div className="flex items-center gap-2 text-pink-300/80 text-sm">
                  <MapPin size={16} />
                  <span>
                    แถว {parcel.grid_y + 1} · คอลัมน์{" "}
                    {String.fromCharCode(65 + (parcel.grid_x % 26))}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-sm font-bold">
                  {(shopData?.owner_display_name || parcelOwnerId).charAt(0).toUpperCase()}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm text-slate-400">
                    {shopData?.owner_display_name ?? parcelOwnerId}
                  </span>
                  <OnlineBadge lastSeenAt={shopData?.owner_last_seen_at} />
                </div>
              </div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              {parcelDescription}
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!id) return;
                  toggleFollow(id, shopId ?? undefined);
                }}
                disabled={!shopId}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors border cursor-pointer select-none disabled:opacity-50 ${
                  isFollowing
                    ? "bg-pink-950/50 border-pink-500/50 text-pink-300 hover:bg-pink-950/70"
                    : "bg-slate-800 hover:bg-slate-700 text-pink-200 border-pink-900/30"
                }`}
                aria-pressed={isFollowing}
                aria-label={isFollowing ? "ยกเลิกติดตามร้าน" : "ติดตามร้าน"}
              >
                <Heart
                  size={18}
                  className={isFollowing ? "fill-pink-400" : ""}
                />
                {isFollowing ? "ยกเลิกติดตาม" : "ติดตาม"}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-pink-200 border border-pink-900/30 font-medium transition-colors"
              >
                <MessageCircle size={18} />
                ติดต่อ
              </button>
            </div>
          </div>
        </section>

        {/* สินค้าแนะนำ — รูปแบบการ์ดเหมือนสินค้าปกติ + คลิกเปิดป๊อปอัปรายละเอียด/รีวิว */}
        {!shopLoading && recommendedProducts.length > 0 && (
          <section className="md:mt-2">
            <h3 className="text-sm sm:text-base font-bold text-amber-400/90 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-amber-400/90" />
              สินค้าแนะนำ
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-pink-900/50 scrollbar-track-transparent">
              {recommendedProducts.map((p) => {
                const catNames = getCategoryNames(p, categories);
                const shopImageUrl = logoUrl || coverUrl || parcel?.image_url;
                const handleAddToCart = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!shopId) return;
                  addToCart({
                    shopId,
                    shopName: shopDisplayName,
                    shopImageUrl: shopImageUrl ?? "",
                    product: { id: p.id, name: p.name, price: p.price, image_url: p.image_url },
                    quantity: 1,
                  });
                  addToast("เพิ่มในตะกร้าแล้ว", "success");
                  setCartOpen(true);
                };
                const handleBuyNow = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!shopId) return;
                  addToCart({
                    shopId,
                    shopName: shopDisplayName,
                    shopImageUrl: shopImageUrl ?? "",
                    product: { id: p.id, name: p.name, price: p.price, image_url: p.image_url },
                    quantity: 1,
                  });
                  startNavigation();
                  router.push("/checkout");
                };
                return (
                  <div
                    key={p.id}
                    data-product-view-id={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setReviewProduct({ id: p.id, name: p.name })}
                    onKeyDown={(e) => e.key === "Enter" && setReviewProduct({ id: p.id, name: p.name })}
                    className="flex-shrink-0 w-[260px] sm:w-[280px] rounded-2xl overflow-hidden flex flex-col border border-pink-900/25 bg-slate-900/70 backdrop-blur-sm shadow-lg cursor-pointer active:scale-[0.99] transition-transform hover:border-pink-800/40"
                  >
                    <div className="aspect-square w-full bg-slate-800/80 relative shrink-0 overflow-hidden">
                      {(() => {
                        const imgUrl = getDriveImageDisplayUrl(p.image_url);
                        return imgUrl ? (
                          <img src={imgUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">ไม่มีรูป</div>
                        );
                      })()}
                    </div>
                    <div className="p-3.5 sm:p-3 flex-1 flex flex-col min-h-0">
                      <div className="font-semibold text-white truncate text-sm leading-tight">{p.name}</div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-pink-400 font-semibold text-sm">{p.price} เหรียญ</span>
                        <span className="text-slate-400 text-xs">ขายแล้ว {(productMeta[p.id]?.sold_count ?? 0).toLocaleString()}</span>
                      </div>
                      {productMeta[p.id]?.review_count > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {[1,2,3,4,5].map((i) => (
                            <Star key={i} size={12} className={i <= Math.round(productMeta[p.id].avg_rating) ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
                          ))}
                          <span className="text-amber-400 text-xs font-medium">{productMeta[p.id].avg_rating.toFixed(1)}</span>
                          <span className="text-slate-400 text-xs">({productMeta[p.id].review_count})</span>
                        </div>
                      )}
                      <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 flex-1 leading-relaxed">{p.description}</p>
                      {catNames.length > 0 && (
                        <span className="inline-block mt-2 text-xs text-pink-400/90 bg-pink-950/40 px-2.5 py-1 rounded-md w-fit border border-pink-900/30">
                          {catNames.join(", ")}
                        </span>
                      )}
                      <div className="flex gap-2 mt-3 shrink-0">
                        <button type="button" onClick={handleAddToCart} disabled={!shopId} className="flex-1 min-w-0 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-pink-900/30 text-pink-200 text-xs font-medium transition-all duration-150 whitespace-nowrap shadow-inner">
                          <ShoppingCart size={14} className="shrink-0" /> ใส่ตะกร้า
                        </button>
                        <button type="button" onClick={handleBuyNow} disabled={!shopId} className="flex-1 min-w-0 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold transition-all duration-150 whitespace-nowrap shadow-lg shadow-pink-900/30">
                          <ShoppingBag size={14} className="shrink-0" /> ซื้อเลย
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setReviewProduct({ id: p.id, name: p.name }); }}
                        className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs text-slate-300 hover:text-amber-400 transition-colors rounded-lg hover:bg-white/5"
                      >
                        <Star size={12} /> ดูรีวิวสินค้า
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* สินค้า — โหลดจาก API ตาม parcel + ฟิลเตอร์หมวดหมู่ */}
        <section className="md:mt-2">
          <h3 className="text-sm sm:text-base font-bold text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Store size={18} className="text-pink-400/90" />
            สินค้า
          </h3>
          {shopLoading ? (
            <p className="text-slate-400 text-sm py-8 text-center rounded-2xl bg-slate-900/50 border border-pink-900/20 app-glass-subtle">
              กำลังโหลด...
            </p>
          ) : products.length === 0 ? (
            <p className="text-pink-400/80 text-sm py-8 text-center rounded-2xl bg-slate-900/50 border border-pink-900/20 app-glass-subtle">
              ร้านนี้ยังไม่มีรายการสินค้า
            </p>
          ) : (
            <>
              {/* ฟิลเตอร์กรองหมวดสินค้า */}
              {categories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Filter size={16} className="text-slate-400 shrink-0" />
                  <span className="text-slate-400 text-sm mr-1">หมวด:</span>
                  <select
                    value={selectedCategoryId ?? ""}
                    onChange={(e) => setSelectedCategoryId(e.target.value === "" ? null : e.target.value)}
                    className="rounded-lg bg-slate-800 border border-pink-900/30 text-white text-sm px-3 py-2 focus:outline-none focus:border-pink-500/50 min-w-[140px]"
                  >
                    <option value="">ทั้งหมด</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {filteredProducts.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center rounded-2xl bg-slate-900/50 border border-pink-900/20">
                  ไม่มีสินค้าในหมวดนี้
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filteredProducts.map((p) => {
                const catNames = getCategoryNames(p, categories);
                const shopImageUrl = (logoUrl || coverUrl || parcel?.image_url) ?? "";
                const handleAddToCart = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!shopId) return;
                  addToCart({
                    shopId,
                    shopName: shopDisplayName,
                    shopImageUrl,
                    product: {
                      id: p.id,
                      name: p.name,
                      price: p.price,
                      image_url: p.image_url,
                    },
                    quantity: 1,
                  });
                  addToast("เพิ่มในตะกร้าแล้ว", "success");
                  setCartOpen(true);
                };
                const handleBuyNow = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!shopId) return;
                  addToCart({
                    shopId,
                    shopName: shopDisplayName,
                    shopImageUrl,
                    product: {
                      id: p.id,
                      name: p.name,
                      price: p.price,
                      image_url: p.image_url,
                    },
                    quantity: 1,
                  });
                  startNavigation();
                  router.push("/checkout");
                };
                return (
                  <div
                    key={p.id}
                    data-product-view-id={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setReviewProduct({ id: p.id, name: p.name })}
                    onKeyDown={(e) => e.key === "Enter" && setReviewProduct({ id: p.id, name: p.name })}
                    className="rounded-2xl overflow-hidden flex flex-col border border-pink-900/25 bg-slate-900/70 backdrop-blur-sm shadow-lg shadow-black/20 sm:shadow-none sm:bg-slate-900/60 sm:border-pink-900/20 sm:rounded-xl active:scale-[0.99] transition-transform cursor-pointer hover:border-pink-800/40"
                  >
                    <div className="aspect-square w-full bg-slate-800/80 relative shrink-0 overflow-hidden">
                      {(() => {
                        const imgUrl = getDriveImageDisplayUrl(p.image_url);
                        return imgUrl ? (
                          <img
                            src={imgUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover object-center"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">ไม่มีรูป</div>
                        );
                      })()}
                    </div>
                    <div className="p-3.5 sm:p-3 flex-1 flex flex-col min-h-0">
                      <div className="font-semibold text-white truncate text-sm leading-tight">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-pink-400 font-semibold text-sm">{p.price} เหรียญ</span>
                        <span className="text-slate-400 text-xs">
                          ขายแล้ว {(productMeta[p.id]?.sold_count ?? 0).toLocaleString()}
                        </span>
                      </div>
                      {productMeta[p.id]?.review_count > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {[1,2,3,4,5].map((i) => (
                            <Star key={i} size={12} className={i <= Math.round(productMeta[p.id].avg_rating) ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
                          ))}
                          <span className="text-amber-400 text-xs font-medium">{productMeta[p.id].avg_rating.toFixed(1)}</span>
                          <span className="text-slate-400 text-xs">({productMeta[p.id].review_count})</span>
                        </div>
                      )}
                      <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 flex-1 leading-relaxed">
                        {p.description}
                      </p>
                      {catNames.length > 0 && (
                        <span className="inline-block mt-2 text-xs text-pink-400/90 bg-pink-950/40 px-2.5 py-1 rounded-md w-fit border border-pink-900/30">
                          {catNames.join(", ")}
                        </span>
                      )}
                      <div className="flex gap-2 mt-3 shrink-0">
                        <button
                          type="button"
                          onClick={handleAddToCart}
                          disabled={!shopId}
                          className="flex-1 min-w-0 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-pink-900/30 text-pink-200 text-xs font-medium transition-all duration-150 whitespace-nowrap shadow-inner"
                        >
                          <ShoppingCart size={14} className="shrink-0" />
                          ใส่ตะกร้า
                        </button>
                        <button
                          type="button"
                          onClick={handleBuyNow}
                          disabled={!shopId}
                          className="flex-1 min-w-0 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 active:scale-[0.98] text-white text-xs font-semibold transition-all duration-150 whitespace-nowrap shadow-lg shadow-pink-900/30"
                        >
                          <ShoppingBag size={14} className="shrink-0" />
                          ซื้อเลย
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setReviewProduct({ id: p.id, name: p.name }); }}
                        className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs text-slate-300 hover:text-amber-400 transition-colors rounded-lg hover:bg-white/5"
                      >
                        <Star size={12} />
                        ดูรีวิวสินค้า
                      </button>
                    </div>
                  </div>
                );
              })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Modal รายละเอียดสินค้า + แท็บสลับดูรีวิว */}
        {reviewProduct && (() => {
          const detailProduct = products.find((pr) => pr.id === reviewProduct.id);
          const openProduct = () => { setProductModalTab("detail"); };
          const openReviews = () => { setProductModalTab("reviews"); };
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
              onClick={() => { setReviewProduct(null); setProductModalTab("detail"); }}
            >
              <div
                className="rounded-xl border border-pink-900/30 bg-slate-900 shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative flex items-center justify-between p-4 border-b border-pink-900/30 shrink-0">
                  <h3 className="font-semibold text-white text-sm flex items-center gap-2 truncate pr-10">
                    <Star size={16} className="text-amber-400 fill-amber-400 shrink-0" />
                    {reviewProduct.name || "รายละเอียดสินค้า"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setReviewProduct(null); setProductModalTab("detail"); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
                {/* เมนูสลับ รายละเอียด | รีวิว */}
                <div className="flex border-b border-pink-900/20 shrink-0">
                  <button
                    type="button"
                    onClick={openProduct}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${productModalTab === "detail" ? "text-pink-300 border-b-2 border-pink-500 bg-pink-950/30" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    รายละเอียด
                  </button>
                  <button
                    type="button"
                    onClick={openReviews}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${productModalTab === "reviews" ? "text-pink-300 border-b-2 border-pink-500 bg-pink-950/30" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    รีวิว
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  {productModalTab === "detail" && detailProduct ? (
                    <div className="space-y-4">
                      <div className="rounded-xl overflow-hidden bg-slate-800/80 aspect-square max-w-[280px] mx-auto">
                        {detailProduct.image_url ? (
                          <img
                            src={getDriveImageDisplayUrl(detailProduct.image_url)}
                            alt=""
                            className="w-full h-full object-cover object-center"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">ไม่มีรูป</div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-base">{detailProduct.name}</h4>
                        <p className="text-pink-400 font-semibold text-lg mt-1">{detailProduct.price} เหรียญ</p>
                        <div className="flex items-center gap-2 mt-2 text-slate-400 text-sm">
                          <Package size={14} />
                          <span>ขายแล้ว {(productMeta[detailProduct.id]?.sold_count ?? 0).toLocaleString()} ชิ้น</span>
                          {productMeta[detailProduct.id]?.review_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Star size={14} className="fill-amber-400 text-amber-400" />
                              {productMeta[detailProduct.id].avg_rating.toFixed(1)} ({productMeta[detailProduct.id].review_count})
                            </span>
                          )}
                        </div>
                      </div>
                      {detailProduct.description && (
                        <div>
                          <h5 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">รายละเอียด</h5>
                          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{detailProduct.description}</p>
                        </div>
                      )}
                      {getCategoryNames(detailProduct, categories).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {getCategoryNames(detailProduct, categories).map((c) => (
                            <span key={c} className="text-xs text-pink-400/90 bg-pink-950/40 px-2.5 py-1 rounded-md border border-pink-900/30">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : productModalTab === "detail" && !detailProduct ? (
                    <p className="text-slate-400 text-sm py-4">ไม่พบข้อมูลสินค้า</p>
                  ) : (
                    <div className="min-h-[200px]">
                      <ProductReviewSection
                        productId={reviewProduct.id}
                        productName={reviewProduct.name}
                        onReviewed={() => setReviewProduct(null)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      </main>
    </div>
  );
}
