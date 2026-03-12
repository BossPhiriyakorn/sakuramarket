"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Store,
  Image as ImageIcon,
  MessageCircle,
  Phone,
  Upload,
  Loader2,
  MapPin,
} from "lucide-react";
import { useManageShopStore } from "@/store/manageShopStore";
import { useProfileStore } from "@/store/profileStore";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { useNavigationLoading } from "@/components/NavigationLoadingOverlay";
import { LogoBackgroundColorPicker } from "@/components/LogoBackgroundColorPicker";
import { normalizeImageUrl } from "@/lib/imageUrl";

/** รายการฟิลด์ที่ต้องกรอกสำหรับลงทะเบียนร้าน (เบื้องต้น ไม่รวมเอกสารยืนยันตน) */
const REGISTER_FIELDS = {
  shopName: { label: "ชื่อร้าน", required: true, placeholder: "กรุณากรอก" },
  description: { label: "คำอธิบายร้าน", required: true, placeholder: "กรุณากรอก" },
  logoUrl: { label: "โลโก้ร้าน", required: false },
  logoBackgroundColor: { label: "สีพื้นหลังโลโก้", required: false, placeholder: "กรุณากรอก (หากมี)" },
  coverUrl: { label: "รูปคัฟเวอร์", required: false },
  lineId: { label: "LINE ID / @username", required: false, placeholder: "กรุณากรอก (หากมี)" },
  phone: { label: "เบอร์โทรร้าน", required: false, placeholder: "กรุณากรอก (หากมี)" },
} as const;

