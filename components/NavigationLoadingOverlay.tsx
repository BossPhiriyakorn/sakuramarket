"use client";

import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { LoadingImage } from "@/components/LoadingImage";

type NavigationLoadingContextValue = {
  startNavigation: () => void;
};

const NavigationLoadingContext = createContext<NavigationLoadingContextValue | null>(null);

export function useNavigationLoading() {
  const ctx = useContext(NavigationLoadingContext);
  return ctx ?? { startNavigation: () => {} };
}

/**
 * แสดงป๊อปอัปโหลดเมื่อมีการเปลี่ยนหน้า (คลิกลิงก์หรือกดเมนูที่ใช้ router.push)
 * ซ้อนแอป แสดง "กำลังโหลด..." จน pathname เปลี่ยน
 */
function OverlayPop({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="กำลังโหลด"
    >
      <div className="rounded-2xl bg-slate-900/95 border border-pink-900/30 p-6 shadow-xl">
        <LoadingImage message="กำลังโหลด..." size={80} />
      </div>
    </div>
  );
}

export function NavigationLoadingOverlay({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  const startNavigation = useCallback(() => setLoading(true), []);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  // บล็อกการนำทางไป /map เมื่ออยู่ที่ /map แล้ว — ลด GET ซ้ำบนมือถือ (click/touch อาจ trigger link โดยไม่ตั้งใจ)
  const isMap = pathname === "/map";
  const blockSamePageNav = useCallback(
    (href: string | null) => {
      if (!href || href === "#" || href.startsWith("//")) return false;
      return href === pathname || (href === "/map" && isMap);
    },
    [pathname, isMap]
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="/"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (anchor.getAttribute("target") === "_blank") return;
      if (blockSamePageNav(href)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      setLoading(true);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="/"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (anchor.getAttribute("target") === "_blank") return;
      if (blockSamePageNav(href)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", handleClick, true);
    document.addEventListener("touchend", handleTouchEnd, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("touchend", handleTouchEnd, true);
    };
  }, [blockSamePageNav]);

  // หน้าแผนที่ (/map) ไม่แสดง overlay โหลด — กันไม่ให้บังหน้าจอและให้ผู้ใช้กดแผนที่/เมนูได้ (ลดอาการกดไม่ขึ้นบนมือถือ)
  const showOverlay = loading && pathname !== "/map" && pathname !== "";

  return (
    <NavigationLoadingContext.Provider value={{ startNavigation }}>
      {children}
      <OverlayPop loading={showOverlay} />
    </NavigationLoadingContext.Provider>
  );
}
