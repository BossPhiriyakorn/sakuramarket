"use client";

import React, { useEffect, useCallback } from "react";
import Link from "next/link";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { Heart, Store, Loader2 } from "lucide-react";
import { useFollowStore } from "@/store/followStore";
import { useStore } from "@/store";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

export default function FollowingPage() {
  const followedShopIds = useFollowStore((s) => s.followedShopIds);
  const setFollowedShopIds = useFollowStore((s) => s.setFollowedShopIds);
  const parcels = useStore((s) => s.parcels);
  const fetchParcels = useStore((s) => s.fetchParcels);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = useCallback(() => {
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
  }, [setFollowedShopIds, fetchParcels]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const followedParcels = parcels.filter(
    (p) => !p.is_label && followedShopIds.includes(p.id)
  );

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />
      <UnifiedHeader />

      <main className="relative z-10 w-full max-w-2xl mx-auto p-4 md:p-6 flex-1">
        <h1 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
          <Heart size={22} className="text-pink-400 shrink-0" />
          การติดตาม
        </h1>
        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-sm px-4 py-3 flex flex-wrap items-center justify-between gap-2 mb-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadData()}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-red-800/50 hover:bg-red-700/50 text-red-200 font-medium text-sm transition-colors"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-pink-400 animate-spin" />
          </div>
        ) : followedShopIds.length === 0 ? (
          <div className="rounded-xl app-glass p-8 text-center">
            <Heart size={48} className="mx-auto text-pink-500/50 mb-4" />
            <p className="text-slate-400 mb-2">ยังไม่มีร้านที่ติดตาม</p>
            <p className="text-slate-500 text-sm mb-6">
              กดปุ่ม &quot;ติดตาม&quot; ที่หน้าร้านหรือในสไลด์ร้านค้าเพื่อเพิ่มร้านที่สนใจ
            </p>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium text-sm transition-colors"
            >
              <Store size={18} />
              ไปดูแผนที่
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {followedParcels.map((parcel) => (
              <li
                key={parcel.id}
                className="rounded-xl app-glass overflow-hidden flex items-center gap-4 p-4"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                  <img
                    src={parcel.image_url ? getDriveImageDisplayUrl(parcel.image_url) : "https://via.placeholder.com/64?text=Shop"}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-white truncate">
                    {parcel.title}
                  </h2>
                  <p className="text-slate-400 text-sm truncate">
                    {parcel.description}
                  </p>
                </div>
                <Link
                  href={`/shop/${parcel.id}`}
                  className="shrink-0 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors"
                >
                  เข้าร้าน
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
