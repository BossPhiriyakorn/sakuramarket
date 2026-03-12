"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Package,
  Plus,
  Trash2,
  Upload,
  Store,
  MessageCircle,
  Tag,
  Settings,
  Pencil,
  X,
  Eye,
  EyeOff,
  Star,
  Shield,
  MapPin,
  Lock,
  ImageUp,
  Loader2,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";
import type { ManageProduct, ManageCategory } from "@/types/manageShop";
import { useManageShopStore } from "@/store/manageShopStore";
import { getCategoryNames } from "@/lib/getCategoryNames";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { LogoBackgroundColorPicker } from "@/components/LogoBackgroundColorPicker";
import { ProductReviewSection } from "@/components/ProductReviewSection";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { BookLockModal } from "@/components/BookLockModal";
import { submitShopVerification } from "@/lib/api/client";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";
import { EditProductPopup } from "./popups/EditProductPopup";
import { AddProductPopup } from "./popups/AddProductPopup";
import { AddCategoryPopup } from "./popups/AddCategoryPopup";

const ALL_CATEGORY_ID = "cat-all";

const CONTACT_CHANNEL_TYPES = [
  { type: "line", label: "LINE" },
  { type: "phone", label: "โทร" },
  { type: "website", label: "เว็บไซต์" },
  { type: "facebook", label: "เฟสบุค" },
  { type: "instagram", label: "ไอจี" },
] as const;

function toManageProduct(p: Record<string, unknown>): ManageProduct {
  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    price: Number(p.price ?? 0),
    description: String(p.description ?? ""),
    image_url: String(p.image_url ?? ""),
    category_ids: Array.isArray(p.category_ids) ? (p.category_ids as string[]) : [],
    recommended: Boolean(p.recommended),
    stock_quantity: typeof p.stock_quantity === "number" ? p.stock_quantity : Number(p.stock_quantity) || 0,
    status: typeof p.status === "string" ? p.status : "active",
  };
}

function toManageCategory(c: Record<string, unknown>): ManageCategory {
  return { id: String(c.id ?? ""), name: String(c.name ?? "") };
}

type TabId = "products" | "settings";

