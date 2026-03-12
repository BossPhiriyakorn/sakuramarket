"use client";

import React from "react";
import { Star, Package } from "lucide-react";
import type { ManageProduct, ManageCategory } from "@/types/manageShop";
import { getCategoryNames } from "@/lib/getCategoryNames";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

type ProductMeta = { avg_rating: number; review_count: number; sold_count: number };

export interface ProductGridProps {
  products: ManageProduct[];
  categories: ManageCategory[];
  emptyMessage?: string;
  productMeta?: Record<string, ProductMeta>;
  /** คลิกการ์ดเพื่อเปิดป๊อปอัปรายละเอียด (ฝั่งเจ้าของร้าน) */
  onProductClick?: (productId: string) => void;
}

export function ProductGrid({
  products,
  categories,
  emptyMessage = "ยังไม่มีสินค้า — เพิ่มได้ในหน้า จัดการสินค้า",
  productMeta = {},
  onProductClick,
}: ProductGridProps) {
  return (
    <section className="min-w-0">
      <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3">
        รายการสินค้าที่จัดแสดง
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 min-w-0">
        {products.map((p) => {
          const catNames = getCategoryNames(p, categories);
          const meta = productMeta[p.id];
          return (
            <div
              key={p.id}
              role={onProductClick ? "button" : undefined}
              tabIndex={onProductClick ? 0 : undefined}
              onClick={onProductClick ? () => onProductClick(p.id) : undefined}
              onKeyDown={onProductClick ? (e) => e.key === "Enter" && onProductClick(p.id) : undefined}
              className={`rounded-2xl overflow-hidden flex flex-col border border-pink-900/25 bg-slate-900/70 backdrop-blur-sm shadow-lg sm:bg-slate-900/60 sm:border-pink-900/20 sm:rounded-xl flex-1 min-w-0 ${onProductClick ? "cursor-pointer hover:border-pink-800/40 active:scale-[0.99] transition-transform" : ""}`}
            >
              <div className="aspect-square w-full bg-slate-800/80 relative shrink-0 overflow-hidden">
                {(() => {
                  const displayUrl = getDriveImageDisplayUrl(p.image_url);
                  return displayUrl ? (
                    <img
                      src={displayUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                      <Package size={24} />
                    </div>
                  );
                })()}
              </div>
              <div className="p-3 flex-1 flex flex-col min-h-0 min-w-0">
                <div className="font-semibold text-white truncate text-sm leading-tight">
                  {p.name}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-pink-400 font-semibold text-sm">{p.price} เหรียญ</span>
                  <span className="text-slate-400 text-xs">
                    ขายแล้ว {(meta?.sold_count ?? 0).toLocaleString()}
                  </span>
                </div>
                {meta && meta.review_count > 0 && (
                  <div className="flex items-center gap-1 mt-1.5">
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} size={12} className={i <= Math.round(meta.avg_rating) ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
                    ))}
                    <span className="text-amber-400 text-xs font-medium">{meta.avg_rating.toFixed(1)}</span>
                    <span className="text-slate-400 text-xs">({meta.review_count})</span>
                  </div>
                )}
                <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 flex-1 leading-relaxed min-w-0">
                  {p.description}
                </p>
                {catNames.length > 0 && (
                  <span className="inline-block mt-2 text-xs text-pink-400/90 bg-pink-950/40 px-2.5 py-1 rounded-md w-fit border border-pink-900/30 truncate max-w-full">
                    {catNames.join(", ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {products.length === 0 && (
        <p className="text-pink-400/60 text-sm py-8 text-center col-span-full">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
