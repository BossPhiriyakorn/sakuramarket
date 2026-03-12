"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  Megaphone,
  MapPin,
  ShoppingBag,
  Shield,
  LogOut,
  History,
  BadgeDollarSign,
  CreditCard,
  User,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "ผู้ใช้", icon: Users },
  { href: "/admin/shops", label: "ร้านค้า", icon: Store },
  { href: "/admin/packages", label: "แพ็กเกจ", icon: CreditCard },
  { href: "/admin/products", label: "สินค้า", icon: Package },
  { href: "/admin/announcements", label: "ประกาศ (Live)", icon: Megaphone },
  { href: "/admin/sales", label: "ประวัติการซื้อสินค้า", icon: ShoppingBag },
  { href: "/admin/parcels", label: "จัดการห้องและตาราง", icon: MapPin },
  { href: "/admin/parcel-audit", label: "ประวัติการจองที่", icon: History },
  { href: "/admin/ad-pricing", label: "ราคาโฆษณา (Ad)", icon: BadgeDollarSign },
  { href: "/admin/admins", label: "จัดการแอดมิน", icon: Shield },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";

  const handleLogout = async () => {
    await fetch("/api/auth/logout-admin", { method: "POST", credentials: "include" });
    router.push("/admin/login");
  };

  const [adminDisplayName, setAdminDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (isLoginPage) return;
    fetch("/api/auth/admin-me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { displayName?: string } | null) => {
        if (data?.displayName) setAdminDisplayName(data.displayName);
      })
      .catch(() => {});
  }, [isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar ติดขอบซ้าย ไม่เลื่อนตามหน้า — ปุ่มล่างเห็นได้เสมอ */}
      <aside className="fixed left-0 top-0 bottom-0 w-56 sm:w-64 border-r border-white/10 app-glass flex flex-col z-20">
        <div className="p-4 border-b border-white/10 shrink-0">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">
              SAKURA<span className="text-pink-500">CMS</span>
            </span>
          </Link>
          {adminDisplayName !== null && (
            <p className="mt-2 text-sm text-slate-400 truncate" title={adminDisplayName}>
              {adminDisplayName || "แอดมิน"}
            </p>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto min-h-0">
          {SIDEBAR_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/15 text-pink-300 border border-white/20"
                    : "text-slate-400 hover:text-pink-200 hover:bg-white/10"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 shrink-0 space-y-1">
          <Link
            href="/admin/profile"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors ${
              pathname === "/admin/profile"
                ? "bg-white/15 text-pink-300 border border-white/20"
                : "text-slate-400 hover:text-pink-200 hover:bg-white/10"
            }`}
          >
            <User size={18} className="shrink-0" />
            โปรไฟล์แอดมิน
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-pink-200 hover:bg-white/10 w-full transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <main className="ml-56 sm:ml-64 min-h-screen p-4 md:p-6 app-glass-subtle overflow-auto">
        {children}
      </main>
    </div>
  );
}
