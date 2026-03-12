"use client";

import React, { useEffect, useCallback } from "react";
import Link from "next/link";
import { useStore } from "@/store";
import { useFollowStore } from "@/store/followStore";
import { X, Heart, Store, Loader2 } from "lucide-react";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

interface FollowingSlideOutProps {
  open: boolean;
  onClose: () => void;
}

export function FollowingSlideOut({ open, onClose }: FollowingSlideOutProps) {
  const parcels = useStore((s) => s.parcels);
  const fetchParcels = useStore((s) => s.fetchParcels);
  const followedShopIds = useFollowStore((s) => s.followedShopIds);
  const setFollowedShopIds = useFollowStore((s) => s.setFollowedShopIds);
  const _loadFollows = useFollowStore((s) => s.loadFollows);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    fetch("/api/data/me/follows", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { followedParcelIds?: string[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        const ids = Array.isArray(data.followedParcelIds) ? data.followedParcelIds : [];
        setFollowedShopIds(ids);
        fetchParcels();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [open, setFollowedShopIds, fetchParcels]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const followedParcels = parcels.filter(
    (p) => !p.is_label && followedShopIds.includes(p.id)
  );

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity pointer-events-auto"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-md app-glass border-l border-white/10 shadow-2xl z-50 flex flex-col animate-slide-in-from-right pointer-events-auto safe-top"
        role="dialog"
        aria-label="การติดตาม"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Heart size={22} className="text-pink-400" />
            <h2 className="text-lg font-bold text-white">การติดตาม</h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-lg text-pink-400 hover:bg-pink-950/30 hover:text-white transition-colors"
            aria-label="ปิด"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-pink-300/70 px-4 pt-2 pb-3 shrink-0">
          ร้านค้าที่คุณติดตาม
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-sm px-3 py-2 mb-3 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => loadData()}
                className="shrink-0 px-2 py-1 rounded-lg bg-red-800/50 hover:bg-red-700/50 text-red-200 text-xs font-medium"
              >
                ลองอีกครั้ง
              </button>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="text-pink-400 animate-spin" />
            </div>
          ) : followedParcels.length === 0 ? (
            <div className="rounded-xl app-glass-subtle p-6 text-center">
              <Heart size={40} className="mx-auto text-pink-500/50 mb-3" />
              <p className="text-slate-400 text-sm mb-2">ยังไม่มีร้านที่ติดตาม</p>
              <p className="text-slate-500 text-xs mb-4">
                กดปุ่ม &quot;ติดตาม&quot; ที่หน้าร้านหรือในสไลด์ร้านค้า
              </p>
              <Link
                href="/map"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors"
              >
                <Store size={16} />
                ไปดูแผนที่
              </Link>
            </div>
          ) : (
            <ul className="space-y-3 pb-2">
              {followedParcels.map((parcel) => (
                <li key={parcel.id}>
                  <Link
                    href={`/shop/${parcel.id}`}
                    onClick={onClose}
                    className="block rounded-xl app-glass-subtle overflow-hidden p-4 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                        <img
                          src={parcel.image_url ? getDriveImageDisplayUrl(parcel.image_url) : "https://via.placeholder.com/48?text=Shop"}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{parcel.title}</h3>
                        <p className="text-slate-400 text-xs break-words min-w-0">{parcel.description}</p>
                      </div>
                      <span className="text-pink-400 text-sm font-medium shrink-0">เข้าร้าน</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-white/10 shrink-0 safe-bottom">
          <Link
            href="/following"
            onClick={onClose}
            className="block w-full text-center py-2.5 rounded-lg bg-pink-600/20 border border-pink-500/30 text-pink-300 hover:bg-pink-600/30 text-sm font-medium transition-colors"
          >
            ดูทั้งหมดในหน้าการติดตาม
          </Link>
        </div>
      </aside>
    </>
  );
}
