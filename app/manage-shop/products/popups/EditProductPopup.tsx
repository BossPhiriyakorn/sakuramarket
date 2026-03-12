"use client";

import React, { useState } from "react";
import { X, Upload } from "lucide-react";
import type { ManageProduct, ManageCategory } from "@/types/manageShop";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

const ALL_CATEGORY_ID = "cat-all"; // หมวดสินค้าทั้งหมด — เลือกไว้เสมอ เอาออกไม่ได้

export interface EditProductPopupProps {
  product: ManageProduct;
  categories: ManageCategory[];
  onClose: () => void;
  onSave: (updates: Partial<ManageProduct>) => void | Promise<void>;
}

export function EditProductPopup({
  product,
  categories,
  onClose,
  onSave,
}: EditProductPopupProps) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [stockQuantity, setStockQuantity] = useState(String(product.stock_quantity ?? 0));
  const [description, setDescription] = useState(product.description);
  const [imageUrl, setImageUrl] = useState(product.image_url);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>(() => {
    const ids = Array.isArray(product.category_ids) ? [...product.category_ids] : [];
    return ids.includes(ALL_CATEGORY_ID) ? ids : [ALL_CATEGORY_ID, ...ids];
  });
  const [recommended, setRecommended] = useState(!!product.recommended);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    if (id === ALL_CATEGORY_ID) return; // หมวดสินค้าทั้งหมด เอาออกไม่ได้
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageUrl(URL.createObjectURL(file));
      setPendingImageFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      let finalImageUrl = imageUrl && !imageUrl.startsWith("blob:") ? imageUrl : product.image_url;
      if (pendingImageFile) {
        const form = new FormData();
        form.append("file", pendingImageFile);
        form.append("folder", "shops");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error || "อัปโหลดรูปไม่สำเร็จ");
        finalImageUrl = (data as { url: string }).url;
      }
      await onSave({
        name,
        price: Number(price) || 0,
        stock_quantity: Math.max(0, Math.floor(Number(stockQuantity) || 0)),
        description,
        image_url: finalImageUrl,
        category_ids: categoryIds.includes(ALL_CATEGORY_ID) ? categoryIds : [ALL_CATEGORY_ID, ...categoryIds],
        recommended,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md max-h-[90vh] bg-slate-950 border border-pink-900/50 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-pink-900/30 shrink-0">
          <h2 className="text-lg font-bold text-white">จัดการสินค้า</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-pink-400 hover:bg-pink-950/30 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {/* รูป — เฉพาะอัพโหลด ไม่แสดงช่อง URL */}
          <div>
            <label className="block text-sm text-pink-300/80 mb-2">รูปสินค้า</label>
            <div className="flex flex-col items-center gap-3">
              <div className="w-48 h-48 rounded-xl bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                {imageUrl && imageUrl.trim() ? (
                  <img
                    src={getDriveImageDisplayUrl(imageUrl)}
                    alt="รูปสินค้า"
                    className="w-full h-full object-contain object-center"
                  />
                ) : (
                  <span className="text-slate-500 text-sm">ยังไม่มีรูป</span>
                )}
              </div>
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-pink-900/40 bg-slate-900/50 cursor-pointer hover:border-pink-500/50 text-sm text-pink-400">
                <Upload size={16} />
                อัพโหลดรูป
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            </div>
          </div>

          {/* ชื่อ */}
          <div>
            <label className="block text-sm text-pink-300/80 mb-2">ชื่อสินค้า</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-pink-900/30 text-white focus:outline-none focus:border-pink-500/50"
              placeholder="กรุณากรอก"
            />
          </div>

          {/* ราคา */}
          <div>
            <label className="block text-sm text-pink-300/80 mb-2">ราคา (เหรียญ)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-pink-900/30 text-white focus:outline-none focus:border-pink-500/50"
              placeholder="กรุณากรอก"
            />
          </div>

          {/* จำนวนในคลัง */}
          <div>
            <label className="block text-sm text-pink-300/80 mb-2">จำนวนสินค้าในคลัง</label>
            <input
              type="number"
              min={0}
              step={1}
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-pink-900/30 text-white focus:outline-none focus:border-pink-500/50"
              placeholder="0"
            />
          </div>

          {/* รายละเอียด */}
          <div>
            <label className="block text-sm text-pink-300/80 mb-2">รายละเอียด</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-pink-900/30 text-white focus:outline-none focus:border-pink-500/50 resize-y"
              placeholder="กรุณากรอก (หากมี)"
            />
          </div>

          {/* หมวดหมู่ — ติ๊กถูกได้หลายหมวด */}
          <div>
            <label className="block text-sm text-pink-300/80 mb-2">
              หมวดหมู่ (เลือกได้หลายหมวด)
            </label>
            <div className="flex flex-wrap gap-3">
              {categories.map((c) => {
                const isAllCategory = c.id === ALL_CATEGORY_ID;
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border transition-colors ${
                      isAllCategory
                        ? "cursor-default border-pink-900/30 opacity-90"
                        : "cursor-pointer border-pink-900/20 hover:border-pink-500/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                      disabled={isAllCategory}
                      className="w-4 h-4 rounded border-pink-500/50 bg-slate-900 text-pink-500 focus:ring-pink-500 disabled:opacity-80"
                    />
                    <span className="text-sm text-white">{c.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* สินค้าแนะนำ */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recommended"
              checked={recommended}
              onChange={(e) => setRecommended(e.target.checked)}
              className="w-4 h-4 rounded border-pink-500/50 bg-slate-900 text-pink-500 focus:ring-pink-500"
            />
            <label htmlFor="recommended" className="text-sm text-slate-300">
              แสดงในแถวสินค้าแนะนำ
            </label>
          </div>

          {submitError && (
            <p className="text-red-400 text-sm">{submitError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-lg border border-pink-900/30 text-pink-400 hover:bg-pink-950/20 font-medium disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium disabled:opacity-50"
            >
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
