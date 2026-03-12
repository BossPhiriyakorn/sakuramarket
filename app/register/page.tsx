"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Loader2, Mail, MapPin, Eye, EyeOff } from "lucide-react";
import { SearchableSelect, type OptionItem } from "@/components/SearchableSelect";

/** ข้อความตัวอย่าง — แทนที่ด้วยข้อความจริงจาก legal */
const TERMS_PLACEHOLDER = `ข้อกำหนดการใช้งาน (Terms of Service)

กรุณาอ่านข้อกำหนดการใช้งานของ Sakura Market อย่างละเอียดก่อนสมัครสมาชิก

1. การยอมรับข้อกำหนด
   การใช้งานบริการถือว่าคุณได้อ่าน เข้าใจ และยอมรับข้อกำหนดนี้

2. บริการ
   เราให้บริการแพลตฟอร์ม marketplace สำหรับการซื้อขายและจัดส่งสินค้า

3. บัญชีผู้ใช้
   คุณต้องให้ข้อมูลที่ถูกต้องและรับผิดชอบต่อการรักษาความลับของรหัสผ่าน

4. การใช้งานที่ห้าม
   ห้ามใช้บริการเพื่อกิจกรรมที่ผิดกฎหมาย หรือละเมิดสิทธิของผู้อื่น

... (เนื้อหาเต็มให้ใส่ในระบบหรือไฟล์แยก) ...

เมื่อเลื่อนอ่านจนจบแล้ว กรุณากดปุ่ม "ตกลง" ด้านล่างเพื่อยืนยันการยอมรับ`;
const PRIVACY_PLACEHOLDER = `นโยบายความเป็นส่วนตัว (Privacy Policy)

Sakura Market ให้ความสำคัญกับการปกป้องข้อมูลส่วนบุคคลของคุณ

1. ข้อมูลที่เรารวบรวม
   เราเก็บข้อมูลที่คุณให้ตอนสมัครและใช้งาน เช่น ชื่อ อีเมล เบอร์โทร ที่อยู่

2. การใช้ข้อมูล
   เราใช้ข้อมูลเพื่อให้บริการ จัดส่งสินค้า และติดต่อคุณ

3. การเปิดเผยข้อมูล
   เราไม่ขายข้อมูลของคุณให้บุคคลที่สาม โดยไม่ได้รับความยินยอม

4. ความปลอดภัย
   เราใช้มาตรการที่เหมาะสมเพื่อรักษาความปลอดภัยของข้อมูล

... (เนื้อหาเต็มให้ใส่ในระบบหรือไฟล์แยก) ...

เมื่อเลื่อนอ่านจนจบแล้ว กรุณากดปุ่ม "ตกลง" ด้านล่างเพื่อยืนยันการยอมรับ`;

