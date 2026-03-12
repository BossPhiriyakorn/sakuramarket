"use client";

import React from "react";
import Link from "next/link";
import { Store, Pencil, MapPin, Lock, ShoppingBag, Wallet, Megaphone, Link2, AlertCircle } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { normalizeImageUrl } from "@/lib/imageUrl";

export interface ShopCoverSectionProps {
  shopName: string;
  logoUrl: string | null;
  coverUrl: string | null;
  /** สีพื้นหลังรูปโปร (เมื่อรูปโปร่งใส) */
  logoBackgroundColor?: string;
  /** หน้าแรก: แสดงอย่างเดียว ไม่มีปุ่มอัพโหลด. ตั้งค่า: อัพรูปได้ในแท็บ ตั้งค่าต่างๆ */
  readOnly?: boolean;
  /** แสดงโล่ยืนยันร้านค้าเมื่อ verified */
  verificationStatus?: string;
  /** ผูกกระเป๋าแล้วหรือยัง — ใช้รับโอนคูปอง/รายรับ; ไม่ผูกจะโอนให้ร้านไม่ได้ */
  walletLinked?: boolean;
  onCoverUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** บล็อกจองล็อค/ขยายล็อค — อยู่ในการ์ดเดียวกับโปรไฟล์ */
  lockBlock?: {
    /** มีล็อคที่จองแล้ว (ใช้แสดงปุ่ม ขยายล็อค; หมดอายุ/หลุดล็อค = false → จองล็อค) */
    hasLock: boolean;
    /** รายการตำแหน่งล็อค (เช่น ["ห้อง1 ล็อค A 5"]) */
    lockLabels: string[];
    /** กดปุ่มจอง/ขยายล็อค */
    onBookLockClick: () => void;
    /** อนุญาตให้จองได้ (ลงทะเบียนร้าน + เลือกแพ็กเกจแล้ว) */
    canBookSlot: boolean;
    /** เหตุผลที่ยังจองไม่ได้ (null ถ้า canBookSlot) */
    bookSlotBlockReason: string | null;
    isLoading: boolean;
  };
}

