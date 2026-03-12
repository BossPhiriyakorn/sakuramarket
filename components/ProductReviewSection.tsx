"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Star, Package } from "lucide-react";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

type Review = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  display_name?: string;
  avatar_url?: string;
};

type ProductMeta = {
  avg_rating: number;
  review_count: number;
  sold_count: number;
};

const StarRow = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <span className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={size}
        className={i <= rating ? "fill-amber-400 text-amber-400" : "text-slate-600"}
      />
    ))}
  </span>
);

const StarPicker = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((i) => (
      <button
        key={i}
        type="button"
        onClick={() => onChange(i)}
        className="p-0.5 rounded hover:bg-slate-700/50 transition-colors"
        aria-label={`ให้ ${i} ดาว`}
      >
        <Star
          size={26}
          className={i <= value ? "fill-amber-400 text-amber-400" : "text-slate-500"}
        />
      </button>
    ))}
  </div>
);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

export interface ProductReviewSectionProps {
  productId: string;
  productName: string;
  /** order_item_id ที่รับแล้วและยังไม่รีวิว (ถ้ามี จะแสดงฟอร์ม) */
  pendingOrderItemId?: string | null;
  /** callback เมื่อรีวิวสำเร็จ */
  onReviewed?: () => void;
}

export function ProductReviewSection({
  productId,
  productName,
  pendingOrderItemId,
  onReviewed,
}: ProductReviewSectionProps) {
  const [meta, setMeta] = useState<ProductMeta>({ avg_rating: 0, review_count: 0, sold_count: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data/products/${productId}/reviews`, { cache: "no-store" });
      const data = await res.json();
      setMeta({
        avg_rating: Number(data.avg_rating ?? 0),
        review_count: Number(data.review_count ?? 0),
        sold_count: Number(data.sold_count ?? 0),
      });
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!pendingOrderItemId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/data/me/product-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, order_item_id: pendingOrderItemId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่งรีวิวไม่สำเร็จ");
      setSubmitted(true);
      setComment("");
      setRating(5);
      load();
      onReviewed?.();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "ส่งรีวิวไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* สรุปดาว + sold */}
      <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-slate-800/50 border border-pink-900/20">
        <div className="flex items-center gap-1.5">
          <StarRow rating={Math.round(meta.avg_rating)} size={16} />
          <span className="text-amber-400 font-semibold text-sm">
            {meta.avg_rating > 0 ? meta.avg_rating.toFixed(1) : "—"}
          </span>
          <span className="text-slate-400 text-xs">({meta.review_count} รีวิว)</span>
        </div>
        {meta.sold_count > 0 && (
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <Package size={13} />
            <span>ขายแล้ว {meta.sold_count.toLocaleString()} ชิ้น</span>
          </div>
        )}
      </div>

      {/* ฟอร์มรีวิว — แสดงเฉพาะเมื่อมี pendingOrderItemId */}
      {pendingOrderItemId && !submitted && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20">
          <p className="text-amber-300 text-xs font-medium mb-3">
            คุณได้รับ <span className="text-white">{productName}</span> แล้ว — แชร์ประสบการณ์ให้คนอื่นด้วย
          </p>
          <StarPicker value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="เขียนรีวิวสินค้า..."
            rows={3}
            className="w-full mt-3 px-3 py-2 rounded-lg bg-slate-800 border border-pink-900/30 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-pink-500/50 resize-y"
          />
          {submitError && <p className="text-red-400 text-xs mt-1">{submitError}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {submitting ? "กำลังส่ง..." : "ส่งรีวิว"}
          </button>
        </div>
      )}
      {submitted && (
        <p className="text-green-400 text-sm px-3 py-2 rounded-lg bg-green-900/20 border border-green-500/30">
          ขอบคุณสำหรับรีวิว!
        </p>
      )}

      {/* รายการรีวิว */}
      {loading ? (
        <p className="text-slate-500 text-xs text-center py-4">กำลังโหลด...</p>
      ) : reviews.length === 0 ? (
        <p className="text-slate-500 text-xs text-center py-4">ยังไม่มีรีวิวสินค้านี้</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="p-3 rounded-xl bg-slate-900/50 border border-pink-900/20">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <div className="flex items-center gap-2">
                  {r.avatar_url ? (
                    <img src={getDriveImageDisplayUrl(r.avatar_url)} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(r.display_name ?? "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-slate-300 text-xs">{r.display_name ?? "ผู้ใช้"}</span>
                </div>
                <span className="text-slate-500 text-xs">{formatDate(r.created_at)}</span>
              </div>
              <StarRow rating={r.rating} size={13} />
              {r.comment && (
                <p className="text-slate-300 text-xs mt-1.5 whitespace-pre-wrap">{r.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