type ConsentModalType = "terms" | "privacy" | null;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    otpCode: "",
    firstName: "",
    lastName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    province: "",
    district: "",
    subDistrict: "",
    postalCode: "",
    mapUrl: "",
    recipientName: "",
    addressPhone: "",
  });
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [_otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [consentModal, setConsentModal] = useState<ConsentModalType>(null);
  const [scrollReachedEnd, setScrollReachedEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sameAsAbove, setSameAsAbove] = useState(false);
  const [provinces, setProvinces] = useState<OptionItem[]>([]);
  const [districts, setDistricts] = useState<OptionItem[]>([]);
  const [subDistricts, setSubDistricts] = useState<OptionItem[]>([]);
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);

  const update = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError("");
  };

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  useEffect(() => {
    fetch("/api/data/thailand/provinces")
      .then((r) => r.json())
      .then((data) => setProvinces(data.provinces ?? []))
      .catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    if (provinceId == null) {
      setDistricts([]);
      return;
    }
    fetch(`/api/data/thailand/districts?province_id=${provinceId}`)
      .then((r) => r.json())
      .then((data) => setDistricts(data.districts ?? []))
      .catch(() => setDistricts([]));
  }, [provinceId]);

  useEffect(() => {
    if (districtId == null) {
      setSubDistricts([]);
      return;
    }
    fetch(`/api/data/thailand/sub-districts?district_id=${districtId}`)
      .then((r) => r.json())
      .then((data) => setSubDistricts(data.sub_districts ?? []))
      .catch(() => setSubDistricts([]));
  }, [districtId]);

  const onScrollConsent = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const threshold = 20;
    setScrollReachedEnd(scrollTop + clientHeight >= scrollHeight - threshold);
  }, []);

  const openConsentModal = (type: ConsentModalType) => {
    setConsentModal(type);
    setScrollReachedEnd(false);
    setTimeout(() => onScrollConsent(), 100);
  };

  const closeConsentModal = () => {
    setConsentModal(null);
  };

  const confirmConsent = () => {
    if (consentModal === "terms") setTermsAccepted(true);
    if (consentModal === "privacy") setPrivacyAccepted(true);
    closeConsentModal();
  };

  useEffect(() => {
    if (!sameAsAbove) return;
    setForm((prev) => {
      const name = [prev.firstName.trim(), prev.lastName.trim()].filter(Boolean).join(" ");
      return { ...prev, recipientName: name, addressPhone: prev.phone };
    });
  }, [sameAsAbove, form.firstName, form.lastName, form.phone]);

  const handleRequestOtp = async () => {
    const email = form.email.trim();
    if (!email) {
      setError("กรุณากรอกอีเมลก่อนขอ OTP");
      return;
    }
    if (!form.firstName.trim()) {
      setError("กรุณากรอกชื่อ");
      return;
    }
    if (!form.lastName.trim()) {
      setError("กรุณากรอกนามสกุล");
      return;
    }
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) {
      setError("กรุณากรอกเบอร์โทรศัพท์ 10 หลัก");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (form.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (!termsAccepted) {
      setError("กรุณายอมรับข้อกำหนดการใช้งาน");
      return;
    }
    if (!privacyAccepted) {
      setError("กรุณายอมรับนโยบายความเป็นส่วนตัว");
      return;
    }
    setError("");
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ส่ง OTP ไม่สำเร็จ");
        if (data.cooldownSeconds) setCooldownSeconds(data.cooldownSeconds);
        return;
      }
      setOtpSent(true);
      setStep(2);
      setCooldownSeconds(data.cooldownSeconds ?? 300);
    } catch {
      setError("ส่ง OTP ไม่สำเร็จ");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (form.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (!form.otpCode.trim()) {
      setError("กรุณาขอ OTP แล้วกรอกรหัสที่ส่งไปยังอีเมล");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          otpCode: form.otpCode.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.replace(/\D/g, "").slice(0, 10),
          termsAccepted: true,
          privacyAccepted: true,
          address: (() => {
            const parts = [
              form.addressLine1.trim(),
              form.addressLine2.trim(),
              form.province.trim(),
              form.district.trim(),
              form.subDistrict.trim(),
              form.postalCode.trim(),
            ].filter(Boolean);
            const hasAddress = parts.length > 0 || form.mapUrl.trim();
            if (!hasAddress) return undefined;
            return {
              full_address: parts.length > 0 ? parts.join(", ") : undefined,
              map_url: form.mapUrl.trim() || undefined,
              recipient_name: form.recipientName.trim() || undefined,
              phone: form.addressPhone.trim() || undefined,
              address_line1: form.addressLine1.trim() || undefined,
              address_line2: form.addressLine2.trim() || undefined,
              sub_district: form.subDistrict.trim() || undefined,
              district: form.district.trim() || undefined,
              province: form.province.trim() || undefined,
              postal_code: form.postalCode.trim() || undefined,
              country: undefined,
            };
          })(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ลงทะเบียนไม่สำเร็จ");
        return;
      }
      // รอเช็ค session 1 รอบก่อนเปลี่ยนหน้า — ลดโอกาส bounce loop บนมือถือ
      await fetch("/api/auth/me", { credentials: "include" }).catch(() => null);
      router.replace("/map");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const consentContent = consentModal === "terms" ? TERMS_PLACEHOLDER : consentModal === "privacy" ? PRIVACY_PLACEHOLDER : "";
  const consentTitle = consentModal === "terms" ? "ข้อกำหนดการใช้งาน" : consentModal === "privacy" ? "นโยบายความเป็นส่วนตัว" : "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-pink-500/20 px-4 py-3 flex items-center gap-2">
        <Link
          href="/login"
          className="flex items-center gap-2 text-pink-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          กลับ
        </Link>
        <h1 className="text-lg font-bold text-white">Sakura Market</h1>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-6 text-pink-400">
            <UserPlus size={24} />
            <h2 className="text-xl font-bold">สมัครสมาชิก (1/2)</h2>
          </div>

          {step === 1 ? (
            <>
              <form
                onSubmit={(e) => { e.preventDefault(); handleRequestOtp(); }}
                className="rounded-xl border border-pink-900/30 bg-slate-900/40 p-6 space-y-4"
              >
                {error && (
                  <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    ชื่อผู้ใช้ (ยูสเซอร์เนม) <span className="text-pink-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => update("username", e.target.value)}
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    placeholder="กรุณากรอก"
                    required
                    minLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    อีเมล <span className="text-pink-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    placeholder="กรุณากรอก"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">ชื่อ <span className="text-pink-400">*</span></label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => update("firstName", e.target.value)}
                      className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                      placeholder="กรุณากรอก"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">นามสกุล <span className="text-pink-400">*</span></label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => update("lastName", e.target.value)}
                      className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                      placeholder="กรุณากรอก"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">เบอร์โทรศัพท์ <span className="text-pink-400">*</span></label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    placeholder="กรุณากรอก 10 หลัก"
                    maxLength={10}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">ตัวเลขเท่านั้น ไม่เกิน 10 หลัก</p>
                </div>
                <div className="pt-2 border-t border-pink-900/20">
                  <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <MapPin size={16} />
                    ที่อยู่
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">บ้านเลขที่ / หมู่ที่</label>
                      <input
                        type="text"
                        value={form.addressLine1}
                        onChange={(e) => update("addressLine1", e.target.value)}
                        className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm"
                        placeholder="กรุณากรอก (หากมี)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">ซอย ถนน อาคาร ชั้น ห้อง</label>
                      <input
                        type="text"
                        value={form.addressLine2}
                        onChange={(e) => update("addressLine2", e.target.value)}
                        className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm"
                        placeholder="กรุณากรอก (หากมี)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">จังหวัด</label>
                      <SearchableSelect
                        options={provinces}
                        value={form.province}
                        onChange={(name_th, id) => {
                          update("province", name_th);
                          setProvinceId(id);
                          update("district", "");
                          update("subDistrict", "");
                          update("postalCode", "");
                          setDistrictId(null);
                        }}
                        placeholder="เลือกหรือพิมพ์ค้นหาจังหวัด"
                        className="w-full"
                        inputClassName="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">อำเภอ / เขต</label>
                        <SearchableSelect
                          options={districts}
                          value={form.district}
                          onChange={(name_th, id) => {
                            update("district", name_th);
                            setDistrictId(id);
                            update("subDistrict", "");
                            update("postalCode", "");
                          }}
                          placeholder="เลือกจังหวัดก่อน"
                          disabled={provinceId == null}
                          className="w-full"
                          inputClassName="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm disabled:opacity-70"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">ตำบล / แขวง</label>
                        <SearchableSelect
                          options={subDistricts}
                          value={form.subDistrict}
                          onChange={(name_th, _id, extra) => {
                            update("subDistrict", name_th);
                            if (extra?.zip_code !== undefined) update("postalCode", String(extra.zip_code));
                          }}
                          placeholder="เลือกอำเภอก่อน"
                          disabled={districtId == null}
                          className="w-full"
                          inputClassName="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm disabled:opacity-70"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">รหัสไปรษณีย์</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={form.postalCode}
                        onChange={(e) => update("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
                        className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm"
                        placeholder="กรุณากรอก (หากมี)"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">ลิงก์ Google Map (ถ้ามี)</label>
                      <input
                        type="url"
                        value={form.mapUrl}
                        onChange={(e) => update("mapUrl", e.target.value)}
                        className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm"
                        placeholder="https://maps.app.goo.gl/..."
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameAsAbove}
                        onChange={(e) => setSameAsAbove(e.target.checked)}
                        className="rounded border-pink-900/50 bg-slate-800 text-pink-500 focus:ring-pink-500"
                      />
                      <span className="text-xs text-slate-400">ใช้ชื่อผู้รับและเบอร์ติดต่อเหมือนข้อมูลข้างบน</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">ชื่อผู้รับ (สำหรับจัดส่ง)</label>
                        <input
                          type="text"
                          value={form.recipientName}
                          onChange={(e) => update("recipientName", e.target.value)}
                          readOnly={sameAsAbove}
                          className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm disabled:opacity-70"
                          placeholder="กรุณากรอก (หากมี)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">เบอร์ติดต่อที่อยู่</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={form.addressPhone}
                          onChange={(e) => update("addressPhone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                          readOnly={sameAsAbove}
                          className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm disabled:opacity-70"
                          placeholder="กรุณากรอก (หากมี)"
                          maxLength={10}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    รหัสผ่าน <span className="text-pink-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      className="w-full rounded-lg border border-pink-900/30 bg-slate-800 pl-3 pr-10 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                      placeholder="กรุณากรอก"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded"
                      aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    ยืนยันรหัสผ่าน <span className="text-pink-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => update("confirmPassword", e.target.value)}
                      className="w-full rounded-lg border border-pink-900/30 bg-slate-800 pl-3 pr-10 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                      placeholder="กรุณากรอก"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded"
                      aria-label={showConfirmPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      readOnly
                      className="mt-1 rounded border-pink-900/50 bg-slate-800 text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-sm text-slate-300">
                      ฉันได้อ่านและยอมรับ{" "}
                      <button
                        type="button"
                        onClick={() => openConsentModal("terms")}
                        className="text-pink-400 hover:text-pink-300 underline"
                      >
                        ข้อกำหนดการใช้งาน
                      </button>
                      {termsAccepted && <span className="text-emerald-400 ml-1">✓</span>}
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      readOnly
                      className="mt-1 rounded border-pink-900/50 bg-slate-800 text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-sm text-slate-300">
                      ฉันได้อ่านและยอมรับ{" "}
                      <button
                        type="button"
                        onClick={() => openConsentModal("privacy")}
                        className="text-pink-400 hover:text-pink-300 underline"
                      >
                        นโยบายความเป็นส่วนตัว
                      </button>
                      {privacyAccepted && <span className="text-emerald-400 ml-1">✓</span>}
                    </span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={otpLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {otpLoading ? <Loader2 size={20} className="animate-spin" /> : "ดำเนินการต่อ (ขอรับ OTP)"}
                </button>
              </form>
              <p className="mt-4 text-center text-slate-400 text-sm">
                มีบัญชีอยู่แล้ว?{" "}
                <Link href="/login" className="text-pink-400 hover:text-pink-300">
                  เข้าสู่ระบบ
                </Link>
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-pink-900/30 bg-slate-900/40 p-6 space-y-6">
              <div className="text-center">
                <Mail className="mx-auto h-12 w-12 text-pink-400 mb-3" />
                <h3 className="text-lg font-medium text-white">ยืนยันรหัส OTP</h3>
                <p className="text-sm text-slate-400 mt-1">
                  รหัสถูกส่งไปยัง <span className="text-pink-300 font-medium">{form.email}</span>
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2 text-center">
                  {error}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={form.otpCode}
                    onChange={(e) => update("otpCode", e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="w-full text-center text-2xl tracking-[0.5em] rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-mono"
                    placeholder="XXXXXX"
                    maxLength={8}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || form.otpCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "ยืนยันและเข้าสู่ระบบ"}
                </button>
              </form>

              <div className="text-center pt-4 border-t border-pink-900/20">
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={otpLoading || cooldownSeconds > 0}
                  className="text-sm text-pink-400 hover:text-pink-300 disabled:text-slate-500 transition-colors"
                >
                  {otpLoading ? (
                    <span className="flex items-center justify-center gap-1.5"><Loader2 size={14} className="animate-spin" /> กำลังส่งใหม่...</span>
                  ) : cooldownSeconds > 0 ? (
                    `ส่งรหัสใหม่ได้ใน ${cooldownSeconds} วินาที`
                  ) : (
                    "ยังไม่ได้รับรหัส? ขอ OTP ใหม่"
                  )}
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-400 hover:text-white underline mt-2"
                >
                  ย้อนกลับไปแก้ไขข้อมูล
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal ข้อกำหนด / นโยบาย — ต้องเลื่อนอ่านจนจบถึงกดตกลงได้ */}
      {consentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-pink-900/30 rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-pink-900/30 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white">{consentTitle}</h3>
            </div>
            <div
              ref={scrollRef}
              onScroll={onScrollConsent}
              className="flex-1 overflow-y-auto p-4 text-slate-300 text-sm whitespace-pre-wrap"
            >
              {consentContent}
            </div>
            <div className="p-4 border-t border-pink-900/30 flex-shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeConsentModal}
                className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={confirmConsent}
                disabled={!scrollReachedEnd}
                className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