export function ShopCoverSection({
  shopName,
  logoUrl,
  coverUrl,
  logoBackgroundColor,
  readOnly = true,
  verificationStatus,
  walletLinked,
  onCoverUpload,
  onLogoUpload,
  lockBlock,
}: ShopCoverSectionProps) {
  const shopVerified = verificationStatus === "verified";
  const logoBgStyle = logoBackgroundColor ? { backgroundColor: logoBackgroundColor } : undefined;
  const logoBgClass = !logoBackgroundColor ? "bg-slate-800" : "";
  const coverSrc = normalizeImageUrl(coverUrl);
  const logoSrc = normalizeImageUrl(logoUrl);
  return (
    <section className="rounded-xl overflow-hidden border border-pink-900/30 bg-slate-900/50">
      <div className="relative w-full aspect-[3/1] min-h-[120px] sm:min-h-[160px] bg-slate-800">
        {readOnly ? (
          <>
            {coverSrc ? (
              <img
                src={coverSrc}
                alt="รูปปกร้าน"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-pink-500/50 bg-gradient-to-b from-slate-800 to-slate-900">
                <span className="text-sm">รูปปก — แก้ไขได้ในแท็บ ตั้งค่า & จองล็อค</span>
              </div>
            )}
          </>
        ) : (
          <label className="absolute inset-0 cursor-pointer flex items-center justify-center group">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt="รูปปกร้าน"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-pink-500/50 group-hover:text-pink-400 transition-colors bg-gradient-to-b from-slate-800 to-slate-900">
                <span className="text-sm">อัพโหลดรูปปก</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onCoverUpload}
            />
          </label>
        )}
      </div>
      <div className="relative px-4 pb-4 pt-0">
        {/* รูปโปร + ชื่อร้านในพื้นที่เดียวกัน — ชื่อร้านอยู่ข้างรูป */}
        <div className="-mt-16 sm:-mt-20 flex flex-row items-end gap-4 sm:gap-5">
          {readOnly ? (
            <div
              className={`w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-slate-950 overflow-hidden shrink-0 shadow-xl ring-2 ring-pink-900/30 flex items-center justify-center ${logoBgClass}`}
              style={logoBgStyle}
            >
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt="รูปโปรร้าน"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-pink-500/50">
                  <Store size={28} />
                  <span className="text-xs">รูปโปร</span>
                </div>
              )}
            </div>
          ) : (
            <label
              className={`inline-block w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-slate-950 overflow-hidden shrink-0 cursor-pointer flex items-center justify-center shadow-xl ring-2 ring-pink-900/30 ${logoBgClass}`}
              style={logoBgStyle}
            >
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt="รูปโปรร้าน"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-pink-500/50">
                  <Store size={28} />
                  <span className="text-xs">รูปโปร</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogoUpload}
              />
            </label>
          )}
          <div className="flex-1 min-w-0 pb-1 sm:pb-2 space-y-1">
            <h2 className="text-lg sm:text-2xl font-bold text-white truncate flex items-center gap-2 flex-wrap">
              {shopName || "ชื่อร้าน"}
              {shopVerified && <VerifiedBadge variant="green" size={20} className="shrink-0" title="ร้านยืนยันแล้ว" />}
            </h2>
            {/* สถานะผูกกระเป๋า — ต้องผูกถึงจะโอนคูปอง/รายรับให้ร้านได้ */}
            {typeof walletLinked === "boolean" && (
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
                  walletLinked
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                }`}
                title={walletLinked ? "ผูกกระเป๋าแล้ว — ระบบโอนคูปอง/รายรับให้ร้านได้" : "ยังไม่ผูกกระเป๋า — ไปที่โปรไฟล์เพื่อผูกกระเป๋า แล้วระบบจะโอนคูปอง/รายรับให้ร้านได้"}
              >
                {walletLinked ? (
                  <>
                    <Link2 size={14} className="shrink-0" />
                    <span>ผูกกระเป๋าไว้</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} className="shrink-0" />
                    <span>ยังไม่ผูกกระเป๋า</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ปุ่มดำเนินการ — มือถือ 2x2, PC แถวเดียว ขนาดเท่ากัน */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Link
            href="/manage-shop/products"
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium text-sm transition-colors"
          >
            <Pencil size={16} className="shrink-0" />
            <span className="truncate">จัดการ & จองล็อค</span>
          </Link>
          <Link
            href="/tracking?tab=sender"
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium text-sm transition-colors"
          >
            <ShoppingBag size={16} className="shrink-0" />
            <span className="truncate">คำสั่งซื้อ</span>
          </Link>
          <Link
            href="/manage-shop/revenue"
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium text-sm transition-colors"
          >
            <Wallet size={16} className="shrink-0" />
            <span className="truncate">ตรวจสอบรายรับ</span>
          </Link>
          <Link
            href="/manage-shop/ad"
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium text-sm transition-colors"
          >
            <Megaphone size={16} className="shrink-0" />
            <span className="truncate">โฆษณา</span>
          </Link>
        </div>

        {/* จองล็อค/ขยายล็อค + แสดงล็อคตัวเอง — ในการ์ดเดียวกับโปรไฟล์ */}
        {lockBlock && (
          <div className="mt-4 pt-4 border-t border-pink-900/30">
            <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <MapPin size={14} />
              ล็อคในแผนที่
            </h3>
            {lockBlock.isLoading ? (
              <p className="text-slate-500 text-sm">กำลังโหลด...</p>
            ) : lockBlock.canBookSlot ? (
              <>
                {lockBlock.lockLabels.length > 0 && (
                  <p className="text-slate-300 text-sm mb-2">
                    ที่จองปัจจุบัน: {lockBlock.lockLabels.join(", ")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={lockBlock.onBookLockClick}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium text-sm transition-colors"
                >
                  <MapPin size={18} />
                  {lockBlock.hasLock ? "ขยายล็อค" : "จองล็อค"}
                </button>
                <p className="text-slate-500 text-xs mt-2">
                  {lockBlock.hasLock
                    ? "กดปุ่มด้านบนเพื่อจองล็อคเพิ่มในแผนที่"
                    : "กดปุ่มด้านบนเพื่อเปิดแผนที่และเลือกตำแหน่งล็อค"}
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                  <Lock size={18} className="text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-300 text-sm font-medium">ฟีเจอร์นี้ยังถูกล็อคอยู่</p>
                    <p className="text-amber-400 text-xs">{lockBlock.bookSlotBlockReason}</p>
                  </div>
                </div>
                {!lockBlock.hasLock && (
                  <p className="text-slate-500 text-xs">
                    ลงทะเบียนร้านค้าและเลือกแพ็กเกจแล้วจึงจองล็อคได้
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
