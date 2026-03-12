"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * หน้าแรก (/) — middleware จะ redirect ตาม session อยู่แล้ว:
 * - มี cookie ผู้ใช้ → /map
 * - มี cookie แอดมิน → /admin
 * - ไม่มี/ไม่ถูกต้อง → /login
 * ถ้าโหลดมาที่นี่โดยไม่ redirect (เช่น client nav) ส่งไป /login
 */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <p className="text-white/70">กำลังนำทาง...</p>
    </div>
  );
}
