"use client";

import dynamic from "next/dynamic";
import { MapErrorBoundary } from "@/components/MapErrorBoundary";
import { LoadingImage } from "@/components/LoadingImage";

/**
 * หน้าแผนที่ — แสดงเมื่อผู้ใช้ล็อกอินแล้ว (middleware ส่ง user มาที่ /map)
 * ไม่ใช้ Suspense + useSearchParams — เพราะบังคับ Next.js ใช้ streaming (dynamic rendering)
 */
const MapView = dynamic(() => import("@/App"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-[100dvh] bg-slate-950">
      <LoadingImage message="กำลังโหลดแผนที่..." size={80} />
    </div>
  ),
});

export default function MapPage() {
  return (
    <MapErrorBoundary>
      <MapView />
    </MapErrorBoundary>
  );
}
