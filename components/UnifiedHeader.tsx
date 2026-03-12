"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Store,
  Settings,
  User,
  Package,
  DoorOpen,
  Check,
  ShoppingCart,
  ClipboardList,
  Heart,
  Coins,
  Truck,
  Home,
  CreditCard,
  Bell,
  Loader2,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useUIStore } from "@/store/uiStore";
import { useStore } from "@/store";
import { playBellNotificationSound } from "@/lib/playNotificationSound";
import { fetchMyWalletTokenBalance } from "@/lib/api/client";
import { useNavigationLoading } from "@/components/NavigationLoadingOverlay";
import type { RoomId } from "@/types";

const MENU_ITEMS = [
  { id: "home", label: "หน้าแรก", icon: Home, href: "/map" },
  { id: "shops", label: "รายการร้านค้า", icon: Store, href: null }, // เปิดสไลด์จากด้านข้าง (ทุกหน้า)
  { id: "following", label: "การติดตาม", icon: Heart, href: null }, // เปิดสไลด์จากด้านข้าง (ทุกหน้า)
  { id: "tracking", label: "ติดตามสินค้า", icon: Truck, href: "/tracking" },
  { id: "register-shop", label: "ลงทะเบียนร้าน", icon: ClipboardList, href: "/register-shop" },
  { id: "manage-shop", label: "จัดการร้านค้า", icon: Settings, href: "/manage-shop" },
  { id: "shop-packages", label: "แพ็กเกจ", icon: CreditCard, href: "/packages" },
  { id: "profile", label: "โปรไฟล์", icon: User, href: "/profile" },
  { id: "packages", label: "Item Shop", icon: Package, href: "/manage-shop/packages" },
] as const;

export interface UnifiedHeaderProps {
  /** แสดงโลโก้ SAKURAMARKET ด้านซ้าย (สำหรับหน้าแรก) */
  showBrand?: boolean;
  /** แสดงปุ่มกลับ ด้านซ้าย (สำหรับหน้าอื่นๆ) */
  showBackButton?: boolean;
  /** Custom content ด้านซ้าย (override showBrand/showBackButton) */
  leftContent?: React.ReactNode;
  /** หัวข้อกลาง (สำหรับหน้าอื่นๆ) */
  title?: React.ReactNode;
  /** แสดงฟีเจอร์เปลี่ยนห้องในเมนู */
  showRoomSwitcher?: boolean;
  /** ห้องปัจจุบัน (สำหรับ room switcher) */
  currentRoom?: RoomId;
  /** ฟังก์ชันเปลี่ยนห้อง */
  setCurrentRoom?: (room: RoomId) => void;
  /** รายการห้องที่เลือกได้ */
  roomOptions?: readonly number[];
  /** ชื่อห้องจาก API (id -> name) */
  roomNames?: Record<number, string>;
  /** Callback เมื่อคลิก "รายการร้านค้า" */
  onOpenShopList?: () => void;
  /** Callback เมื่อคลิกตะกร้า (override default behavior) */
  onOpenCart?: () => void;
  /** แสดงชื่อผู้ใช้ในปุ่มเมนู (สำหรับหน้าแรก) */
  showUsername?: boolean;
  /** Class name เพิ่มเติมสำหรับ header */
  className?: string;
}

