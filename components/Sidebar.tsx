"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "../store";
import { useFollowStore } from "../store/followStore";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { OnlineBadge } from "@/components/OnlineBadge";
import { X, MapPin, Store, Heart, Phone, Settings, Globe, Facebook, Instagram } from "lucide-react";
import { normalizeImageUrl } from "@/lib/imageUrl";

export const Sidebar = () => {
  const selectedParcelId = useStore((state) => state.selectedParcelId);
  const parcels = useStore((state) => state.parcels);
  const selectParcel = useStore((state) => state.selectParcel);
  const followedShopIds = useFollowStore((s) => s.followedShopIds);
  const loadFollows = useFollowStore((s) => s.loadFollows);
  const toggleFollow = useFollowStore((s) => s.toggle);

  const [sidebarShopId, setSidebarShopId] = useState<string | null>(null);
  const [shopOwnerId, setShopOwnerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [contactChannels, setContactChannels] = useState<{ type: string; value: string; label: string | null }[]>([]);
  const [ownerLastSeenAt, setOwnerLastSeenAt] = useState<string | null>(null);

  const parcel = parcels.find((p) => p.id === selectedParcelId);
  const isShop = parcel && !parcel.is_label;
  const parcelId = parcel?.id ?? "";
  const following = isShop && parcelId !== "" && followedShopIds.includes(parcelId);
  const shopVerified = isShop && (parcel as { verification_status?: string })?.verification_status === "verified";
  const ownerVerified = (parcel as { owner_verified?: boolean })?.owner_verified === true;

  useEffect(() => {
    loadFollows();
  }, [loadFollows]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          window.location.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((data: { user?: { id?: string } } | null) => {
        if (data == null) return;
        const id = data?.user?.id;
        if (typeof id !== "string" || !id.trim()) {
          window.location.replace("/login");
          return;
        }
        setCurrentUserId(id);
      })
      .catch(() => setCurrentUserId(null));
  }, []);

  useEffect(() => {
    if (!isShop || !selectedParcelId) {
      setSidebarShopId(null);
      setShopOwnerId(null);
      setContactChannels([]);
      setOwnerLastSeenAt(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/data/parcels/${selectedParcelId}/shop`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.shop?.id) {
          setSidebarShopId(data.shop.id);
          const uid = data.shop?.user_id;
          setShopOwnerId(typeof uid === "string" ? uid : null);
        }
        if (!cancelled) {
          setContactChannels(Array.isArray(data.contact_channels) ? data.contact_channels : []);
          setOwnerLastSeenAt(typeof data.owner_last_seen_at === "string" ? data.owner_last_seen_at : null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedParcelId, isShop]);

  if (!parcel) return null;

  return (
    <div className="w-full sm:w-96 max-w-[92vw] app-glass h-full border-l border-white/10 shadow-2xl p-4 sm:p-6 overflow-y-auto overflow-x-hidden safe-bottom pointer-events-auto transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-xs font-bold tracking-wider text-pink-400 uppercase">
            Parcel Details
          </span>
          <h2 className="text-2xl font-bold text-white mt-1 flex items-center gap-2 flex-wrap">
            {parcel.title}
            {shopVerified && <VerifiedBadge variant="green" size={24} title="ร้านยืนยันแล้ว" />}
          </h2>
        </div>
        <button
          onClick={() => selectParcel(null)}
          className="p-2 hover:bg-pink-950/30 rounded-full transition-colors"
        >
          <X size={20} className="text-pink-400 hover:text-white" />
        </button>
      </div>

      {/* Image */}
      <div className="w-full aspect-square rounded-xl overflow-hidden app-glass-subtle mb-6 shadow-inner group relative">
        <img
          src={
            normalizeImageUrl(parcel.image_url) ||
            "https://via.placeholder.com/400x400?text=Sakura+Plot"
          }
          alt={parcel.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>

      {/* ที่อยู่ */}
      <div className="mb-6">
        <div className="app-glass-subtle p-3 rounded-lg">
          <div className="flex items-center text-pink-300/50 text-xs mb-1">
            <MapPin size={12} className="mr-1" />
            <span>ที่อยู่</span>
          </div>
          <div className="text-white font-mono text-sm">
            แถว {parcel.grid_y + 1} · คอลัมน์{" "}
            {String.fromCharCode(65 + (parcel.grid_x % 26))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-pink-200 mb-2">Description</h3>
        <p className="text-pink-100/60 text-sm leading-relaxed">
          {parcel.description}
        </p>
      </div>

      {/* Owner Info */}
      <div className="flex items-center p-4 app-glass-subtle rounded-lg mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-lg overflow-hidden shrink-0">
          {parcel.owner_avatar_url ? (
            <img
              src={normalizeImageUrl(parcel.owner_avatar_url) ?? ""}
              alt={parcel.owner_display_name ?? "owner"}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                const fallback = target.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          ) : null}
          <span
            className="w-full h-full flex items-center justify-center"
            style={{ display: parcel.owner_avatar_url ? "none" : "flex" }}
          >
            {(parcel.owner_display_name ?? parcel.owner_id).charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="ml-3 overflow-hidden flex-1 min-w-0">
          <div className="text-xs text-pink-300/50">Owner</div>
          <div className="text-sm font-medium text-white truncate flex items-center gap-2">
            {parcel.owner_display_name ?? parcel.owner_id}
            {ownerVerified && <VerifiedBadge variant="blue" size={18} title="ยืนยันตัวตนแล้ว" />}
          </div>
          <OnlineBadge lastSeenAt={ownerLastSeenAt} className="mt-0.5" />
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {isShop && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFollow(parcelId, sidebarShopId ?? undefined);
            }}
            className={`flex items-center justify-center w-full py-3 rounded-lg font-medium transition-colors border cursor-pointer select-none ${
              following
                ? "bg-pink-950/50 border-pink-500/50 text-pink-300 hover:bg-pink-950/70"
                : "app-glass-subtle hover:bg-white/10 text-pink-200"
            }`}
            aria-pressed={following}
            aria-label={following ? "ยกเลิกติดตามร้าน" : "ติดตามร้าน"}
          >
            <Heart
              size={16}
              className={`mr-2 shrink-0 ${following ? "fill-pink-400" : ""}`}
            />
            {following ? "ยกเลิกติดตาม" : "ติดตาม"}
          </button>
        )}

        {/* ปุ่ม LINE */}
        {(() => {
          const lineChannel = contactChannels.find((c) => c.type === "line");
          if (!lineChannel?.value) return null;
          const lineValue = lineChannel.value.trim();
          const lineHref = lineValue.startsWith("http")
            ? lineValue
            : `https://line.me/ti/p/~${lineValue.replace(/^@/, "")}`;
          return (
            <a
              href={lineHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full py-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-900/20"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2 fill-white shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.477 2 2 6.145 2 11.25c0 4.471 3.138 8.226 7.438 9.188.343.074.469.252.344.469l-.469 1.688c-.063.25.125.375.344.25C14.282 20.782 22 15.938 22 11.25 22 6.145 17.523 2 12 2z"/>
              </svg>
              LINE
            </a>
          );
        })()}

        {/* ปุ่มโทร */}
        {(() => {
          const phoneChannel = contactChannels.find((c) => c.type === "phone");
          if (!phoneChannel?.value) return null;
          return (
            <a
              href={`tel:${phoneChannel.value.trim()}`}
              className="flex items-center justify-center w-full py-3 app-glass-subtle hover:bg-white/10 text-pink-200 rounded-lg font-medium transition-colors"
            >
              <Phone size={16} className="mr-2 shrink-0" />
              โทร
            </a>
          );
        })()}

        {/* ปุ่มเว็บไซต์ */}
        {(() => {
          const ch = contactChannels.find((c) => c.type === "website");
          if (!ch?.value?.trim()) return null;
          let href = ch.value.trim();
          if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full py-3 app-glass-subtle hover:bg-white/10 text-pink-200 rounded-lg font-medium transition-colors"
            >
              <Globe size={16} className="mr-2 shrink-0" />
              เว็บไซต์
            </a>
          );
        })()}

        {/* ปุ่มเฟสบุค */}
        {(() => {
          const ch = contactChannels.find((c) => c.type === "facebook");
          if (!ch?.value?.trim()) return null;
          const v = ch.value.trim().replace(/^@/, "").split("/").pop() ?? ch.value.trim();
          const href = v.startsWith("http") ? v : `https://facebook.com/${v}`;
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full py-3 bg-[#1877F2]/80 hover:bg-[#1877F2] text-white rounded-lg font-medium transition-colors"
            >
              <Facebook size={16} className="mr-2 shrink-0" />
              เฟสบุค
            </a>
          );
        })()}

        {/* ปุ่มไอจี */}
        {(() => {
          const ch = contactChannels.find((c) => c.type === "instagram");
          if (!ch?.value?.trim()) return null;
          const v = ch.value.trim().replace(/^@/, "").split("/").pop() ?? ch.value.trim();
          const href = v.startsWith("http") ? v : `https://instagram.com/${v}`;
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full py-3 bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90 text-white rounded-lg font-medium transition-colors"
            >
              <Instagram size={16} className="mr-2 shrink-0" />
              ไอจี
            </a>
          );
        })()}

        {isShop && (
          currentUserId && shopOwnerId && currentUserId === shopOwnerId ? (
            <Link
              href="/manage-shop"
              className="flex items-center justify-center w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-pink-900/20"
            >
              <Settings size={16} className="mr-2" />
              จัดการร้านค้า
            </Link>
          ) : (
            <Link
              href={`/shop/${parcel.id}`}
              className="flex items-center justify-center w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-pink-900/20"
            >
              <Store size={16} className="mr-2" />
              เข้าดูร้าน
            </Link>
          )
        )}
      </div>
    </div>
  );
};
