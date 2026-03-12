"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Store, Bell, ShieldCheck, Megaphone, MapPin } from "lucide-react";
import { LoadingImage } from "@/components/LoadingImage";
import { fetchDashboard, fetchNotifications, clearNotifications, type NotificationItem } from "@/lib/api/client";

const TYPE_LABELS: Record<string, string> = {
  admin_login: "การเข้าใช้งานแอดมิน",
  user_registered: "ผู้ใช้สมัครใหม่",
  shop_registration: "ลงทะเบียนร้านใหม่",
  parcel_assigned: "ร้านได้รับการจองที่แล้ว",
  purchase: "การซื้อของ",
  verification_request: "ขอยืนยันตัวตน/ส่งเอกสาร",
  wallet_added: "เพิ่มกระเป๋า",
  shop_lock_released: "ร้านหลุดล็อคในแผนที่",
  other: "อื่นๆ",
};

function getNotificationActionLink(n: NotificationItem): string | null {
  const meta = n.meta as Record<string, unknown> | undefined;
  const shopId = meta?.shop_id != null ? String(meta.shop_id) : null;
  const userId = meta?.user_id != null ? String(meta.user_id) : null;
  switch (n.type) {
    case "shop_lock_released":
    case "parcel_assigned":
      return shopId ? `/admin/shops/${shopId}` : "/admin/shops";
    case "shop_registration":
      return "/admin/shop-registrations";
    case "verification_request":
      return "/admin/verification";
    case "user_registered":
      return userId ? `/admin/users/${userId}` : "/admin/users";
    case "purchase":
      return "/admin/orders";
    case "wallet_added":
      return userId ? `/admin/users/${userId}` : "/admin/users";
    default:
      return null;
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function CmsDashboardPage() {
  const [usersCount, setUsersCount] = useState<number>(0);
  const [shopsCount, setShopsCount] = useState<number>(0);
  const [verificationDocumentsCount, setVerificationDocumentsCount] = useState<number>(0);
  const [announcementsCount, setAnnouncementsCount] = useState<number>(0);
  const [parcelsCount, setParcelsCount] = useState<number>(0);
  const [notificationsTodayCount, setNotificationsTodayCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearingNotifications, setClearingNotifications] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchDashboard(), fetchNotifications()])
      .then(([dashboard, notifRes]) => {
        if (cancelled) return;
        setUsersCount(dashboard.usersCount);
        setShopsCount(dashboard.shopsCount);
        setVerificationDocumentsCount(dashboard.verificationDocumentsCount ?? 0);
        setAnnouncementsCount(dashboard.announcementsCount ?? 0);
        setParcelsCount(dashboard.parcelsCount ?? 0);
        setNotificationsTodayCount(dashboard.notificationsTodayCount ?? 0);
        setNotifications(notifRes.notifications ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClearAllNotifications = async () => {
    if (clearingNotifications || !confirm("ต้องการล้างการแจ้งเตือนทั้งหมดใช่หรือไม่?")) return;
    setClearingNotifications(true);
    setError(null);
    try {
      await clearNotifications();
      const [dashboard, notifRes] = await Promise.all([fetchDashboard(), fetchNotifications()]);
      setUsersCount(dashboard.usersCount);
      setShopsCount(dashboard.shopsCount);
      setVerificationDocumentsCount(dashboard.verificationDocumentsCount ?? 0);
      setAnnouncementsCount(dashboard.announcementsCount ?? 0);
      setParcelsCount(dashboard.parcelsCount ?? 0);
      setNotificationsTodayCount(dashboard.notificationsTodayCount ?? 0);
      setNotifications(notifRes.notifications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setClearingNotifications(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          จัดการระบบ Sakura Market
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <Link
          href="/admin/users"
          className="rounded-xl border border-white/10 app-glass-subtle p-5 hover:border-pink-500/30 transition-colors flex items-start gap-4 group"
        >
          <div className="w-10 h-10 rounded-lg bg-pink-950/50 flex items-center justify-center shrink-0 group-hover:bg-pink-600/20 transition-colors">
            <Users size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white group-hover:text-pink-200">จำนวนผู้ใช้</h2>
            <p className="text-slate-500 text-xs mt-0.5">users, profiles</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">
            {loading ? "—" : usersCount}
          </span>
        </Link>
        <Link
          href="/admin/shops"
          className="rounded-xl border border-white/10 app-glass-subtle p-5 hover:border-pink-500/30 transition-colors flex items-start gap-4 group"
        >
          <div className="w-10 h-10 rounded-lg bg-pink-950/50 flex items-center justify-center shrink-0 group-hover:bg-pink-600/20 transition-colors">
            <Store size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white group-hover:text-pink-200">จำนวนร้านค้า</h2>
            <p className="text-slate-500 text-xs mt-0.5">จัดการร้านค้าและจองที่</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">
            {loading ? "—" : shopsCount}
          </span>
        </Link>
        <Link
          href="/admin/verification"
          className="rounded-xl border border-white/10 app-glass-subtle p-5 hover:border-pink-500/30 transition-colors flex items-start gap-4 group"
        >
          <div className="w-10 h-10 rounded-lg bg-pink-950/50 flex items-center justify-center shrink-0 group-hover:bg-pink-600/20 transition-colors">
            <ShieldCheck size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white group-hover:text-pink-200">ขอยืนยันตัวตน</h2>
            <p className="text-slate-500 text-xs mt-0.5">ส่งเอกสารรอตรวจ</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">
            {loading ? "—" : verificationDocumentsCount}
          </span>
        </Link>
        <Link
          href="/admin/parcels"
          className="rounded-xl border border-white/10 app-glass-subtle p-5 hover:border-pink-500/30 transition-colors flex items-start gap-4 group"
        >
          <div className="w-10 h-10 rounded-lg bg-pink-950/50 flex items-center justify-center shrink-0 group-hover:bg-pink-600/20 transition-colors">
            <MapPin size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white group-hover:text-pink-200">ล็อคบนแผนที่</h2>
            <p className="text-slate-500 text-xs mt-0.5">จัดการห้องและตาราง</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">
            {loading ? "—" : parcelsCount}
          </span>
        </Link>
        <Link
          href="/admin/announcements"
          className="rounded-xl border border-white/10 app-glass-subtle p-5 hover:border-pink-500/30 transition-colors flex items-start gap-4 group"
        >
          <div className="w-10 h-10 rounded-lg bg-pink-950/50 flex items-center justify-center shrink-0 group-hover:bg-pink-600/20 transition-colors">
            <Megaphone size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white group-hover:text-pink-200">ประกาศ (Live)</h2>
            <p className="text-slate-500 text-xs mt-0.5">จำนวนประกาศ</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">
            {loading ? "—" : announcementsCount}
          </span>
        </Link>
        <div className="rounded-xl border border-white/10 app-glass-subtle p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-pink-950/50 flex items-center justify-center shrink-0">
            <Bell size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white">การแจ้งเตือนวันนี้</h2>
            <p className="text-slate-500 text-xs mt-0.5">จำนวนแจ้งเตือนวันต่อวัน</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">
            {loading ? "—" : notificationsTodayCount}
          </span>
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">ตารางแจ้งเตือน</h2>
            <p className="text-slate-400 text-sm mt-1">
              แจ้งเตือนทั้งหมดที่ต้องตรวจสอบ — การเข้าใช้งานแอดมิน, ลงทะเบียนร้านใหม่, การซื้อของ, ขอยืนยันตัวตน/ส่งเอกสาร, เพิ่มกระเป๋า ฯลฯ
            </p>
          </div>
          {!loading && notifications.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllNotifications}
              disabled={clearingNotifications}
              className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-red-900/50 text-red-200 border border-red-700/50 hover:bg-red-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {clearingNotifications ? "กำลังล้าง..." : "ล้างการแจ้งเตือนทั้งหมด"}
            </button>
          )}
        </div>
        <div className="rounded-xl border border-white/10 app-glass-subtle overflow-hidden">
          {loading ? (
            <div className="p-8">
              <LoadingImage message="กำลังโหลดแจ้งเตือน..." size={64} />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400">ยังไม่มีรายการแจ้งเตือน</div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[min(70vh,32rem)]">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-pink-900/30">
                  <tr>
                    <th className="px-4 py-3 text-slate-400 font-medium text-sm">ประเภท</th>
                    <th className="px-4 py-3 text-slate-400 font-medium text-sm">หัวข้อ</th>
                    <th className="px-4 py-3 text-slate-400 font-medium text-sm">ข้อความ</th>
                    <th className="px-4 py-3 text-slate-400 font-medium text-sm whitespace-nowrap">วันเวลา</th>
                    <th className="px-4 py-3 text-slate-400 font-medium text-sm whitespace-nowrap">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => {
                    const actionHref = getNotificationActionLink(n);
                    return (
                      <tr key={n.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-pink-300 text-sm">
                          {TYPE_LABELS[n.type] ?? n.type}
                        </td>
                        <td className="px-4 py-3 text-white text-sm">{n.title}</td>
                        <td className="px-4 py-3 text-slate-300 text-sm">{n.message}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm whitespace-nowrap">
                          {formatDate(n.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {actionHref ? (
                            <Link href={actionHref} className="text-pink-400 hover:text-pink-300 hover:underline">
                              ดูรายละเอียด
                            </Link>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