export function UnifiedHeader({
  showBrand: _showBrand = true,
  showBackButton: _showBackButton = false,
  leftContent,
  title: _title,
  showRoomSwitcher = false,
  currentRoom,
  setCurrentRoom,
  roomOptions = [],
  roomNames,
  onOpenShopList: _onOpenShopList,
  onOpenCart,
  showUsername = true,
  className = "",
}: UnifiedHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { startNavigation } = useNavigationLoading();
  const [menuOpen, setMenuOpen] = useState(false);
  const [roomSubmenuOpen, setRoomSubmenuOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [displayLabel, setDisplayLabel] = useState<string>("");
  const [hasShop, setHasShop] = useState<boolean | null>(null);
  const [showShopWarning, setShowShopWarning] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationList, setNotificationList] = useState<{ id: string; type: string; title: string; message: string; link_path: string | null; read_at: string | null; created_at: string }[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const prevUnreadCountRef = useRef<number | null>(null);
  const totalCartItems = useCartStore((s) => s.totalItemCount());
  const setCartOpen = useCartStore((s) => s.setCartOpen);

  // โหลดชื่อผู้ใช้สำหรับ header (เฉพาะเมื่อ showUsername = true)
  useEffect(() => {
    if (!showUsername) {
      setDisplayLabel("");
      return;
    }
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          window.location.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((data: { user?: { id: string; username?: string; role?: string } } | null) => {
        if (cancelled || data == null) return;
        const user = data?.user;
        if (!user || user.role === "admin") {
          setDisplayLabel("");
          return;
        }
        setDisplayLabel(user.username ?? "ผู้ใช้");
      })
      .catch(() => {
        if (!cancelled) setDisplayLabel("");
      });
    return () => {
      cancelled = true;
    };
  }, [showUsername]);

  // โหลดยอดโทเค็นของระบบจากกระเป๋าที่ผูก
  useEffect(() => {
    let cancelled = false;
    fetchMyWalletTokenBalance()
      .then((res) => {
        if (!cancelled) setBalance(res.balance);
      })
      .catch(() => {
        if (!cancelled) setBalance(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ตรวจสอบว่ามีร้านค้าหรือลงทะเบียนไว้แล้วหรือไม่
  useEffect(() => {
    let cancelled = false;
    fetch("/api/data/me/shop", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { shop?: { id: string } | null; registration?: { id: string } | null }) => {
        if (!cancelled) setHasShop(!!(data.shop || data.registration));
      })
      .catch(() => {
        if (!cancelled) setHasShop(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // จำนวนแจ้งเตือนที่ยังไม่อ่าน (จุดแดงกระดิ่ง) — โหลดครั้งแรก + โพลแบบ real-time ทุก 40 วินาที และเมื่อกลับมาเปิดแท็บ
  useEffect(() => {
    if (!showUsername) {
      setNotificationUnreadCount(0);
      return;
    }
    let cancelled = false;
    const fetchUnread = () => {
      if (cancelled) return;
      fetch("/api/data/me/notifications/unread-count", { credentials: "include" })
        .then((r) => r.json())
        .then((data: { unreadCount?: number }) => {
          if (cancelled || typeof data.unreadCount !== "number") return;
          const next = data.unreadCount;
          const prev = prevUnreadCountRef.current;
          if (prev !== null && next > prev && useStore.getState().donationSoundEnabled) {
            playBellNotificationSound();
          }
          prevUnreadCountRef.current = next;
          setNotificationUnreadCount(next);
        })
        .catch(() => {
          if (!cancelled) setNotificationUnreadCount(0);
        });
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 40_000);
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") fetchUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [showUsername, pathname]);

  // ปิดเมนูเมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) setRoomSubmenuOpen(false);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) setNotificationOpen(false);
  }, [menuOpen]);

  // โหลดรายการแจ้งเตือนเมื่อเปิดดรอปดาวน์
  useEffect(() => {
    if (!notificationOpen || !showUsername) return;
    setNotificationLoading(true);
    fetch("/api/data/me/notifications?limit=15", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { notifications?: typeof notificationList; unreadCount?: number }) => {
        setNotificationList(Array.isArray(data.notifications) ? data.notifications : []);
        if (typeof data.unreadCount === "number") setNotificationUnreadCount(data.unreadCount);
      })
      .catch(() => setNotificationList([]))
      .finally(() => setNotificationLoading(false));
  }, [notificationOpen, showUsername]);

  // ปิดดรอปดาวน์แจ้งเตือนเมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationOpen(false);
      }
    };
    if (notificationOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setMenuOpen(false);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notificationOpen]);

  const setShopListOpen = useUIStore((s) => s.setShopListOpen);
  const setFollowingOpen = useUIStore((s) => s.setFollowingOpen);

  const handleMenuClick = async (id: string) => {
    if (id === "change-room") {
      setRoomSubmenuOpen((o) => !o);
      return;
    }
    setMenuOpen(false);
    setRoomSubmenuOpen(false);

    const item = MENU_ITEMS.find((i) => i.id === id);
    if (!item) return;

    if (id === "shops") {
      setShopListOpen(true);
      return;
    }
    if (id === "following") {
      setFollowingOpen(true);
      return;
    }

    if (item.href) {
      startNavigation();
      router.push(item.href);
    }
  };

  // ทุกหน้าใช้แบบเดียวกับหน้าแรก: โลโก้ด้านซ้าย (กดไปหน้าแผนที่/หน้าแรก)
  const finalLeftContent: React.ReactNode =
    leftContent !== undefined ? (
      leftContent
    ) : (
      <Link
        href="/map"
        onClick={() => startNavigation()}
        className="max-w-[52vw] sm:max-w-none text-base sm:text-xl font-bold text-white tracking-tighter uppercase truncate hover:opacity-90 active:opacity-80 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-pink-500/50 rounded"
        title="หน้าแรก"
        aria-label="ไปหน้าแรก"
      >
        SAKURA<span className="text-pink-500">MARKET</span>
      </Link>
    );

  const headerClass = `w-full min-h-16 app-glass border-b border-white/10 flex items-center justify-between px-3 sm:px-4 md:px-6 safe-top pointer-events-auto z-[100] ${className}`;

  return (
    <>
    <header className={headerClass}>
      {/* ด้านซ้าย - โลโก้ SAKURAMARKET เหมือนหน้าแรกเสมอ */}
      <div className="flex items-center gap-2 shrink min-w-0">
        {finalLeftContent}
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <span className="shrink-0 rounded bg-amber-500/90 px-2 py-0.5 text-xs font-medium text-black" title="ไม่หักเงินและเครดิตจริง">
            โหมดเดโม
          </span>
        )}
      </div>

      {/* ด้านขวา - ตะกร้า + ปุ่มเมนูผู้ใช้ เหมือนหน้าแรกเสมอ */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 pl-2">
        <button
          type="button"
          onClick={() => (onOpenCart ? onOpenCart() : setCartOpen(true))}
          className="relative rounded-full p-2.5 app-glass-subtle hover:bg-white/10 hover:border-white/20 transition-colors text-white"
          title="ตะกร้าสินค้า"
          aria-label="ตะกร้าสินค้า"
        >
          <ShoppingCart size={22} />
          {totalCartItems > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-pink-500 text-white text-xs font-bold flex items-center justify-center px-1">
              {totalCartItems > 99 ? "99+" : totalCartItems}
            </span>
          )}
        </button>

        {showUsername && (
          <div ref={notificationRef} className="relative">
            <button
              type="button"
              onClick={() => {
                const nextOpen = !notificationOpen;
                if (nextOpen && notificationUnreadCount > 0) {
                  prevUnreadCountRef.current = 0;
                  setNotificationUnreadCount(0);
                  setNotificationList((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
                  fetch("/api/data/me/notifications", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
                }
                setNotificationOpen(nextOpen);
              }}
              className="relative rounded-full p-2.5 app-glass-subtle hover:bg-white/10 hover:border-white/20 transition-colors text-white"
              title="การแจ้งเตือน"
              aria-label="การแจ้งเตือน"
              aria-expanded={notificationOpen}
              aria-haspopup="true"
            >
              <Bell size={22} />
              {notificationUnreadCount > 0 && (
                <span className="absolute top-0 right-0 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center px-1">
                  {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
                </span>
              )}
            </button>
            {notificationOpen && (
              <div className="absolute top-full right-0 mt-2 w-[min(92vw,360px)] min-w-0 sm:w-96 max-h-[70vh] flex flex-col app-glass rounded-xl border border-white/10 shadow-xl z-[100]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <Bell size={18} className="text-pink-400" />
                    การแจ้งเตือน
                  </span>
                  {notificationUnreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        fetch("/api/data/me/notifications", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
                          .then(() => {
                            setNotificationUnreadCount(0);
                            setNotificationList((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
                          })
                          .catch(() => {});
                      }}
                      className="text-xs text-pink-400 hover:text-pink-300"
                    >
                      อ่านทั้งหมด
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1 min-h-0 py-1">
                  {notificationLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-pink-400" />
                    </div>
                  ) : notificationList.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-6 px-4">ยังไม่มีรายการแจ้งเตือน</p>
                  ) : (
                    <ul className="space-y-0.5 px-2">
                      {notificationList.map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!n.read_at) {
                                fetch("/api/data/me/notifications", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) }).catch(() => {});
                                setNotificationList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
                                setNotificationUnreadCount((c) => Math.max(0, c - 1));
                              }
                              setNotificationOpen(false);
                              if (n.link_path) {
                                startNavigation();
                                router.push(n.link_path);
                              }
                            }}
                            className={`w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-2 transition-colors ${
                              n.read_at ? "hover:bg-white/5 text-slate-300" : "hover:bg-pink-950/30 bg-pink-950/10 text-slate-200"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{n.title}</p>
                              <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                            </div>
                            {n.link_path && <ChevronRight size={16} className="text-slate-500 shrink-0 mt-0.5" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="border-t border-white/10 px-4 py-2 shrink-0">
                  <Link
                    href="/notifications"
                    onClick={() => { setNotificationOpen(false); startNavigation(); }}
                    className="block text-center text-sm text-pink-400 hover:text-pink-300 py-1.5"
                  >
                    ดูทั้งหมด
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ปุ่มเมนู */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-full px-3 sm:px-5 py-2 sm:py-2.5 app-glass-subtle shadow-[0_2px_0_0_rgba(0,0,0,0.15)] hover:bg-white/10 hover:border-white/20 active:translate-y-0.5 transition-all duration-150 flex items-center justify-center gap-1.5 sm:gap-2 text-white font-semibold text-sm sm:text-base"
            title="เมนู"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            {showUsername && displayLabel && (
              <span className="hidden sm:block max-w-[120px] truncate text-pink-200" title={displayLabel}>
                {displayLabel}
              </span>
            )}
            <span>{showUsername ? "Menu" : "เมนู"}</span>
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-[min(92vw,320px)] min-w-0 sm:w-80 sm:min-w-[300px] app-glass rounded-xl py-3 z-[100]">
              {MENU_ITEMS.map((item) => {
                const { id, label, href } = item;
                const Icon = item.icon as LucideIcon;
                // "ลงทะเบียนร้าน": มีร้านแล้วแสดงแต่กดไม่ได้ (1 ยูส ต่อ 1 ร้าน)
                if (id === "register-shop" && hasShop === true) {
                  return (
                    <div
                      key={id}
                      className="w-full min-h-[48px] sm:min-h-[44px] px-5 py-3.5 sm:py-3 flex items-center gap-4 text-left text-base sm:text-sm text-slate-500 cursor-not-allowed rounded-lg mx-1"
                      title="คุณมีร้านอยู่แล้ว 1 ร้าน"
                    >
                      <Icon size={22} className="text-slate-500 shrink-0 sm:w-5 sm:h-5" />
                      <span className="font-medium">{label}</span>
                    </div>
                  );
                }
                // "รายการร้านค้า": เปิดสไลด์จากด้านข้าง (ได้ทุกหน้า)
                if (id === "shops") {
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setShopListOpen(true);
                        setMenuOpen(false);
                      }}
                      className="w-full min-h-[48px] sm:min-h-[44px] px-5 py-3.5 sm:py-3 flex items-center gap-4 text-left text-base sm:text-sm text-slate-200 hover:bg-pink-950/30 hover:text-pink-200 active:bg-pink-950/40 transition-colors rounded-lg mx-1"
                    >
                      <Icon size={22} className="text-pink-400 shrink-0 sm:w-5 sm:h-5" />
                      <span className="font-medium">{label}</span>
                    </button>
                  );
                }
                // "การติดตาม": เปิดสไลด์จากด้านข้าง (ได้ทุกหน้า)
                if (id === "following") {
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setFollowingOpen(true);
                        setMenuOpen(false);
                      }}
                      className="w-full min-h-[48px] sm:min-h-[44px] px-5 py-3.5 sm:py-3 flex items-center gap-4 text-left text-base sm:text-sm text-slate-200 hover:bg-pink-950/30 hover:text-pink-200 active:bg-pink-950/40 transition-colors rounded-lg mx-1"
                    >
                      <Icon size={22} className="text-pink-400 shrink-0 sm:w-5 sm:h-5" />
                      <span className="font-medium">{label}</span>
                    </button>
                  );
                }

                // "จัดการร้านค้า": ตรวจสอบว่ามีร้านแล้วหรือยัง
                if (id === "manage-shop") {
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        if (hasShop === false) {
                          setShowShopWarning(true);
                        } else {
                          startNavigation();
                          router.push("/manage-shop");
                        }
                      }}
                      className="w-full min-h-[48px] sm:min-h-[44px] px-5 py-3.5 sm:py-3 flex items-center gap-4 text-left text-base sm:text-sm text-slate-200 hover:bg-pink-950/30 hover:text-pink-200 active:bg-pink-950/40 transition-colors rounded-lg mx-1"
                    >
                      <Icon size={22} className="text-pink-400 shrink-0 sm:w-5 sm:h-5" />
                      <span className="font-medium">{label}</span>
                    </button>
                  );
                }

                // ถ้ามี href ใช้ Link — เวลาอยู่หน้าแผนที่อยู่แล้ว อย่านำทางซ้ำ (กันมือถือโหลดซ้ำ/remount)
                if (href) {
                  if (href === "/map" && pathname === "/map") {
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setMenuOpen(false)}
                        className="w-full min-h-[48px] sm:min-h-[44px] px-5 py-3.5 sm:py-3 flex items-center gap-4 text-left text-base sm:text-sm text-slate-200 hover:bg-pink-950/30 hover:text-pink-200 active:bg-pink-950/40 transition-colors rounded-lg mx-1"
                      >
                        <Icon size={22} className="text-pink-400 shrink-0 sm:w-5 sm:h-5" />
                        <span className="font-medium">{label}</span>
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={id}
                      href={href}
                      onClick={() => {
                        setMenuOpen(false);
                        startNavigation();
                      }}
                      className="w-full min-h-[48px] sm:min-h-[44px] px-5 py-3.5 sm:py-3 flex items-center gap-4 text-left text-base sm:text-sm text-slate-200 hover:bg-pink-950/30 hover:text-pink-200 active:bg-pink-950/40 transition-colors rounded-lg mx-1"
                    >
                      <Icon size={22} className="text-pink-400 shrink-0 sm:w-5 sm:h-5" />
                      <span className="font-medium">{label}</span>
                    </Link>
                  );
                }

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleMenuClick(id)}
                    className="w-full min-h-[48px] sm:min-h-[44px] px-5 py-3.5 sm:py-3 flex items-center gap-4 text-left text-base sm:text-sm text-slate-200 hover:bg-pink-950/30 hover:text-pink-200 active:bg-pink-950/40 transition-colors rounded-lg mx-1"
                  >
                    <Icon size={22} className="text-pink-400 shrink-0 sm:w-5 sm:h-5" />
                    <span className="font-medium">{label}</span>
                  </button>
                );
              })}

              {/* เส้นแบ่ง + การแสดงเหรียญ + เปลี่ยนห้อง */}
              <div className="border-t border-pink-900/30 mt-1 pt-3 px-4 space-y-2">
                {/* แสดงยอดเงิน */}
                <div
                  className="flex items-center gap-2 rounded-lg pl-3 pr-4 py-2.5 app-glass-subtle text-amber-300/95"
                  title="ยอดเหรียญจากกระเป๋าที่ผูก"
                >
                  <Coins size={20} className="shrink-0" />
                  <span className="text-sm font-semibold tabular-nums">
                    {balance !== null ? balance.toLocaleString() : "—"}{" "}
                    <span className="text-slate-400 font-normal">เหรียญ</span>
                  </span>
                </div>

                {/* ฟีเจอร์เปลี่ยนห้อง */}
                {showRoomSwitcher && roomOptions.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setRoomSubmenuOpen((o) => !o)}
                      className="w-full min-h-[44px] px-4 py-2.5 flex items-center gap-4 text-left text-sm text-slate-200 hover:bg-pink-950/30 hover:text-pink-200 rounded-lg"
                    >
                      <DoorOpen size={22} className="text-pink-400 shrink-0" />
                      <span className="font-medium">เปลี่ยนห้อง</span>
                    </button>
                    {roomSubmenuOpen && (
                      <div className="pl-4 pr-2 pb-2 flex flex-col gap-1">
                        {roomOptions.map((room) => (
                          <button
                            key={room}
                            type="button"
                            onClick={() => {
                              if (setCurrentRoom) {
                                setCurrentRoom(room as RoomId);
                              }
                              setMenuOpen(false);
                              setRoomSubmenuOpen(false);
                            }}
                            className="w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between text-left text-sm text-slate-200 hover:bg-pink-950/30 hover:text-pink-200 rounded-lg border border-pink-900/20"
                          >
                            <span>{roomNames?.[room] ?? `ห้อง ${room}`}</span>
                            {currentRoom === room && (
                              <Check size={18} className="text-pink-400 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
        </header>

    {/* Popup แจ้งเตือน: ยังไม่ได้ลงทะเบียนร้านค้า */}
    {showShopWarning && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
        <div className="rounded-xl app-glass w-full max-w-sm">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store size={20} className="text-pink-400 shrink-0" />
              <h3 className="font-semibold text-white">ยังไม่มีร้านค้า</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowShopWarning(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-slate-300 text-sm leading-relaxed">
              คุณยังไม่ได้ลงทะเบียนร้านค้า กรุณาลงทะเบียนร้านค้าก่อนเพื่อเข้าใช้งานฟีเจอร์นี้
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowShopWarning(false);
                  startNavigation();
                  router.push("/register-shop");
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium text-sm transition-colors"
              >
                <ClipboardList size={18} />
                ลงทะเบียนร้านค้า
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowShopWarning(false);
                  if (pathname !== "/map") {
                    startNavigation();
                    router.push("/map");
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-pink-200 font-medium text-sm transition-colors border border-pink-900/30"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                จองล็อคร้านในแผนที่
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
