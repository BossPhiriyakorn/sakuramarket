"use client";

import React, { useState, useEffect } from "react";
import {
  fetchItemShopProducts,
  createItemShopProduct as createProductApi,
  updateItemShopProduct,
  deleteItemShopProduct,
  type ItemShopProduct,
  type ItemShopCategory,
} from "@/lib/api/client";
import { Loader2, Plus, Pencil, Trash2, X, ImageUp } from "lucide-react";
import { LoadingImage } from "@/components/LoadingImage";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

const FRAME_WIDTH = 200;
const FRAME_HEIGHT = 200;

const CATEGORY_LABELS: Record<ItemShopCategory, string> = {
  frame: "กรอบตกแต่ง",
  megaphone: "ประกาศวิ่ง",
  board: "ป้ายประกาศ",
  other: "อื่นๆ",
};

type CategoryFilter = "all" | ItemShopCategory;

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "frame", label: "กรอบตกแต่ง" },
  { id: "megaphone", label: "ประกาศวิ่ง" },
  { id: "board", label: "ป้ายประกาศ" },
  { id: "other", label: "อื่นๆ" },
];

type UsageType = "per_use" | "per_day";

type BoardFormat = "text_only" | "text_link" | "text_link_logo";

const BOARD_FORMAT_OPTIONS: { value: BoardFormat; label: string }[] = [
  { value: "text_only", label: "ข้อความอย่างเดียว" },
  { value: "text_link", label: "ข้อความ + ลิงค์" },
  { value: "text_link_logo", label: "ข้อความ + ลิงค์ + โลโก้ร้าน" },
];

function usageToPriceUnit(usage_type: UsageType, usage_days: number): string {
  if (usage_type === "per_use") return "เหรียญ/ครั้ง";
  const n = Math.min(365, Math.max(1, usage_days));
  return `เหรียญ/${n} วัน`;
}

function priceUnitToUsage(price_unit: string): { usage_type: UsageType; usage_days: number } {
  if (price_unit.includes("ครั้ง")) return { usage_type: "per_use", usage_days: 1 };
  const dayMatch = price_unit.match(/(\d+)\s*วัน/);
  if (dayMatch) return { usage_type: "per_day", usage_days: Math.min(365, Math.max(1, parseInt(dayMatch[1], 10))) };
  if (price_unit.includes("สัปดาห์")) return { usage_type: "per_day", usage_days: 7 };
  if (price_unit.includes("เดือน")) return { usage_type: "per_day", usage_days: 30 };
  if (price_unit.includes("วัน")) return { usage_type: "per_day", usage_days: 1 };
  return { usage_type: "per_use", usage_days: 1 };
}

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", "cms");
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "อัปโหลดไม่สำเร็จ");
  }
  const data = await res.json();
  return (data as { url: string }).url;
}

