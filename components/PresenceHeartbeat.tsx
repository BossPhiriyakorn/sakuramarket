"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_INTERVAL = 30_000;

/** หน้าเหล่านี้ไม่ต้อง redirect ไป /login เมื่อ 401 (หลีกเลี่ยง loop และไม่ทับแอดมิน) */
function shouldRedirectToLogin(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/register") return false;
  if (pathname.startsWith("/admin")) return false;
  return true;
}

/**
 * ส่ง POST /api/data/me/presence ทุก 30 วิ เฉพาะเมื่อผู้ใช้ล็อกอินแล้ว
 * เมื่อกลับมาเปิดแท็บ (visibility = visible) ส่ง heartbeat ทันทีเพื่ออัปเดต last_seen_at
 * ไม่ redirect ไป /login เมื่ออยู่หน้า login/register (หยุด loop) และไม่ redirect เมื่ออยู่ /admin (แอดมินใช้ cookie คนละตัว)
 */
export function PresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const send = () => {
      if (cancelled) return;
      fetch("/api/data/me/presence", { method: "POST", credentials: "include" }).catch(() => {});
    };

    const startHeartbeat = () => {
      send();
      timer = setInterval(send, HEARTBEAT_INTERVAL);
    };

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisible);

    if (!shouldRedirectToLogin(pathname)) {
      return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onVisible);
        if (timer) clearInterval(timer);
      };
    }

    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          if (shouldRedirectToLogin(pathname)) window.location.replace("/login");
          return null;
        }
        return r.json().catch(() => ({ user: null }));
      })
      .then((data: { user?: { id?: string; role?: string } | null } | null) => {
        if (cancelled || data == null) return;
        const user = data?.user;
        if (!user?.id) {
          if (shouldRedirectToLogin(pathname)) window.location.replace("/login");
          return;
        }
        if (user.role !== "admin") startHeartbeat();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
