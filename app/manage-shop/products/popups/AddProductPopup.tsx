"use client";

import React, { useState, useEffect } from "react";
import { X, Upload } from "lucide-react";
import type { ManageProduct, ManageCategory } from "@/types/manageShop";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

const ALL_CATEGORY_ID = "cat-all";

export interface AddProductPopupProps {
  open: boolean;
  categories: ManageCategory[];
  onClose: () => void;
  onAdd: (data: Omit<ManageProduct, "id">) => void | Promise<void>;
}

const defaultImageUrl = "";

function resetFormState(
  setName: (v: string) => void,
  setPrice: (v: string) => void,
  setStockQuantity: (v: string) => void,
  setDescription: (v: string) => void,
  setImageUrl: (v: string) => void,
  setCategoryIds: (v: string[]) => void,
  setRecommended: (v: boolean) => void,
  setPendingImageFile: (v: File | null) => void,
  setSubmitError: (v: string | null) => void
) {
  setName("");
  setPrice("");
  setStockQuantity("0");
  setDescription("");
  setImageUrl(defaultImageUrl);
  setCategoryIds([ALL_CATEGORY_ID]);
  setRecommended(false);
  setPendingImageFile(null);
  setSubmitError(null);
}

export function AddProductPopup({
  open,
  categories,
  onClose,
  onAdd,
}: AddProductPopupProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState(defaultImageUrl);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>([ALL_CATEGORY_ID]);
  const [recommended, setRecommended] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      resetFormState(setName, setPrice, setStockQuantity, setDescription, setImageUrl, setCategoryIds, setRecommended, setPendingImageFile, setSubmitError);
    }
  }, [open]);

  const toggleCategory = (id: string) => {
    if (id === ALL_CATEGORY_ID) return;
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
      let finalImageUrl = imageUrl && !imageUrl.startsWith("blob:") ? imageUrl : defaultImageUrl;
      if (pendingImageFile) {
        const form = new FormData();
        form.append("file", pendingImageFile);
        form.append("folder", "shops");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error || "อัปโหลดรูปไม่สำเร็จ");
        finalImageUrl = (data as { url: string }).url;
      }
      await onAdd({
        name: name.trim() || "สินค้าใหม่",
        price: Number(price) || 0,
        stock_quantity: Math.max(0, Math.floor(Number(stockQuantity) || 0)),
        description: description.trim(),
        image_url: finalImageUrl,
        category_ids: categoryIds.includes(ALL_CATEGORY_ID) ? categoryIds : [ALL_CATEGORY_ID, ...categoryIds],
        recommended,
      });
      resetFormState(setName, setPrice, setStockQuantity, setDescription, setImageUrl, setCategoryIds, setRecommended, setPendingImageFile, setSubmitError);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md max-h-[90vh] bg-slate-950 border border-pink-900/50 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-pink-900/30 shrink-0">
          <h2 className="text-lg font-bold text-white">เพิ่มสินค้า</h2>
          <button
            type="button"
            onClick={handleClose}
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

          {/* หมวดหมู่ */}
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
              id="add-recommended"
              checked={recommended}
              onChange={(e) => setRecommended(e.target.checked)}
              className="w-4 h-4 rounded border-pink-500/50 bg-slate-900 text-pink-500 focus:ring-pink-500"
            />
            <label htmlFor="add-recommended" className="text-sm text-slate-300">
              แสดงในแถวสินค้าแนะนำ
            </label>
          </div>

          {submitError && (
            <p className="text-red-400 text-sm">{submitError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
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
              {submitting ? "กำลังบันทึก..." : "เพิ่มสินค้า"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
