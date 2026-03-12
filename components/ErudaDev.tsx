"use client";

import { useEffect } from "react";

/**
 * โหลด Eruda (mobile console) เฉพาะเมื่อมี ?eruda=1 ใน URL — ไม่โหลดอัตโนมัติ
 * เหตุผล: eruda.init() hook เข้า fetch/console/DOM ทำให้ React อาจเกิด inconsistency
 * บนมือถือผ่าน tunnel → trigger error recovery → full page reload loop
 *
 * วิธีใช้: เปิด https://your-tunnel-url/?eruda=1 แล้วจะเห็นปุ่ม Eruda มุมขวาล่าง
 */
export function ErudaDev() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("eruda")) return;
    if ((window as unknown as { __erudaLoaded?: boolean }).__erudaLoaded) return;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.async = true;
    script.onload = () => {
      try {
        (window as unknown as { eruda?: { init: () => void } }).eruda?.init();
        (window as unknown as { __erudaLoaded?: boolean }).__erudaLoaded = true;
      } catch (_) {
        // ignore
      }
    };
    document.body.appendChild(script);

    return () => {
      try {
        const el = document.getElementById("eruda");
        if (el) el.remove();
      } catch (_) {
        // ignore
      }
    };
  }, []);

  return null;
}