export default function CmsProductsPage() {
  const [products, setProducts] = useState<ItemShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ItemShopProduct | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const filteredProducts =
    activeCategory === "all"
      ? products
      : products.filter((p) => p.category === activeCategory);

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchItemShopProducts();
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดรายการสินค้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const [addForm, setAddForm] = useState({
    name: "",
    category: "frame" as ItemShopCategory,
    image_url: "",
    price: 0,
    usage_type: "per_use" as UsageType,
    usage_days: 7,
    is_free: false,
    board_format: "text_link" as BoardFormat,
    dimension_width_px: FRAME_WIDTH,
    dimension_height_px: FRAME_HEIGHT,
  });
  const [addPendingFile, setAddPendingFile] = useState<File | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [editForm, setEditForm] = useState({
    name: "",
    category: "frame" as ItemShopCategory,
    image_url: "",
    price: 0,
    usage_type: "per_use" as UsageType,
    usage_days: 7,
    status: "active" as "active" | "disabled",
    is_free: false,
    board_format: "text_link" as BoardFormat,
    dimension_width_px: FRAME_WIDTH,
    dimension_height_px: FRAME_HEIGHT,
  });
  const [editPendingFile, setEditPendingFile] = useState<File | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      setError("กรุณากรอกชื่อ");
      return;
    }
    if (!addPendingFile && !addForm.image_url.trim()) {
      setError("กรุณาเลือกรูปภาพ");
      return;
    }
    setAddLoading(true);
    setError("");
    try {
      let imageUrl = addForm.image_url.trim();
      if (addPendingFile) {
        imageUrl = await uploadFile(addPendingFile);
      }
      await createProductApi({
        name: addForm.name.trim(),
        category: addForm.category,
        image_url: imageUrl,
        price: addForm.price,
        price_unit: usageToPriceUnit(addForm.usage_type, addForm.usage_days),
        board_format: (addForm.category === "board" || addForm.category === "megaphone") ? addForm.board_format : undefined,
        is_free: addForm.is_free,
        dimension_width_px: addForm.category === "frame" ? addForm.dimension_width_px : undefined,
        dimension_height_px: addForm.category === "frame" ? addForm.dimension_height_px : undefined,
      });
      setAddForm({
        name: "",
        category: "frame",
        image_url: "",
        price: 0,
        usage_type: "per_use",
        usage_days: 7,
        is_free: false,
        board_format: "text_link",
        dimension_width_px: FRAME_WIDTH,
        dimension_height_px: FRAME_HEIGHT,
      });
      setAddPendingFile(null);
      setShowAdd(false);
      await loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มสินค้าไม่สำเร็จ");
    } finally {
      setAddLoading(false);
    }
  };

  const openEdit = (product: ItemShopProduct) => {
    setEditing(product);
    setEditPendingFile(null);
    const { usage_type, usage_days } = priceUnitToUsage(product.price_unit);
    setEditForm({
      name: product.name,
      category: product.category,
      image_url: product.image_url,
      price: product.price,
      usage_type,
      usage_days,
      status: product.status,
      is_free: product.is_free === true,
      board_format: BOARD_FORMAT_OPTIONS.some((o) => o.value === product.board_format) ? (product.board_format as BoardFormat) : "text_link",
      dimension_width_px: product.dimension_width_px ?? FRAME_WIDTH,
      dimension_height_px: product.dimension_height_px ?? FRAME_HEIGHT,
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditLoading(true);
    setError("");
    try {
      let imageUrl = editForm.image_url.trim();
      if (editPendingFile) {
        imageUrl = await uploadFile(editPendingFile);
      }
      await updateItemShopProduct(editing.id, {
        name: editForm.name.trim(),
        category: editForm.category,
        image_url: imageUrl,
        price: editForm.price,
        price_unit: usageToPriceUnit(editForm.usage_type, editForm.usage_days),
        status: editForm.status,
        is_free: editForm.is_free,
        board_format: (editForm.category === "board" || editForm.category === "megaphone") ? editForm.board_format : undefined,
        dimension_width_px: editForm.category === "frame" ? editForm.dimension_width_px : undefined,
        dimension_height_px: editForm.category === "frame" ? editForm.dimension_height_px : undefined,
      });
      setEditPendingFile(null);
      setEditing(null);
      await loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async (product: ItemShopProduct) => {
    setError("");
    try {
      await updateItemShopProduct(product.id, {
        status: product.status === "active" ? "disabled" : "active",
      });
      await loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const handleDelete = async (product: ItemShopProduct) => {
    if (!confirm(`ยืนยันลบสินค้า "${product.name}"?`)) return;
    setError("");
    try {
      await deleteItemShopProduct(product.id);
      setEditing(null);
      await loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบสินค้าไม่สำเร็จ");
    }
  };

  const onAddFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAddPendingFile(file);
      setError("");
    }
    e.target.value = "";
  };

  const onEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditPendingFile(file);
      setError("");
    }
    e.target.value = "";
  };

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">สินค้า (Item Shop)</h1>
          <p className="text-slate-400 text-sm mt-1">
            จัดการสินค้าของเรา — กรอบ (ตกแต่ง) โข่ง (ประกาศสไลด์) ป้าย (ประกาศแบบครั้งเดียว) หรืออื่นๆ
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          เพิ่มสินค้า
        </button>
      </header>

      {/* ขนาดกรอบ — แสดงในหน้าให้ออกแบบถูก */}
      <div className="mb-6 rounded-xl border border-white/10 app-glass-subtle p-4">
        <h2 className="text-sm font-semibold text-pink-300 mb-2">ขนาดที่แนะนำสำหรับกรอบ (Frame)</h2>
        <p className="text-slate-300 text-sm">
          สินค้าประเภท <strong>กรอบตกแต่ง</strong> ควรออกแบบและอัปโหลดเป็นไฟล์ <strong>รูปภาพ (PNG, JPG, WebP) หรือ GIF</strong> ขนาด{" "}
          <strong className="text-pink-300">{FRAME_WIDTH} × {FRAME_HEIGHT} พิกเซล</strong> เพื่อแสดงผลได้ถูกต้อง
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* ปุ่มสลับหมวดหมู่ */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORY_TABS.map((tab) => {
          const count = tab.id === "all" ? products.length : products.filter((p) => p.category === tab.id).length;
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-pink-600 text-white"
                  : "app-glass-subtle text-slate-400 hover:text-pink-200 hover:bg-white/10 border border-white/10"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/10 app-glass-subtle overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingImage message="กำลังโหลดสินค้า..." size={64} />
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            ยังไม่มีสินค้า — กด &quot;เพิ่มสินค้า&quot; เพื่อเพิ่มรายการ
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            ยังไม่มีสินค้าในหมวดนี้
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-pink-900/30">
                  <th className="px-4 py-3 text-slate-400 font-medium text-sm w-20">รูป</th>
                  <th className="px-4 py-3 text-slate-400 font-medium text-sm">ชื่อ</th>
                  <th className="px-4 py-3 text-slate-400 font-medium text-sm">ประเภท</th>
                  <th className="px-4 py-3 text-slate-400 font-medium text-sm">ราคา</th>
                  <th className="px-4 py-3 text-slate-400 font-medium text-sm">สถานะ</th>
                  <th className="px-4 py-3 text-slate-400 font-medium text-sm text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const imgUrl = getDriveImageDisplayUrl(p.image_url);
                  return (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden">
                        {imgUrl ? (
                          <img src={imgUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-slate-500 text-[10px]">ไม่มีรูป</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{CATEGORY_LABELS[p.category]}</td>
                    <td className="px-4 py-3 text-pink-300 text-sm">
                      {p.is_free ? (
                        <span className="inline-flex px-2 py-0.5 rounded bg-green-900/40 text-green-300 text-xs font-medium">ฟรี</span>
                      ) : (
                        <>{p.price} <span className="text-slate-400">{p.price_unit}</span></>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          p.status === "active"
                            ? "bg-green-900/40 text-green-300"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {p.status === "active" ? "เปิด" : "ปิด"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p)}
                          className="p-2 rounded-lg text-slate-400 hover:text-pink-300 hover:bg-slate-700/50 transition-colors"
                          title={p.status === "active" ? "ปิดขาย" : "เปิดขาย"}
                        >
                          {p.status === "active" ? "ปิด" : "เปิด"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="p-2 rounded-lg text-slate-400 hover:text-pink-300 hover:bg-slate-700/50 transition-colors"
                          title="แก้ไข"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
                          title="ลบ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal เพิ่มสินค้า */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="rounded-xl border border-white/10 app-glass w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-pink-900/30 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">เพิ่มสินค้า</h2>
              <button type="button" onClick={() => { setAddPendingFile(null); setShowAdd(false); }} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-4 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">ประเภท</label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value as ItemShopCategory }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                >
                  {(["frame", "megaphone", "board", "other"] as const).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              {addForm.category === "frame" && (
                <p className="text-pink-200/90 text-sm bg-pink-950/30 rounded-lg px-3 py-2">
                  ขนาดที่แนะนำสำหรับกรอบ: <strong>{FRAME_WIDTH} × {FRAME_HEIGHT} px</strong> (อัปโหลดเป็นรูปหรือ GIF)
                </p>
              )}
              <div>
                <label className="block text-slate-400 text-sm mb-1">ชื่อสินค้า</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                  placeholder="กรุณากรอก"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">รูปภาพ (อัปโหลดหรือ URL)</label>
                <p className="text-slate-500 text-xs mb-2">แนะนำ: ขนาด 512×512 พิกเซล สัดส่วน 1:1 (สี่เหลี่ยมจัตุรัส) — แสดงใน Item Shop เป็นการ์ดรูปสี่เหลี่ยมจัตุรัส</p>
                <div className="flex gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm cursor-pointer hover:bg-slate-600">
                    <ImageUp size={16} />
                    {addPendingFile ? `เลือกแล้ว: ${addPendingFile.name}` : "เลือกไฟล์"}
                    <input type="file" accept="image/*,.gif" className="hidden" onChange={onAddFileSelect} disabled={addLoading} />
                  </label>
                  <input
                    type="text"
                    value={addForm.image_url}
                    onChange={(e) => setAddForm((f) => ({ ...f, image_url: e.target.value }))}
                    className="flex-1 rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                    placeholder="กรุณากรอก (หากมี)"
                  />
                </div>
                {addForm.image_url && (
                  <div className="mt-2 w-16 h-16 rounded bg-slate-800 overflow-hidden">
                    <img src={getDriveImageDisplayUrl(addForm.image_url)} alt="" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">ราคา (เหรียญ)</label>
                <input
                  type="number"
                  min={0}
                  value={addForm.price || ""}
                  onChange={(e) => setAddForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">การใช้งาน</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="add-usage"
                      checked={addForm.usage_type === "per_use"}
                      onChange={() => setAddForm((f) => ({ ...f, usage_type: "per_use" }))}
                      className="text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-slate-300 text-sm">ใช้ต่อครั้ง</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="add-usage"
                      checked={addForm.usage_type === "per_day"}
                      onChange={() => setAddForm((f) => ({ ...f, usage_type: "per_day" }))}
                      className="text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-slate-300 text-sm">ใช้ต่อวัน (เลือกจำนวนวัน)</span>
                    {addForm.usage_type === "per_day" && (
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={addForm.usage_days}
                        onChange={(e) => setAddForm((f) => ({ ...f, usage_days: Math.min(365, Math.max(1, Number(e.target.value) || 1)) }))}
                        className="w-20 rounded border border-pink-900/30 bg-slate-800 text-white px-2 py-1 text-sm ml-2"
                      />
                    )}
                    {addForm.usage_type === "per_day" && (
                      <span className="text-slate-500 text-xs">วัน</span>
                    )}
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.is_free}
                  onChange={(e) => setAddForm((f) => ({ ...f, is_free: e.target.checked }))}
                  className="rounded border-pink-900/50 bg-slate-800 text-pink-500 focus:ring-pink-500"
                />
                <span className="text-slate-300 text-sm">ติ๊กฟรี — รับได้โดยไม่เสียเหรียญ (ใช้ได้กับสินค้าทั้งหมดของเรา)</span>
              </label>
              {(addForm.category === "board" || addForm.category === "megaphone") && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">รูปแบบป้ายประกาศ</label>
                  <select
                    value={addForm.board_format}
                    onChange={(e) => setAddForm((f) => ({ ...f, board_format: e.target.value as BoardFormat }))}
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                  >
                    {BOARD_FORMAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setAddPendingFile(null); setShowAdd(false); }} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-700">
                  ยกเลิก
                </button>
                <button type="submit" disabled={addLoading} className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white disabled:opacity-50 flex items-center gap-2">
                  {addLoading && <Loader2 size={16} className="animate-spin" />}
                  เพิ่มสินค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal แก้ไข */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="rounded-xl border border-white/10 app-glass w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-pink-900/30 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">แก้ไขสินค้า</h2>
              <button type="button" onClick={() => setEditing(null)} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-4 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">ประเภท</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value as ItemShopCategory }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                >
                  {(["frame", "megaphone", "board", "other"] as const).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              {editForm.category === "frame" && (
                <p className="text-pink-200/90 text-sm bg-pink-950/30 rounded-lg px-3 py-2">
                  ขนาดที่แนะนำสำหรับกรอบ: <strong>{FRAME_WIDTH} × {FRAME_HEIGHT} px</strong> (อัปโหลดเป็นรูปหรือ GIF)
                </p>
              )}
              <div>
                <label className="block text-slate-400 text-sm mb-1">ชื่อสินค้า</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                  placeholder="กรุณากรอก"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">รูปภาพ</label>
                <p className="text-slate-500 text-xs mb-2">แนะนำ: ขนาด 512×512 พิกเซล สัดส่วน 1:1 (สี่เหลี่ยมจัตุรัส)</p>
                <div className="flex gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm cursor-pointer hover:bg-slate-600">
                    <ImageUp size={16} />
                    {editPendingFile ? `เลือกแล้ว: ${editPendingFile.name}` : "เปลี่ยนรูป"}
                    <input type="file" accept="image/*,.gif" className="hidden" onChange={onEditFileSelect} disabled={editLoading} />
                  </label>
                  <input
                    type="text"
                    value={editForm.image_url}
                    onChange={(e) => setEditForm((f) => ({ ...f, image_url: e.target.value }))}
                    className="flex-1 rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                    placeholder="กรุณากรอก (หากมี)"
                  />
                </div>
                {editForm.image_url && (
                  <div className="mt-2 w-16 h-16 rounded bg-slate-800 overflow-hidden">
                    <img src={getDriveImageDisplayUrl(editForm.image_url)} alt="" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">ราคา (เหรียญ)</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.price || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">การใช้งาน</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-usage"
                      checked={editForm.usage_type === "per_use"}
                      onChange={() => setEditForm((f) => ({ ...f, usage_type: "per_use" }))}
                      className="text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-slate-300 text-sm">ใช้ต่อครั้ง</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-usage"
                      checked={editForm.usage_type === "per_day"}
                      onChange={() => setEditForm((f) => ({ ...f, usage_type: "per_day" }))}
                      className="text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-slate-300 text-sm">ใช้ต่อวัน (เลือกจำนวนวัน)</span>
                    {editForm.usage_type === "per_day" && (
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={editForm.usage_days}
                        onChange={(e) => setEditForm((f) => ({ ...f, usage_days: Math.min(365, Math.max(1, Number(e.target.value) || 1)) }))}
                        className="w-20 rounded border border-pink-900/30 bg-slate-800 text-white px-2 py-1 text-sm ml-2"
                      />
                    )}
                    {editForm.usage_type === "per_day" && (
                      <span className="text-slate-500 text-xs">วัน</span>
                    )}
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_free}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_free: e.target.checked }))}
                  className="rounded border-pink-900/50 bg-slate-800 text-pink-500 focus:ring-pink-500"
                />
                <span className="text-slate-300 text-sm">ติ๊กฟรี — รับได้โดยไม่เสียเหรียญ (ใช้ได้กับสินค้าทั้งหมดของเรา)</span>
              </label>
              {(editForm.category === "board" || editForm.category === "megaphone") && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">รูปแบบป้ายประกาศ</label>
                  <select
                    value={editForm.board_format}
                    onChange={(e) => setEditForm((f) => ({ ...f, board_format: e.target.value as BoardFormat }))}
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                  >
                    {BOARD_FORMAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-slate-400 text-sm mb-1">สถานะ</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as "active" | "disabled" }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                >
                  <option value="active">เปิดขาย</option>
                  <option value="disabled">ปิดขาย</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-700">
                  ยกเลิก
                </button>
                <button type="submit" disabled={editLoading} className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white disabled:opacity-50 flex items-center gap-2">
                  {editLoading && <Loader2 size={16} className="animate-spin" />}
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