export default function RegisterShopPage() {
  const router = useRouter();
  const { startNavigation } = useNavigationLoading();
  const displayName = useProfileStore((s) => {
    const { firstName, lastName, username } = s;
    return [firstName, lastName].filter(Boolean).join(" ") || username || "ผู้ใช้";
  });

  const {
    shopName,
    shopDescription,
    logoUrl,
    logoBackgroundColor,
    coverUrl,
    contactChannels,
    useSameAsUserAddress,
    shopFullAddress,
    shopMapUrl,
    setShopName,
    setShopDescription,
    setLogoUrl,
    setLogoBackgroundColor,
    setCoverUrl,
    setContactChannels,
    setUseSameAsUserAddress,
    setShopFullAddress,
    setShopMapUrl,
  } = useManageShopStore();

  const [form, setForm] = useState({
    shopName: shopName || "",
    description: shopDescription || "",
    logoUrl: logoUrl || "",
    logoBackgroundColor: logoBackgroundColor || "#ec4899",
    coverUrl: coverUrl || "",
    lineId: contactChannels.find((c) => c.type === "line")?.value || "",
    phone: contactChannels.find((c) => c.type === "phone")?.value || "",
    useSameAsUserAddress,
    shopAddressLine1: shopFullAddress || "",
    shopAddressLine2: "",
    shopSubDistrict: "",
    shopDistrict: "",
    shopProvince: "",
    shopPostalCode: "",
    shopMapUrl: shopMapUrl || "",
  });
  const [userAddress, setUserAddress] = useState<{ full_address?: string; map_url?: string | null } | null>(null);

  // 1 ยูส ต่อ 1 ร้าน — ถ้ามีร้านแล้ว redirect ไปจัดการร้านค้า
  useEffect(() => {
    let cancelled = false;
    fetch("/api/data/me/shop", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { shop?: { id: string } | null }) => {
        if (cancelled) return;
        if (data.shop?.id) {
          router.replace("/manage-shop");
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    fetch("/api/data/me/address", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { address?: { full_address?: string; map_url?: string | null } | null }) => {
        if (data.address) setUserAddress(data.address);
      })
      .catch(() => {});
  }, []);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const uploadFileToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "shops");
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`อัปโหลดรูปไม่สำเร็จ (เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ${res.status ? ` – HTTP ${res.status}` : ""})`);
    }
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "อัปโหลดไม่สำเร็จ");
    }
    if (typeof data.url !== "string" || !data.url) {
      throw new Error("อัปโหลดสำเร็จแต่ไม่ได้รับ URL ไฟล์");
    }
    return data.url;
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setPendingLogoFile(f);
    setLogoPreviewUrl(URL.createObjectURL(f));
  };

  const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setPendingCoverFile(f);
    setCoverPreviewUrl(URL.createObjectURL(f));
  };

  React.useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [logoPreviewUrl, coverPreviewUrl]);

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) setErrors((prev) => ({ ...prev, [key as string]: "" }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.shopName.trim()) next.shopName = "กรุณากรอกชื่อร้าน";
    if (!form.description.trim()) next.description = "กรุณากรอกคำอธิบายร้าน";
    const hasContact = form.lineId.trim() || form.phone.trim();
    if (!hasContact) {
      next.contact = "กรุณากรอก LINE หรือเบอร์โทรอย่างน้อยหนึ่งช่อง";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setUploadError(null);
    setSaving(true);
    try {
      let finalLogoUrl = form.logoUrl.trim() || null;
      let finalCoverUrl = form.coverUrl.trim() || null;
      if (pendingLogoFile) {
        finalLogoUrl = await uploadFileToServer(pendingLogoFile);
      }
      if (pendingCoverFile) {
        finalCoverUrl = await uploadFileToServer(pendingCoverFile);
      }

      const shopAddress = !form.useSameAsUserAddress ? {
        full_address: [
          form.shopAddressLine1.trim(),
          form.shopAddressLine2.trim(),
          form.shopSubDistrict.trim(),
          form.shopDistrict.trim(),
          form.shopProvince.trim(),
          form.shopPostalCode.trim(),
        ].filter(Boolean).join(", ") || undefined,
        address_line1: form.shopAddressLine1.trim() || null,
        address_line2: form.shopAddressLine2.trim() || null,
        sub_district: form.shopSubDistrict.trim() || null,
        district: form.shopDistrict.trim() || null,
        province: form.shopProvince.trim() || null,
        postal_code: form.shopPostalCode.trim() || null,
        map_url: form.shopMapUrl.trim() || null,
      } : null;

      const res = await fetch("/api/data/me/shop-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          shop_name: form.shopName.trim(),
          description: form.description.trim(),
          logo_url: finalLogoUrl,
          logo_background_color: form.logoBackgroundColor.trim() || "#ec4899",
          cover_url: finalCoverUrl,
          use_same_as_user_address: form.useSameAsUserAddress,
          address: shopAddress,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "บันทึกข้อมูลร้านไม่สำเร็จ");
      }

      setShopName(form.shopName.trim());
      setShopDescription(form.description.trim());
      setLogoUrl(finalLogoUrl);
      setLogoBackgroundColor(form.logoBackgroundColor.trim() || "#ec4899");
      setCoverUrl(finalCoverUrl);
      setUseSameAsUserAddress(form.useSameAsUserAddress);
      const addressParts = [
        form.shopAddressLine1.trim(),
        form.shopAddressLine2.trim(),
        form.shopSubDistrict.trim(),
        form.shopDistrict.trim(),
        form.shopProvince.trim(),
        form.shopPostalCode.trim(),
      ].filter(Boolean);
      setShopFullAddress(addressParts.length > 0 ? addressParts.join(", ") : "");
      setShopMapUrl(form.shopMapUrl.trim());

      const channels = [
        ...(form.lineId.trim()
          ? [{ id: "ch-line", type: "line", value: form.lineId.trim(), label: "LINE" }]
          : []),
        ...(form.phone.trim()
          ? [{ id: "ch-phone", type: "phone", value: form.phone.trim(), label: "โทร" }]
          : []),
      ];
      setContactChannels(channels);

      await fetch("/api/data/me/shop/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channels }),
      }).catch(() => {});

      startNavigation();
      router.push("/manage-shop");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "อัปโหลดรูปหรือบันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />
      <div className="relative z-10 flex flex-col flex-1">
      <UnifiedHeader />

      <main className="w-full max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        <h1 className="text-xl font-bold text-white">ลงทะเบียนร้าน</h1>
        <section className="rounded-xl app-glass p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-pink-950/50 flex items-center justify-center shrink-0">
              <ClipboardList size={24} className="text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ข้อมูลร้านและรูปภาพ</h2>
              <p className="text-slate-400 text-sm">
                กรอกข้อมูลร้านเบื้องต้น เมื่อเสร็จแล้วไปที่จัดการร้านค้าเพื่อเช่าที่และยืนยันตน
              </p>
            </div>
          </div>

          <p className="text-slate-400 text-xs mb-4 flex items-center gap-2">
            <Store size={14} />
            ลงทะเบียนในนามของ <span className="text-pink-300 font-medium">{displayName}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ชื่อร้าน */}
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-1.5">
                {REGISTER_FIELDS.shopName.label}
                {REGISTER_FIELDS.shopName.required && (
                  <span className="text-pink-400 ml-1">*</span>
                )}
              </label>
              <input
                type="text"
                value={form.shopName}
                onChange={(e) => update("shopName", e.target.value)}
                placeholder={REGISTER_FIELDS.shopName.placeholder}
                className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
              />
              {errors.shopName && (
                <p className="text-red-400 text-xs mt-1">{errors.shopName}</p>
              )}
            </div>

            {/* คำอธิบายร้าน */}
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-1.5">
                {REGISTER_FIELDS.description.label}
                {REGISTER_FIELDS.description.required && (
                  <span className="text-pink-400 ml-1">*</span>
                )}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder={REGISTER_FIELDS.description.placeholder}
                rows={3}
                className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 resize-y"
              />
              {errors.description && (
                <p className="text-red-400 text-xs mt-1">{errors.description}</p>
              )}
            </div>

            {/* โลโก้ + สีพื้นหลัง */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-pink-200 mb-1.5 flex items-center gap-2">
                  <ImageIcon size={14} />
                  {REGISTER_FIELDS.logoUrl.label}
                </label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFileSelect}
                />
                <div className="flex items-center gap-3">
                  {(logoPreviewUrl || form.logoUrl) ? (
                    <div
                      className="w-16 h-16 rounded-lg border border-pink-900/30 overflow-hidden bg-slate-800 shrink-0"
                      style={{ backgroundColor: form.logoBackgroundColor }}
                    >
                      <img
                        src={logoPreviewUrl || normalizeImageUrl(form.logoUrl) || ""}
                        alt="โลโก้ร้าน"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 border border-pink-900/30 text-pink-200 hover:bg-slate-700 hover:border-pink-500/40 transition-colors text-sm"
                  >
                    <Upload size={16} />
                    {logoPreviewUrl || form.logoUrl ? "เปลี่ยนรูป" : "เลือกรูป"}
                  </button>
                </div>
              </div>
              <div>
                <LogoBackgroundColorPicker
                  label={REGISTER_FIELDS.logoBackgroundColor.label}
                  value={form.logoBackgroundColor}
                  onChange={(v) => update("logoBackgroundColor", v)}
                  placeholder="กรุณากรอก (หากมี)"
                />
              </div>
            </div>

            {/* รูปคัฟเวอร์ */}
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-1.5 flex items-center gap-2">
                <ImageIcon size={14} />
                {REGISTER_FIELDS.coverUrl.label}
              </label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFileSelect}
              />
              {(coverPreviewUrl || form.coverUrl) ? (
                <div className="rounded-lg border border-pink-900/30 overflow-hidden bg-slate-800 mb-2">
                  <img
                    src={coverPreviewUrl || normalizeImageUrl(form.coverUrl) || ""}
                    alt="คัฟเวอร์ร้าน"
                    className="w-full h-32 object-cover"
                  />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 border border-pink-900/30 text-pink-200 hover:bg-slate-700 hover:border-pink-500/40 transition-colors text-sm"
              >
                <Upload size={16} />
                {coverPreviewUrl || form.coverUrl ? "เปลี่ยนรูป" : "เลือกรูปคัฟเวอร์"}
              </button>
            </div>

            {uploadError && (
              <p className="text-red-400 text-xs flex items-center gap-1">{uploadError}</p>
            )}

            {/* ที่อยู่ร้าน */}
            <div className="pt-2 border-t border-pink-900/20">
              <h3 className="text-sm font-medium text-pink-200 mb-3 flex items-center gap-2">
                <MapPin size={14} />
                ที่อยู่ร้าน
              </h3>
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={form.useSameAsUserAddress}
                  onChange={(e) => update("useSameAsUserAddress", e.target.checked)}
                  className="rounded border-pink-900/50 bg-slate-800 text-pink-500 focus:ring-pink-500"
                />
                <span className="text-slate-300 text-sm">ใช้ที่อยู่เดียวกับที่อยู่ตอนสมัคร</span>
              </label>
              {form.useSameAsUserAddress && userAddress && (userAddress.full_address || userAddress.map_url) && (
                <p className="text-slate-400 text-xs mb-2 bg-slate-800/50 rounded-lg px-3 py-2">
                  ที่อยู่ของคุณ: {userAddress.full_address || ""}
                  {userAddress.map_url && (
                    <a href={userAddress.map_url} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline block mt-1 truncate">
                      เปิดแผนที่
                    </a>
                  )}
                </p>
              )}
              {!form.useSameAsUserAddress && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">บ้านเลขที่ / หมู่ที่</label>
                    <input
                      type="text"
                      value={form.shopAddressLine1}
                      onChange={(e) => update("shopAddressLine1", e.target.value)}
                      className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                      placeholder="กรุณากรอก (หากมี)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">ซอย ถนน อาคาร ชั้น ห้อง</label>
                    <input
                      type="text"
                      value={form.shopAddressLine2}
                      onChange={(e) => update("shopAddressLine2", e.target.value)}
                      className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                      placeholder="กรุณากรอก (หากมี)"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">ตำบล / แขวง</label>
                      <input
                        type="text"
                        value={form.shopSubDistrict}
                        onChange={(e) => update("shopSubDistrict", e.target.value)}
                        className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                        placeholder="กรุณากรอก (หากมี)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">อำเภอ / เขต</label>
                      <input
                        type="text"
                        value={form.shopDistrict}
                        onChange={(e) => update("shopDistrict", e.target.value)}
                        className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                        placeholder="กรุณากรอก (หากมี)"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">จังหวัด</label>
                      <input
                        type="text"
                        value={form.shopProvince}
                        onChange={(e) => update("shopProvince", e.target.value)}
                        className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                        placeholder="กรุณากรอก (หากมี)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">รหัสไปรษณีย์</label>
                      <input
                        type="text"
                        value={form.shopPostalCode}
                        onChange={(e) => update("shopPostalCode", e.target.value)}
                        className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                        placeholder="กรุณากรอก (หากมี)"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">ลิงก์ Google Map (ถ้ามี)</label>
                    <input
                      type="url"
                      value={form.shopMapUrl}
                      onChange={(e) => update("shopMapUrl", e.target.value)}
                      className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                      placeholder="https://maps.app.goo.gl/..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ช่องทางติดต่อร้าน */}
            <div className="pt-2 border-t border-pink-900/20">
              <h3 className="text-sm font-medium text-pink-200 mb-3 flex items-center gap-2">
                <MessageCircle size={14} />
                ช่องทางติดต่อร้าน
              </h3>
              <p className="text-slate-400 text-xs mb-3">
                กรอกอย่างน้อยหนึ่งช่อง เพื่อให้ลูกค้าสามารถติดต่อร้านได้
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {REGISTER_FIELDS.lineId.label}
                  </label>
                  <input
                    type="text"
                    value={form.lineId}
                    onChange={(e) => update("lineId", e.target.value)}
                    placeholder={REGISTER_FIELDS.lineId.placeholder}
                    className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <Phone size={12} />
                    {REGISTER_FIELDS.phone.label}
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder={REGISTER_FIELDS.phone.placeholder}
                    className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                  />
                </div>
                {errors.contact && (
                  <p className="text-red-400 text-xs">{errors.contact}</p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <ClipboardList size={18} />
                    บันทึกและไปจัดการร้าน
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl app-glass p-4">
          <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Store size={14} />
            ขั้นตอนถัดไป
          </h3>
          <ul className="text-slate-400 text-sm space-y-2 list-disc list-inside">
            <li>ในหน้าจัดการร้านค้ามีปุ่ม <strong className="text-pink-300">เช่าที่</strong> สำหรับขอล็อคบนแผนที่</li>
            <li>ปุ่ม <strong className="text-pink-300">ยืนยันตนร้านค้า</strong> สำหรับส่งเอกสารยืนยันตัว (ดำเนินการภายหลัง)</li>
          </ul>
        </section>
      </main>
      </div>
    </div>
  );
}
