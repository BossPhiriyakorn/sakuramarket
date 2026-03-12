"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Star, Package } from "lucide-react";
import { useManageShopStore } from "@/store/manageShopStore";
import { ManageShopHeader } from "./components/ManageShopHeader";
import { ShopCoverSection } from "./components/ShopCoverSection";
import { RecommendedProducts } from "./components/RecommendedProducts";
import { ProductGrid } from "./components/ProductGrid";
import { ProductReviewSection } from "@/components/ProductReviewSection";
import { getCategoryNames } from "@/lib/getCategoryNames";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";
import { fetchMyShop } from "@/lib/api/client";

export default function ManageShopPage() {
  const {
    shopName,
    logoUrl,
    coverUrl,
    logoBackgroundColor,
    products,
    categories,
    setShopName,
    setLogoUrl,
    setCoverUrl,
    setLogoBackgroundColor,
    setProducts,
    setCategories,
  } = useManageShopStore();

  const [productMeta, setProductMeta] = useState<Record<string, { avg_rating: number; review_count: number; sold_count: number }>>({});
  const [myShop, setMyShop] = useState<{ id: string; verification_status: string; shop_name: string; parcel_id?: string | null } | null>(null);
  const [walletLinked, setWalletLinked] = useState<boolean | undefined>(undefined);
  const [detailProduct, setDetailProduct] = useState<{ id: string; name: string } | null>(null);
  const [productModalTab, setProductModalTab] = useState<"detail" | "reviews">("detail");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchMyShop(),
      fetch("/api/data/me/shop/products").then(r => r.json()).catch(() => ({})),
      fetch("/api/data/me/shop/categories").then(r => r.json()).catch(() => ({})),
    ])
      .then(([res, productsData, categoriesData]) => {
        if (cancelled) return;
        if (res.shop) setMyShop(res.shop);
        setWalletLinked(typeof res.wallet_linked === "boolean" ? res.wallet_linked : undefined);
        // เติม store จาก API เพื่อให้รูป/ชื่อร้านแสดงหลังรีเฟรชหรือรีสตาร์ทเซิร์ฟเวอร์
        const shop = res.shop as { shop_name?: string; logo_url?: string | null; logo_background_color?: string | null } | null;
        const reg = res.registration as { shop_name?: string; logo_url?: string | null; cover_url?: string | null; logo_background_color?: string | null } | null;
        if (shop?.shop_name) setShopName(shop.shop_name);
        if (shop?.logo_url != null) setLogoUrl(shop.logo_url ?? null);
        if (shop?.logo_background_color) setLogoBackgroundColor(shop.logo_background_color ?? "#ec4899");
        if (reg) {
          if (reg.shop_name && !shop?.shop_name) setShopName(reg.shop_name);
          if (reg.logo_url != null && shop?.logo_url == null) setLogoUrl(reg.logo_url ?? null);
          if (reg.cover_url != null) setCoverUrl(reg.cover_url ?? null);
          if (reg.logo_background_color && !shop?.logo_background_color) setLogoBackgroundColor(reg.logo_background_color ?? "#ec4899");
        }

        const list = Array.isArray(productsData.products) ? productsData.products.map((p: { id?: string; name?: string; price?: number; description?: string; image_url?: string; category_ids?: unknown[]; recommended?: boolean }) => ({
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          price: Number(p.price ?? 0),
          description: String(p.description ?? ""),
          image_url: String(p.image_url ?? ""),
          category_ids: Array.isArray(p.category_ids) ? (p.category_ids as string[]) : [],
          recommended: Boolean(p.recommended),
        })) : [];
        setProducts(list);

        const meta: Record<string, { avg_rating: number; review_count: number; sold_count: number }> = {};
        for (const p of Array.isArray(productsData.products) ? productsData.products : []) {
          const id = String((p as { id?: string }).id ?? "");
          if (id) meta[id] = { avg_rating: Number((p as { avg_rating?: number }).avg_rating ?? 0), review_count: Number((p as { review_count?: number }).review_count ?? 0), sold_count: Number((p as { sold_count?: number }).sold_count ?? 0) };
        }
        setProductMeta(meta);

        const catList = Array.isArray(categoriesData.categories) ? categoriesData.categories.map((c: { id?: string; name?: string }) => ({
          id: String(c.id ?? ""),
          name: String(c.name ?? ""),
        })) : [];
        setCategories(catList);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [setShopName, setLogoUrl, setCoverUrl, setLogoBackgroundColor, setProducts, setCategories]);

  const recommended = products.filter((p) => p.recommended);

  useEffect(() => {
    if (detailProduct) setProductModalTab("detail");
  }, [detailProduct?.id]);

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />
      <div className="relative z-10 flex flex-col flex-1 min-w-0">
      <ManageShopHeader />

      <main className="w-full max-w-4xl mx-auto p-4 md:p-6 space-y-6 overflow-x-hidden min-w-0">
        <h1 className="text-xl font-bold text-white">จัดการร้านค้า</h1>
        <ShopCoverSection
          shopName={shopName}
          logoUrl={logoUrl}
          coverUrl={coverUrl}
          logoBackgroundColor={logoBackgroundColor}
          readOnly
          verificationStatus={myShop?.verification_status}
          walletLinked={walletLinked}
        />

        <RecommendedProducts
          products={recommended}
          categories={categories}
          productMeta={productMeta}
          onProductClick={(id) => {
            const pr = products.find((p) => p.id === id);
            setDetailProduct(pr ? { id: pr.id, name: pr.name } : null);
          }}
        />

        <ProductGrid
          products={products}
          categories={categories}
          productMeta={productMeta}
          onProductClick={(id) => {
            const pr = products.find((p) => p.id === id);
            setDetailProduct(pr ? { id: pr.id, name: pr.name } : null);
          }}
        />
      </main>

      {/* Modal รายละเอียดสินค้า (เหมือนฝั่งผู้ใช้) + ปุ่มไปจัดการสินค้า */}
      {detailProduct && (() => {
        const product = products.find((p) => p.id === detailProduct.id);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={() => { setDetailProduct(null); setProductModalTab("detail"); }}
          >
            <div
              className="rounded-xl border border-pink-900/30 bg-slate-900 shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex items-center justify-between p-4 border-b border-pink-900/30 shrink-0">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2 truncate pr-10">
                  <Star size={16} className="text-amber-400 fill-amber-400 shrink-0" />
                  {detailProduct.name || "รายละเอียดสินค้า"}
                </h3>
                <button
                  type="button"
                  onClick={() => { setDetailProduct(null); setProductModalTab("detail"); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="flex border-b border-pink-900/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setProductModalTab("detail")}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${productModalTab === "detail" ? "text-pink-300 border-b-2 border-pink-500 bg-pink-950/30" : "text-slate-400 hover:text-slate-200"}`}
                >
                  รายละเอียด
                </button>
                <button
                  type="button"
                  onClick={() => setProductModalTab("reviews")}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${productModalTab === "reviews" ? "text-pink-300 border-b-2 border-pink-500 bg-pink-950/30" : "text-slate-400 hover:text-slate-200"}`}
                >
                  รีวิว
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                {productModalTab === "detail" && product ? (
                  <div className="space-y-4">
                    <div className="rounded-xl overflow-hidden bg-slate-800/80 aspect-square max-w-[280px] mx-auto">
                      {product.image_url ? (
                        <img src={getDriveImageDisplayUrl(product.image_url)} alt="" className="w-full h-full object-cover object-center" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">ไม่มีรูป</div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-base">{product.name}</h4>
                      <p className="text-pink-400 font-semibold text-lg mt-1">{product.price} เหรียญ</p>
                      <div className="flex items-center gap-2 mt-2 text-slate-400 text-sm">
                        <Package size={14} />
                        <span>ขายแล้ว {(productMeta[product.id]?.sold_count ?? 0).toLocaleString()} ชิ้น</span>
                        {productMeta[product.id]?.review_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Star size={14} className="fill-amber-400 text-amber-400" />
                            {productMeta[product.id].avg_rating.toFixed(1)} ({productMeta[product.id].review_count})
                          </span>
                        )}
                      </div>
                    </div>
                    {product.description && (
                      <div>
                        <h5 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">รายละเอียด</h5>
                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{product.description}</p>
                      </div>
                    )}
                    {getCategoryNames(product, categories).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {getCategoryNames(product, categories).map((c) => (
                          <span key={c} className="text-xs text-pink-400/90 bg-pink-950/40 px-2.5 py-1 rounded-md border border-pink-900/30">{c}</span>
                        ))}
                      </div>
                    )}
                    <Link
                      href="/manage-shop/products"
                      className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium mt-4"
                    >
                      ไปจัดการสินค้า
                    </Link>
                  </div>
                ) : productModalTab === "detail" && !product ? (
                  <p className="text-slate-400 text-sm py-4">ไม่พบข้อมูลสินค้า</p>
                ) : (
                  <div className="min-h-[200px]">
                    <ProductReviewSection productId={detailProduct.id} productName={detailProduct.name} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      </div>
    </div>
  );
}