export default function ManageShopProductsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("products");
  const [showAddCategoryPopup, setShowAddCategoryPopup] = useState(false);
  const [showAddProductPopup, setShowAddProductPopup] = useState(false);
  const [editProduct, setEditProduct] = useState<ManageProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  const {
    shopName,
    setShopName,
    shopDescription,
    setShopDescription,
    logoUrl,
    setLogoUrl,
    logoBackgroundColor,
    setLogoBackgroundColor,
    coverUrl,
    setCoverUrl,
    marketDisplayUrl,
    setMarketDisplayUrl,
    products,
    setProducts,
    deleteProduct,
    updateProduct,
    addProduct: _addProduct,
    setCategories,
    categories,
    addCategory: _addCategory,
    contactChannels,
    setContactChannels,
  } = useManageShopStore();

  const [productMeta, setProductMeta] = useState<Record<string, { avg_rating: number; review_count: number; sold_count: number }>>({});
  const [reviewModal, setReviewModal] = useState<{ id: string; name: string } | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [settingsSaveOk, setSettingsSaveOk] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [pendingMarketFile, setPendingMarketFile] = useState<File | null>(null);
  const [hasShop, setHasShop] = useState(false);
  const [hasParcel, setHasParcel] = useState(true); // มีที่จองบนแผนที่หรือยัง (ร้านแบบร่าง = ยังไม่มี)
  // ล็อคในแผนที่ + ยืนยันร้านค้า (อยู่ในส่วนจัดการ)
  const [lockLabels, setLockLabels] = useState<string[]>([]);
  const [myShop, setMyShop] = useState<{ id: string; verification_status: string; shop_name?: string; parcel_id?: string | null } | null>(null);
  const [myRegistration, setMyRegistration] = useState<{ id: string } | null>(null);
  const [_userVerified, setUserVerified] = useState(false);
  const [hasPackage, setHasPackage] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentPendingFile, setDocumentPendingFile] = useState<File | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [bookLockModalOpen, setBookLockModalOpen] = useState(false);
  const [refreshShopKey, setRefreshShopKey] = useState(0);
  const [maxProductsVisible, setMaxProductsVisible] = useState<number | null>(null);
  const [mapExpansionLimit, setMapExpansionLimit] = useState<number | null>(null);
  const [mapExpansionsUsed, setMapExpansionsUsed] = useState(0);
  // กรอง/ค้นหา/มุมมอง รายการสินค้า
  const [productFilter, setProductFilter] = useState<string>("all"); // "all" | "recommended" | "hidden" | categoryId
  const [productSearch, setProductSearch] = useState("");
  const [productViewMode, setProductViewMode] = useState<"grid" | "table">("grid");

  const fetchProductsAndCategories = useCallback(async () => {
    setError(null);
    try {
      const [shopRes, productsRes, categoriesRes, contactsRes, verificationRes] = await Promise.all([
        fetch("/api/data/me/shop"),
        fetch("/api/data/me/shop/products"),
        fetch("/api/data/me/shop/categories"),
        fetch("/api/data/me/shop/contacts"),
        fetch("/api/data/me/verification"),
      ]);
      const shopData = await shopRes.json();
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();
      const contactsData = await contactsRes.json().catch(() => ({}));
      const verificationData = await verificationRes.json().catch(() => ({ verified: false }));
      const shop = shopData.shop;
      setHasShop(!!shop);
      setHasParcel(!!(shop && (shop as { parcel_id?: string | null }).parcel_id));
      setLockLabels(Array.isArray(shopData.lock_labels) ? shopData.lock_labels : []);
      setMyShop(shop ?? null);
      setMyRegistration(shopData.registration ? { id: String((shopData.registration as { id?: string }).id ?? "") } : null);
      setMaxProductsVisible(typeof shopData.max_products_visible === "number" ? shopData.max_products_visible : null);
      setMapExpansionLimit(typeof shopData.map_expansion_limit === "number" ? shopData.map_expansion_limit : null);
      setMapExpansionsUsed(typeof shopData.map_expansions_used === "number" ? shopData.map_expansions_used : 0);
      setUserVerified((verificationData as { verified?: boolean }).verified === true);
      setHasPackage(shopData.package_plan_name != null && String(shopData.package_plan_name).trim() !== "");
      if (shopData.shop || shopData.registration) {
        const reg = shopData.registration;
        const shop = shopData.shop;
        if (reg?.shop_name) setShopName(reg.shop_name);
        else if (shop?.shop_name) setShopName(shop.shop_name);
        if (reg?.description != null) setShopDescription(reg.description ?? "");
        else if (shop?.description != null) setShopDescription(shop.description ?? "");
        if (shop?.logo_url) setLogoUrl(shop.logo_url);
        else if (reg?.logo_url) setLogoUrl(reg.logo_url);
        if (shop?.logo_background_color) setLogoBackgroundColor(shop.logo_background_color);
        else if (reg?.logo_background_color) setLogoBackgroundColor(reg.logo_background_color);
        if (shop?.cover_url) setCoverUrl(shop.cover_url);
        else if (reg?.cover_url) setCoverUrl(reg.cover_url);
        if (shop?.market_display_url) setMarketDisplayUrl(shop.market_display_url);
      }
      const rawChannels = Array.isArray(contactsData.channels)
        ? (contactsData.channels as { id?: string; type: string; value: string; label?: string | null; visible?: boolean }[])
        : [];
      const merged = CONTACT_CHANNEL_TYPES.map((t) => {
        const c = rawChannels.find((r) => r.type === t.type);
        return c
          ? { id: c.id ?? `ch-${t.type}`, type: t.type, value: c.value, label: t.label, visible: c.visible !== false }
          : { id: `new-${t.type}`, type: t.type, value: "", label: t.label, visible: true };
      });
      setContactChannels(merged);
      const list = Array.isArray(productsData.products) ? productsData.products.map(toManageProduct) : [];
      setProducts(list);
      const meta: Record<string, { avg_rating: number; review_count: number; sold_count: number }> = {};
      for (const p of Array.isArray(productsData.products) ? productsData.products : []) {
        const id = String((p as Record<string, unknown>).id ?? "");
        if (!id) continue;
        meta[id] = {
          avg_rating: Number((p as Record<string, unknown>).avg_rating ?? 0),
          review_count: Number((p as Record<string, unknown>).review_count ?? 0),
          sold_count: Number((p as Record<string, unknown>).sold_count ?? 0),
        };
      }
      setProductMeta(meta);
      const catList = Array.isArray(categoriesData.categories) ? categoriesData.categories.map(toManageCategory) : [];
      setCategories(catList);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [setShopName, setShopDescription, setLogoUrl, setLogoBackgroundColor, setCoverUrl, setMarketDisplayUrl, setContactChannels, setProducts, setCategories]);

  useEffect(() => {
    fetchProductsAndCategories();
  }, [fetchProductsAndCategories, refreshShopKey]);

  const uploadFileIfNeeded = async (url: string | null, pendingFile: File | null): Promise<string | null> => {
    if (pendingFile) {
      const form = new FormData();
      form.append("file", pendingFile);
      form.append("folder", "shops");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "อัปโหลดไม่สำเร็จ");
      return (data as { url: string }).url;
    }
    if (url && url.startsWith("blob:")) return null;
    return url ?? null;
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsSaveError(null);
    setSettingsSaveOk(false);
    try {
      const [finalLogo, finalCover, finalMarket] = await Promise.all([
        uploadFileIfNeeded(logoUrl, pendingLogoFile),
        uploadFileIfNeeded(coverUrl, pendingCoverFile),
        uploadFileIfNeeded(marketDisplayUrl, pendingMarketFile),
      ]);
      if (finalLogo && finalLogo !== logoUrl) setLogoUrl(finalLogo);
      if (finalCover && finalCover !== coverUrl) setCoverUrl(finalCover);
      if (finalMarket && finalMarket !== marketDisplayUrl) setMarketDisplayUrl(finalMarket);
      const infoRes = await fetch("/api/data/me/shop/info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_name: shopName,
          description: shopDescription,
          logo_url: finalLogo,
          logo_background_color: logoBackgroundColor,
          cover_url: finalCover,
          market_display_url: finalMarket,
        }),
      });
      if (!infoRes.ok) {
        const d = await infoRes.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || "บันทึกข้อมูลร้านไม่สำเร็จ");
      }
      await fetch("/api/data/me/shop/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: contactChannels }),
      });
      setPendingLogoFile(null);
      setPendingCoverFile(null);
      setPendingMarketFile(null);
      setSettingsSaveOk(true);
      setTimeout(() => setSettingsSaveOk(false), 3000);
    } catch (err) {
      setSettingsSaveError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPendingLogoFile(file); setLogoUrl(URL.createObjectURL(file)); }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPendingCoverFile(file); setCoverUrl(URL.createObjectURL(file)); }
  };

  const handleMarketDisplayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setPendingMarketFile(file); setMarketDisplayUrl(URL.createObjectURL(file)); }
  };

  const hasRegistration = myRegistration !== null;
  const canBookSlot = hasRegistration && hasPackage;
  const bookSlotBlockReason = !hasRegistration
    ? "กรุณาลงทะเบียนร้านค้าก่อน"
    : !hasPackage
    ? "ต้องเลือกแพ็กเกจก่อนถึงจะจองล็อคได้"
    : null;
  /** ขยายล็อคได้เมื่อมีล็อคแล้ว และแพ็กรองรับ + โควต้าเหลือ */
  const _canExpandLock =
    canBookSlot &&
    hasParcel &&
    mapExpansionLimit !== null &&
    mapExpansionLimit > mapExpansionsUsed;
  /** จองครั้งแรกได้ (ยังไม่มีล็อค) หรือ ขยายล็อคได้ (มีล็อคแล้ว + โควต้าเหลือ) */
  const canReserveOrExpand =
    canBookSlot && (!hasParcel || (mapExpansionLimit !== null && mapExpansionLimit > mapExpansionsUsed));
  const shopVerified = myShop?.verification_status === "verified";
  const shopPending = myShop?.verification_status === "pending";

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentPendingFile && !documentUrl.trim()) {
      setVerifyError("กรุณาเลือกไฟล์เอกสารหรือระบุ URL");
      return;
    }
    setVerifySubmitting(true);
    setVerifyError(null);
    try {
      let url = documentUrl.trim();
      if (documentPendingFile) {
        const form = new FormData();
        form.append("file", documentPendingFile);
        form.append("folder", "shops");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error || "อัปโหลดไม่สำเร็จ");
        url = (data as { url: string }).url;
      }
      await submitShopVerification({ document_url: url });
      setMyShop((s) => (s ? { ...s, verification_status: "pending" } : null));
      setVerifyModalOpen(false);
      setDocumentUrl("");
      setDocumentPendingFile(null);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "ส่งเอกสารไม่สำเร็จ");
    } finally {
      setVerifySubmitting(false);
    }
  };

  const onDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentPendingFile(file);
      setVerifyError(null);
    }
    e.target.value = "";
  };

  // กรองและค้นหาสินค้าสำหรับรายการ
  const filteredProducts = useMemo(() => {
    let list = products;
    if (productFilter === "recommended") {
      list = list.filter((p) => p.recommended);
    } else if (productFilter === "hidden") {
      list = list.filter((p) => p.status === "hidden" || p.status === "out_of_stock");
    } else if (productFilter !== "all" && productFilter) {
      list = list.filter((p) => p.category_ids?.includes(productFilter));
    }
    const q = productSearch.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [products, productFilter, productSearch]);

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.55 }} aria-hidden />
      <div className="relative z-10 flex flex-col flex-1">
      <UnifiedHeader />

      <div className="max-w-4xl mx-auto px-4 pt-4">
        <h1 className="text-xl font-bold text-white mb-0">จัดการสินค้า</h1>
      </div>

      <BookLockModal
        open={bookLockModalOpen}
        onClose={() => setBookLockModalOpen(false)}
        onBookSuccess={() => setRefreshShopKey((k) => k + 1)}
      />

      {/* Tabs — สไตล์เดียวกับโปรไฟล์ จัดกลาง */}
      <div className="max-w-4xl mx-auto w-full px-4 pt-3 flex justify-center">
        <div className="flex rounded-xl overflow-hidden app-glass-subtle gap-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`px-5 sm:px-7 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "products" ? "bg-pink-950/30" : "hover:bg-white/5"
            }`}
          >
            <span
              className={`inline-flex items-center gap-2 border-b-2 pb-3.5 transition-colors ${
                activeTab === "products"
                  ? "border-pink-500 text-pink-300"
                  : "text-white/90 border-transparent hover:text-pink-200"
              }`}
            >
              <Package size={18} className="shrink-0" />
              สินค้า
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-5 sm:px-7 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "settings" ? "bg-pink-950/30" : "hover:bg-white/5"
            }`}
          >
            <span
              className={`inline-flex items-center gap-2 border-b-2 pb-3.5 transition-colors ${
                activeTab === "settings"
                  ? "border-pink-500 text-pink-300"
                  : "text-white/90 border-transparent hover:text-pink-200"
              }`}
            >
              <Settings size={18} className="shrink-0" />
              ตั้งค่า & จองล็อค
            </span>
          </button>
        </div>
      </div>

      <main className="w-full max-w-4xl mx-auto p-4 md:p-6">
        {activeTab === "products" && (
          <div className="space-y-8">
            {hasShop && !hasParcel && (
              <div className="rounded-xl border border-pink-500/30 bg-pink-950/20 p-4 text-pink-200 text-sm">
                <p className="font-medium mb-1">ยังไม่จองที่บนแผนที่</p>
                <p className="text-pink-200/90">คุณสามารถลงสินค้าและจัดการร้านได้เลย เมื่อแอดมินจองที่ให้แล้ว ร้านจะแสดงบนแผนที่และคนอื่นจะเข้ามาร้านได้</p>
              </div>
            )}
            {!hasShop && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-amber-200 text-sm">
                <p className="font-medium mb-1">กรุณาลงทะเบียนร้านก่อน</p>
                <p className="text-amber-200/90">ไปที่หน้าลงทะเบียนร้านเพื่อสร้างร้านก่อน จึงจะเพิ่มสินค้าและหมวดหมู่ได้</p>
              </div>
            )}
            <AddProductPopup
              open={showAddProductPopup}
              categories={categories}
              onClose={() => setShowAddProductPopup(false)}
              onAdd={async (data) => {
                const categoryIds = (data.category_ids ?? []).filter((id) => id !== ALL_CATEGORY_ID);
                try {
                  const res = await fetch("/api/data/me/shop/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: data.name,
                      price: data.price,
                      stock_quantity: data.stock_quantity ?? 0,
                      description: data.description ?? "",
                      image_url: data.image_url ?? "",
                      recommended: data.recommended ?? false,
                      status: "active",
                      category_ids: categoryIds,
                    }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error || "เพิ่มสินค้าไม่สำเร็จ");
                  if (json.product) {
                    const prod = json.product as Record<string, unknown>;
                    setProducts((prev) => [...prev, toManageProduct(prod)]);
                    const id = String(prod.id ?? "");
                    if (id) setProductMeta((prev) => ({ ...prev, [id]: { avg_rating: 0, review_count: 0, sold_count: 0 } }));
                  }
                  setShowAddProductPopup(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />

            <AddCategoryPopup
              open={showAddCategoryPopup}
              onClose={() => setShowAddCategoryPopup(false)}
              onAdd={async (name) => {
                try {
                  const res = await fetch("/api/data/me/shop/categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: name.trim() }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error || "เพิ่มหมวดหมู่ไม่สำเร็จ");
                  if (json.category) setCategories((prev) => [...prev, toManageCategory(json.category)]);
                  setShowAddCategoryPopup(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />

            {/* รายการสินค้า + เพิ่มสินค้า + จัดหมวด — กรอบก้อนเดียว */}
            <section className="rounded-xl border border-pink-900/30 bg-slate-900/95 shadow-lg overflow-hidden">

              {/* แถวบน: ปุ่มเพิ่มสินค้า + ปุ่มเพิ่มหมวด */}
              <div className="p-4 border-b border-pink-900/20 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  disabled={!hasShop}
                  onClick={() => hasShop && setShowAddProductPopup(true)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={16} />
                  เพิ่มสินค้า
                </button>
                <div className="h-px sm:h-5 sm:w-px bg-pink-900/40 shrink-0" />
                <div className="flex items-center gap-3 flex-1 flex-wrap">
                  <span className="text-sm font-bold text-pink-400 flex items-center gap-1.5">
                    <Tag size={14} />
                    จัดหมวด / เพิ่มหมวด
                  </span>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {categories.map((c) => (
                      <span key={c.id} className="inline-block px-3 py-1 rounded-lg bg-slate-800/90 border border-pink-900/20 text-white text-xs">
                        {c.name}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!hasShop}
                    onClick={() => hasShop && setShowAddCategoryPopup(true)}
                    className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    เพิ่มหมวด
                  </button>
                </div>
              </div>

              {/* หัวข้อ + แถบกรอง */}
              <div className="p-4 border-b border-pink-900/20">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider">
                    รายการสินค้า (ลบ / แก้ไข)
                  </h3>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                      maxProductsVisible !== null && maxProductsVisible < 999999 && products.length >= maxProductsVisible
                        ? "bg-red-950/50 border-red-500/50 text-red-300"
                        : "bg-slate-800/80 border-pink-900/30 text-slate-300"
                    }`}
                    title={maxProductsVisible != null ? (maxProductsVisible >= 999999 ? "จำนวนสินค้า (ไม่จำกัดตามแพ็กเกจ)" : `แสดง ${products.length} จากสูงสุด ${maxProductsVisible} ชิ้นตามแพ็กเกจ`) : "จำนวนสินค้า"}
                  >
                    {products.length} ชิ้น
                    {maxProductsVisible !== null && (
                      <span className="opacity-90 ml-0.5">
                        {maxProductsVisible >= 999999 ? "/ ไม่จำกัด" : `/ สูงสุด ${maxProductsVisible}`}
                      </span>
                    )}
                  </span>
                </div>
                {/* แถบกรอง/ค้นหา — ความกว้างพอดี ไม่ยืดเต็มหน้าจอ */}
                <div className="flex flex-wrap items-center gap-3 max-w-2xl">
                  <select
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    className="rounded-lg border border-pink-900/30 bg-slate-800/95 text-white text-sm px-3 py-2 focus:outline-none focus:border-pink-500/50 min-w-[160px]"
                  >
                    <option value="all">สินค้าทั้งหมด</option>
                    <option value="recommended">สินค้าแนะนำ</option>
                    <option value="hidden">สินค้าไม่แสดง</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="relative w-52 min-w-[180px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="ค้นหาชื่อสินค้า"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-pink-900/30 bg-slate-800/95 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>
                  <div className="flex rounded-lg border border-pink-900/30 overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setProductViewMode("grid")}
                      className={`p-2 ${productViewMode === "grid" ? "bg-pink-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
                      title="มุมมองการ์ด"
                    >
                      <LayoutGrid size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductViewMode("table")}
                      className={`p-2 ${productViewMode === "table" ? "bg-pink-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
                      title="มุมมองตาราง"
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0">
              {productViewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredProducts.map((p) => {
                    const catNames = getCategoryNames(p, categories);
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl bg-slate-900/95 border border-pink-900/20 overflow-hidden flex flex-col"
                      >
                        <div className="aspect-square w-full min-h-[140px] sm:min-h-[160px] bg-slate-800 relative shrink-0 overflow-hidden flex items-center justify-center">
                          {(() => {
                            const imgUrl = getDriveImageDisplayUrl(p.image_url);
                            return imgUrl ? (
                              <img
                                src={imgUrl}
                                alt=""
                                className="w-full h-full min-w-0 min-h-0 object-contain object-center"
                              />
                            ) : (
                              <span className="text-slate-500 text-xs">ไม่มีรูป</span>
                            );
                          })()}
                          {p.recommended && (
                            <span className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500/90 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                              <Star size={10} className="fill-slate-900" />
                              แนะนำ
                            </span>
                          )}
                        </div>
                        <div className="p-3 flex-1 flex flex-col min-h-0">
                          <div className="font-medium text-white truncate text-sm">{p.name}</div>
                          <div className="text-pink-400 text-sm mt-0.5">{p.price} เหรียญ</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-slate-400 text-xs">ขายแล้ว {(productMeta[p.id]?.sold_count ?? 0).toLocaleString()} ชิ้น</span>
                          </div>
                          {productMeta[p.id]?.review_count > 0 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              {[1,2,3,4,5].map((i) => (
                                <Star key={i} size={11} className={i <= Math.round(productMeta[p.id].avg_rating) ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
                              ))}
                              <span className="text-amber-400 text-xs">{productMeta[p.id].avg_rating.toFixed(1)}</span>
                              <span className="text-slate-500 text-xs">({productMeta[p.id].review_count})</span>
                            </div>
                          )}
                          <div className="text-slate-500 text-xs mt-0.5">คลัง: {typeof p.stock_quantity === "number" ? p.stock_quantity : 0}</div>
                          {(p.status === "out_of_stock" || p.status === "hidden") && (
                            <span className="text-amber-400/90 text-xs mt-0.5">{p.status === "out_of_stock" ? "หมดแล้ว (ไม่แสดง)" : "ไม่แสดง"}</span>
                          )}
                          {catNames.length > 0 && (
                            <span className="text-xs text-pink-500/80 mt-1 block truncate">{catNames.join(", ")}</span>
                          )}
                          <div className="flex items-center gap-2 mt-2 shrink-0 flex-wrap">
                            <button type="button" disabled={p.status === "out_of_stock"} onClick={async () => {
                              if (p.status === "out_of_stock") return;
                              try {
                                const newStatus = p.status === "active" ? "hidden" : "active";
                                const res = await fetch(`/api/data/me/shop/products/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
                                if (!res.ok) { const json = await res.json(); throw new Error(json.error || "เปลี่ยนสถานะไม่สำเร็จ"); }
                                updateProduct(p.id, { status: newStatus });
                              } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                            }} className={`p-2 rounded-lg ${p.status === "active" ? "text-emerald-400 hover:bg-emerald-950/30" : p.status === "out_of_stock" ? "text-slate-600 cursor-not-allowed" : "text-slate-500 hover:bg-slate-800/50"}`} title={p.status === "active" ? "แสดง — คลิกเพื่อปิดไม่แสดง" : p.status === "out_of_stock" ? "หมดแล้ว" : "ไม่แสดง — คลิกเพื่อแสดง"}>
                              {p.status === "active" ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                            <button type="button" onClick={() => setReviewModal({ id: p.id, name: p.name })} className="p-2 rounded-lg text-amber-400 hover:bg-amber-950/30" title="ดูรีวิวสินค้า"><Star size={16} /></button>
                            <button type="button" onClick={() => setEditProduct(p)} className="p-2 rounded-lg text-pink-400 hover:bg-pink-950/30" title="แก้ไข"><Pencil size={16} /></button>
                            <button type="button" onClick={async () => {
                              try {
                                const res = await fetch(`/api/data/me/shop/products/${p.id}`, { method: "DELETE" });
                                if (!res.ok) { const json = await res.json(); throw new Error(json.error || "ลบไม่สำเร็จ"); }
                                deleteProduct(p.id);
                              } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                            }} className="p-2 rounded-lg text-red-400 hover:bg-red-950/30" title="ลบ"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-pink-900/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-pink-900/20 bg-slate-900/95">
                          <th className="text-left py-3 px-3 text-pink-400 font-medium w-12">รูป</th>
                          <th className="text-left py-3 px-3 text-pink-400 font-medium">ชื่อ</th>
                          <th className="text-left py-3 px-3 text-pink-400 font-medium">ราคา</th>
                          <th className="text-left py-3 px-3 text-pink-400 font-medium">ขายแล้ว</th>
                          <th className="text-left py-3 px-3 text-pink-400 font-medium">คลัง</th>
                          <th className="text-left py-3 px-3 text-pink-400 font-medium">สถานะ</th>
                          <th className="text-left py-3 px-3 text-pink-400 font-medium w-40">ดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((p) => {
                          const catNames = getCategoryNames(p, categories);
                          const productImgUrl = getDriveImageDisplayUrl(p.image_url);
                          return (
                            <tr key={p.id} className="border-b border-pink-900/10 hover:bg-slate-900/70">
                              <td className="py-2 px-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                                  {productImgUrl ? (
                                    <img src={productImgUrl} alt="" className="w-full h-full object-contain" />
                                  ) : (
                                    <span className="text-slate-500 text-[10px]">ไม่มีรูป</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-white">{p.name}</span>
                                  {p.recommended && (
                                    <span className="inline-flex items-center gap-0.5 bg-amber-500/90 text-slate-900 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                      <Star size={9} className="fill-slate-900" />
                                      แนะนำ
                                    </span>
                                  )}
                                </div>
                                {catNames.length > 0 && <span className="text-xs text-pink-500/80">{catNames.join(", ")}</span>}
                              </td>
                              <td className="py-2 px-3 text-pink-400">{p.price} เหรียญ</td>
                              <td className="py-2 px-3 text-slate-400">{(productMeta[p.id]?.sold_count ?? 0).toLocaleString()} ชิ้น</td>
                              <td className="py-2 px-3 text-slate-400">{typeof p.stock_quantity === "number" ? p.stock_quantity : 0}</td>
                              <td className="py-2 px-3">
                                {p.status === "active" ? <span className="text-emerald-400 text-xs">แสดง</span> : p.status === "out_of_stock" ? <span className="text-amber-400 text-xs">หมดแล้ว</span> : <span className="text-slate-500 text-xs">ไม่แสดง</span>}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1">
                                  <button type="button" disabled={p.status === "out_of_stock"} onClick={async () => {
                                    if (p.status === "out_of_stock") return;
                                    try {
                                      const newStatus = p.status === "active" ? "hidden" : "active";
                                      const res = await fetch(`/api/data/me/shop/products/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
                                      if (!res.ok) { const json = await res.json(); throw new Error(json.error || "เปลี่ยนสถานะไม่สำเร็จ"); }
                                      updateProduct(p.id, { status: newStatus });
                                    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                                  }} className={`p-1.5 rounded ${p.status === "active" ? "text-emerald-400 hover:bg-emerald-950/30" : p.status === "out_of_stock" ? "text-slate-600 cursor-not-allowed" : "text-slate-500 hover:bg-slate-800/50"}`} title={p.status === "active" ? "แสดง" : "ไม่แสดง"}>{p.status === "active" ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                                  <button type="button" onClick={() => setReviewModal({ id: p.id, name: p.name })} className="p-1.5 rounded text-amber-400 hover:bg-amber-950/30" title="รีวิว"><Star size={14} /></button>
                                  <button type="button" onClick={() => setEditProduct(p)} className="p-1.5 rounded text-pink-400 hover:bg-pink-950/30" title="แก้ไข"><Pencil size={14} /></button>
                                  <button type="button" onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/data/me/shop/products/${p.id}`, { method: "DELETE" });
                                      if (!res.ok) { const json = await res.json(); throw new Error(json.error || "ลบไม่สำเร็จ"); }
                                      deleteProduct(p.id);
                                    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                                  }} className="p-1.5 rounded text-red-400 hover:bg-red-950/30" title="ลบ"><Trash2 size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
            </section>

            {/* Modal ดูรีวิวสินค้า (ฝั่งเจ้าของร้าน) */}
            {reviewModal && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
                onClick={() => setReviewModal(null)}
              >
                <div
                  className="rounded-xl border border-amber-500/30 bg-slate-950 shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto p-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                      <Star size={16} className="text-amber-400 fill-amber-400" />
                      รีวิวสินค้า
                    </h3>
                    <button
                      type="button"
                      onClick={() => setReviewModal(null)}
                      className="text-slate-400 hover:text-white text-xl leading-none"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <p className="text-pink-200 text-sm font-medium mb-1">{reviewModal.name}</p>
                  <div className="flex items-center gap-3 mb-4 text-xs text-slate-400">
                    <span>ขายแล้ว {(productMeta[reviewModal.id]?.sold_count ?? 0).toLocaleString()} ชิ้น</span>
                    {productMeta[reviewModal.id]?.review_count > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          {productMeta[reviewModal.id].avg_rating.toFixed(1)}
                          <span className="text-slate-500">({productMeta[reviewModal.id].review_count} รีวิว)</span>
                        </span>
                      </>
                    )}
                  </div>
                  <ProductReviewSection
                    productId={reviewModal.id}
                    productName={reviewModal.name}
                  />
                </div>
              </div>
            )}

            {editProduct && (
              <EditProductPopup
                product={editProduct}
                categories={categories}
                onClose={() => setEditProduct(null)}
                onSave={async (updates) => {
                  try {
                    const categoryIds = (updates.category_ids ?? editProduct.category_ids).filter((id) => id !== ALL_CATEGORY_ID);
                    const res = await fetch(`/api/data/me/shop/products/${editProduct.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: updates.name,
                        price: updates.price,
                        stock_quantity: updates.stock_quantity,
                        description: updates.description,
                        image_url: updates.image_url,
                        recommended: updates.recommended,
                        category_ids: categoryIds,
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
                    if (json.product) {
                      updateProduct(editProduct.id, toManageProduct(json.product));
                    } else {
                      updateProduct(editProduct.id, updates);
                    }
                    setEditProduct(null);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              />
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-5">
            {/* ล็อคในแผนที่ */}
            <section className="rounded-xl border border-pink-900/30 bg-slate-900/95 shadow-lg overflow-hidden">
              <div className="p-4 border-b border-pink-900/20">
                <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2">
                  <MapPin size={14} />
                  ล็อคในแผนที่
                </h3>
              </div>
              <div className="p-4">
                {loading ? (
                  <p className="text-slate-500 text-sm">กำลังโหลด...</p>
                ) : canBookSlot ? (
                  <>
                    {lockLabels.length > 0 && (
                      <p className="text-slate-300 text-sm mb-2">
                        ที่จองปัจจุบัน: {lockLabels.join(", ")}
                      </p>
                    )}
                    {hasParcel && (
                      <p className="text-slate-400 text-xs mb-3">
                        {mapExpansionLimit === 0
                          ? "แพ็กเกจฟรี — ขยายล็อคในแผนที่ไม่ได้"
                          : `ขยายได้ ${mapExpansionsUsed} / ${mapExpansionLimit ?? 0} ครั้ง ตามแพ็กเกจ`}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!canReserveOrExpand}
                      onClick={() => canReserveOrExpand && setBookLockModalOpen(true)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                        canReserveOrExpand
                          ? "bg-pink-600 hover:bg-pink-500 text-white"
                          : "bg-slate-600 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <MapPin size={18} />
                      {lockLabels.length > 0 ? "ขยายล็อค" : "จองล็อค"}
                    </button>
                    <p className="text-slate-500 text-xs mt-2">
                      {canReserveOrExpand
                        ? lockLabels.length > 0
                          ? "กดปุ่มด้านบนเพื่อจองล็อคเพิ่มในแผนที่"
                          : "กดปุ่มด้านบนเพื่อเปิดแผนที่และเลือกตำแหน่งล็อค (จองครั้งแรก)"
                        : "แพ็กเกจปัจจุบันไม่รองรับการขยายล็อค หรือใช้ครบจำนวนแล้ว"}
                    </p>
                  </>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/90 border border-slate-700">
                    <Lock size={18} className="text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-300 text-sm font-medium">ฟีเจอร์นี้ยังถูกล็อคอยู่</p>
                      <p className="text-amber-400 text-xs">{bookSlotBlockReason}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ยืนยันร้านค้า (ติดโล่น่าเชื่อถือ) */}
            <section className="rounded-xl border border-pink-900/30 bg-slate-900/95 shadow-lg overflow-hidden">
              <div className="p-4 border-b border-pink-900/20">
                <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield size={14} />
                  ยืนยันร้านค้า (ติดโล่น่าเชื่อถือ)
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  ฟีเจอร์เพิ่มความน่าเชื่อถือให้ร้าน — ร้านที่ผ่านการยืนยันจะได้รับโล่ แสดงในหน้าร้านและแผนที่ คล้าย Official Store ใน Shopee
                  <span className="text-slate-600 ml-1">(แยกจากการยืนยันตัวตนผู้ใช้ด้วยบัตรประชาชน)</span>
                </p>
              </div>
              <div className="p-4">
                {loading ? (
                  <p className="text-slate-500 text-sm">กำลังโหลด...</p>
                ) : shopVerified ? (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <VerifiedBadge variant="green" size={24} title="ร้านยืนยันแล้ว" />
                    <span className="text-sm font-medium">ร้านค้าได้รับโล่ยืนยันแล้ว — แสดงให้ลูกค้าเห็น</span>
                  </div>
                ) : shopPending ? (
                  <div className="flex items-center gap-2 text-amber-400">
                    <Shield size={24} />
                    <div>
                      <span className="text-sm font-medium block">รอแอดมินตรวจสอบเอกสาร</span>
                      <span className="text-xs text-amber-400/70">ส่งเอกสารเรียบร้อยแล้ว — แอดมินจะอนุมัติภายใน 1–3 วันทำการ</span>
                    </div>
                  </div>
                ) : myShop ? (
                  <>
                    <p className="text-slate-400 text-sm mb-3">
                      ส่งเอกสารประกอบร้าน (เช่น หนังสือรับรองนิติบุคคล, ทะเบียนพาณิชย์) เพื่อให้แอดมินตรวจสอบและมอบโล่ยืนยัน
                    </p>
                    <button
                      type="button"
                      onClick={() => { setVerifyModalOpen(true); setVerifyError(null); }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium"
                    >
                      <Shield size={18} />
                      ส่งเอกสารขอโล่ยืนยันร้านค้า
                    </button>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">
                    ร้านต้องได้รับที่บนแผนที่จากแอดมินก่อน จึงจะขอโล่ยืนยันร้านค้าได้
                  </p>
                )}
              </div>
            </section>

            {/* ข้อมูลร้านค้า — กรอบเดียวรวมทุกอย่าง */}
            <section className="rounded-xl border border-pink-900/30 bg-slate-900/95 shadow-lg overflow-hidden">
              <div className="p-4 border-b border-pink-900/20">
                <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2">
                  <Store size={14} />
                  ข้อมูลร้านค้า
                </h3>
              </div>

              <div className="divide-y divide-pink-900/20">
                {/* ชื่อร้าน */}
                <div className="p-4">
                  <label className="block text-sm font-bold text-pink-400 mb-2 flex items-center gap-2">
                    <Store size={14} />
                    ชื่อร้าน
                  </label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-pink-900/30 text-white focus:outline-none focus:border-pink-500/50"
                    placeholder="กรุณากรอก"
                  />
                </div>

                {/* รายละเอียดร้านค้า */}
                <div className="p-4">
                  <label className="block text-sm font-bold text-pink-400 mb-2">
                    รายละเอียดร้านค้า
                  </label>
                  <textarea
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-pink-900/30 text-white focus:outline-none focus:border-pink-500/50 resize-y"
                    placeholder="กรุณากรอก"
                  />
                </div>

                {/* รูปโปร / โลโก้ */}
                <div className="p-4">
                  <label className="block text-sm font-bold text-pink-400 mb-3">
                    รูปโปร / โลโก้ร้าน (แสดงในตาราง)
                  </label>
                  <div className="flex justify-center">
                    <label
                      className="flex flex-col items-center justify-center w-56 h-56 rounded-xl border-2 border-dashed border-pink-900/40 cursor-pointer hover:border-pink-500/50 transition-colors overflow-hidden"
                      style={{ backgroundColor: logoBackgroundColor || undefined }}
                    >
                      {logoUrl ? (
                        <img src={getDriveImageDisplayUrl(logoUrl)} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-white/70 py-8">
                          <Upload size={36} />
                          <span className="text-sm">คลิกเพื่ออัพโหลดรูปโปร</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  </div>
                </div>

                {/* สีพื้นหลัง */}
                <div className="p-4">
                  <label className="block text-sm font-bold text-pink-400 mb-1">
                    สีพื้นหลัง
                  </label>
                  <p className="text-xs text-slate-400 mb-3">สีพื้นหลังที่แสดงในหน้าตลาด เพื่อให้เห็นรูปชัดขึ้น</p>
                  <LogoBackgroundColorPicker
                    value={logoBackgroundColor}
                    onChange={setLogoBackgroundColor}
                    label=""
                    placeholder="กรุณากรอก (หากมี)"
                  />
                </div>

                {/* รูปแสดงในตลาด */}
                <div className="p-4">
                  <label className="block text-sm font-bold text-pink-400 mb-1">
                    รูปแสดงในตลาด (ไม่บังคับ)
                  </label>
                  <p className="text-xs text-slate-400 mb-3">ถ้าไม่ตั้งค่า จะใช้รูปโปรไฟล์แสดงในตลาดแทน</p>
                  <div className="flex justify-center">
                    <div className="relative">
                      <label className="flex flex-col items-center justify-center w-56 h-56 rounded-xl border-2 border-dashed border-pink-900/40 bg-slate-800/60 cursor-pointer hover:border-pink-500/50 transition-colors overflow-hidden">
                        {marketDisplayUrl ? (
                          <img src={getDriveImageDisplayUrl(marketDisplayUrl)} alt="" className="w-full h-full object-contain" />
                        ) : logoUrl ? (
                          <div className="relative w-full h-full flex flex-col items-center justify-center">
                            <img src={getDriveImageDisplayUrl(logoUrl)} alt="" className="w-full h-full object-contain opacity-40" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-pink-400/70">
                              <Upload size={32} />
                              <span className="text-sm">คลิกเพื่ออัพโหลดรูปแสดงในตลาด</span>
                              <span className="text-xs text-slate-500">(กำลังใช้รูปโปรไฟล์)</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-pink-400/70">
                            <Upload size={32} />
                            <span className="text-sm">คลิกเพื่ออัพโหลดรูปแสดงในตลาด</span>
                          </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleMarketDisplayUpload} />
                      </label>
                      {marketDisplayUrl && (
                        <button
                          type="button"
                          onClick={() => setMarketDisplayUrl(null)}
                          className="absolute -top-2 -right-2 p-2 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg"
                          title="ลบรูปและใช้รูปโปรไฟล์แทน"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* รูปปก */}
                <div className="p-4">
                  <label className="block text-sm font-bold text-pink-400 mb-3">
                    รูปปกร้าน
                  </label>
                  <label className="flex flex-col items-center justify-center w-full aspect-[3/1] min-h-[120px] rounded-xl border-2 border-dashed border-pink-900/40 bg-slate-800/60 cursor-pointer hover:border-pink-500/50 transition-colors overflow-hidden">
                    {coverUrl ? (
                      <img src={getDriveImageDisplayUrl(coverUrl)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-pink-400/70">
                        <Upload size={32} />
                        <span className="text-sm">คลิกเพื่ออัพโหลดรูปปก</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  </label>
                </div>

                {/* ช่องทางติดต่อ / สั่งซื้อ */}
                <div className="p-4">
                  <label className="block text-sm font-bold text-pink-400 mb-3 flex items-center gap-2">
                    <MessageCircle size={14} />
                    ช่องทางติดต่อ / สั่งซื้อ
                  </label>
                  <p className="text-slate-400 text-xs mb-3">
                    เลือก &quot;แสดง&quot; เพื่อให้ลูกค้าเห็นช่องทางนี้เมื่อดูร้านจากแผนที่
                  </p>
                  <div className="space-y-3">
                    {contactChannels.map((ch) => (
                      <div key={ch.id} className="flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          <input
                            type="text"
                            value={ch.label ?? ch.type}
                            readOnly
                            className="sm:w-28 px-3 py-2 rounded-lg bg-slate-800 border border-pink-900/30 text-slate-400 text-sm"
                          />
                          <input
                            type="text"
                            value={ch.value}
                            onChange={(e) =>
                              setContactChannels((prev) =>
                                prev.map((c) => (c.id === ch.id ? { ...c, value: e.target.value } : c))
                              )
                            }
                            className="flex-1 px-3 py-2 rounded-lg bg-slate-800/80 border border-pink-900/30 text-white text-sm"
                            placeholder="กรุณากรอก (หากมี)"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setContactChannels((prev) =>
                                prev.map((c) => (c.id === ch.id ? { ...c, visible: !c.visible } : c))
                              )
                            }
                            className={`flex items-center justify-center gap-1.5 sm:w-24 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                              ch.visible !== false
                                ? "bg-emerald-950/50 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/40"
                                : "bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700"
                            }`}
                            title={ch.visible !== false ? "ซ่อนช่องทางนี้จากลูกค้า" : "แสดงช่องทางนี้ให้ลูกค้า"}
                          >
                            {ch.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                            {ch.visible !== false ? "แสดง" : "ซ่อน"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ปุ่มบันทึก */}
                <div className="p-4">
                  {settingsSaveError && (
                    <p className="text-red-400 text-sm mb-2">{settingsSaveError}</p>
                  )}
                  {settingsSaveOk && (
                    <p className="text-emerald-400 text-sm mb-2">บันทึกเรียบร้อยแล้ว</p>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    {settingsSaving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        กำลังบันทึก...
                      </>
                    ) : "บันทึกข้อมูลร้าน"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* โมดัลส่งเอกสารยืนยันร้าน */}
      {verifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="rounded-xl border border-pink-900/30 bg-slate-950 w-full max-w-md">
            <div className="p-4 border-b border-pink-900/30 flex items-center justify-between">
              <h3 className="font-semibold text-white">ส่งเอกสารขอโล่ยืนยันร้านค้า</h3>
              <button type="button" onClick={() => setVerifyModalOpen(false)} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleVerifySubmit} className="p-4 space-y-4">
              {verifyError && <p className="text-red-300 text-sm">{verifyError}</p>}
              <div>
                <label className="block text-slate-400 text-sm mb-1">เอกสาร (รูปหรือ PDF)</label>
                <div className="flex gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm cursor-pointer hover:bg-slate-600">
                    <ImageUp size={16} />
                    เลือกไฟล์
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={onDocSelect} disabled={verifySubmitting} />
                  </label>
                  <input
                    type="text"
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                    placeholder="หรือระบุ URL (ถ้ามี)"
                    className="flex-1 min-w-0 rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
                  />
                </div>
                {documentPendingFile && (
                  <p className="text-slate-500 text-xs mt-1">เลือกแล้ว: {documentPendingFile.name} — กดส่งเอกสารเพื่ออัปโหลด</p>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setVerifyModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-700">ยกเลิก</button>
                <button type="submit" disabled={verifySubmitting} className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white disabled:opacity-50 flex items-center gap-2">
                  {verifySubmitting && <Loader2 size={16} className="animate-spin" />}
                  {verifySubmitting ? "กำลังส่ง..." : "ส่งเอกสาร"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
