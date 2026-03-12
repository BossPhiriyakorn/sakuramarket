"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Users, CircleDot, FileCheck } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { OnlineBadge } from "@/components/OnlineBadge";

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;
function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

type User = {
  id: string;
  username: string;
  email: string;
  created_at: string;
  status?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  verification_status?: string;
  verification_document_url?: string | null;
  last_seen_at?: string;
};
type ShopReg = { id: string; user_id: string; shop_name: string };
type ShopInfo = { user_id: string; shop_name?: string; membership_plan?: string; membership_expires_at?: string | null };

export default function CmsUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [registrations, setRegistrations] = useState<ShopReg[]>([]);
  const [shops, setShops] = useState<ShopInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/data/users", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/data/shop-registrations", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/data/shops", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([usersData, regsData, shopsData]) => {
        setUsers(Array.isArray(usersData) ? usersData : []);
        setRegistrations(Array.isArray(regsData) ? regsData : []);
        setShops(Array.isArray(shopsData) ? shopsData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Real-time: เมื่อมีผู้ใช้สมัครใหม่ แอดมินเห็นทันทีโดยไม่ต้องรีเฟรช
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (newUser: User) => {
      setUsers((prev) => {
        if (prev.some((u) => u.id === newUser.id)) return prev;
        return [{ ...newUser, created_at: newUser.created_at || new Date().toISOString() }, ...prev];
      });
    };
    socket.on("user_registered", handler);
    return () => {
      socket.off("user_registered", handler);
    };
  }, []);

  const planNameMap: Record<string, string> = { free: "ฟรี", basic: "พื้นฐาน", pro: "โปร" };
  const getShopName = (userId: string) => registrations.find((r) => r.user_id === userId)?.shop_name ?? (shops.find((s) => s.user_id === userId)?.shop_name as string | undefined) ?? "—";
  const getShopPackage = (userId: string) => {
    const shop = shops.find((s) => s.user_id === userId);
    if (!shop) return { plan: "—", status: "" };
    if (shop.membership_plan == null || shop.membership_plan === "") return { plan: "ยังไม่มีแพ็กเกจ", status: "" };
    const plan = planNameMap[shop.membership_plan] ?? shop.membership_plan;
    const exp = shop.membership_expires_at ? new Date(shop.membership_expires_at) : null;
    const expired = exp ? exp.getTime() <= Date.now() : false;
    const daysLeft = exp && !expired ? Math.ceil((exp.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
    const status = expired ? "หมดอายุ" : daysLeft != null && daysLeft > 0 ? `เหลือ ${daysLeft} วัน` : "";
    return { plan, status };
  };

  const statusLabel: Record<string, string> = {
    active: "ใช้งาน",
    suspended: "ระงับ",
    inactive: "ไม่ใช้งาน",
  };
  const verificationLabel: Record<string, string> = {
    pending: "รอตรวจเอกสาร",
    verified: "ยืนยันแล้ว",
    rejected: "ไม่อนุมัติ",
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-slate-400">กำลังโหลด...</p>
      </div>
    );
  }

  const totalUsers = users.length;
  const onlineCount = users.filter((u) => isOnline(u.last_seen_at)).length;
  const pendingDocCount = users.filter(
    (u) => u.verification_status === "pending" && Boolean(u.verification_document_url?.trim())
  ).length;

  return (
    <div className="p-4 sm:p-6 md:p-8 min-w-0 max-w-full">
      <h1 className="text-lg sm:text-xl font-bold text-white truncate">ผู้ใช้</h1>
      <p className="text-slate-400 text-xs sm:text-sm mt-1 mb-4 break-words">
        จัดการ users, profiles (ดู/ค้นหา — ข้อมูลจาก API) แสดงแพ็กเกจร้านที่ผู้ใช้ใช้อยู่
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <div className="rounded-xl border border-white/10 app-glass-subtle p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-pink-950/50 flex items-center justify-center shrink-0">
            <Users size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white">จำนวนผู้ใช้ทั้งหมด</h2>
            <p className="text-slate-500 text-xs mt-0.5">users ทั้งระบบ</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">{totalUsers}</span>
        </div>
        <div className="rounded-xl border border-white/10 app-glass-subtle p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-pink-950/50 flex items-center justify-center shrink-0">
            <CircleDot size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white">จำนวนผู้ใช้ออนไลน์</h2>
            <p className="text-slate-500 text-xs mt-0.5">ออนไลน์ภายใน 3 นาที</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">{onlineCount}</span>
        </div>
        <div className="rounded-xl border border-white/10 app-glass-subtle p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-pink-950/50 flex items-center justify-center shrink-0">
            <FileCheck size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white">การยืนยันเอกสาร</h2>
            <p className="text-slate-500 text-xs mt-0.5">รอตรวจเอกสาร</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">{pendingDocCount}</span>
        </div>
      </div>

      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden min-w-0">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
              <tr>
                <th className="px-2 sm:px-4 py-3 w-10 sm:w-12 whitespace-nowrap">ลำดับ</th>
                <th className="px-2 sm:px-4 py-3 min-w-0 max-w-[80px] sm:max-w-[100px] truncate">ชื่อ</th>
                <th className="px-2 sm:px-4 py-3 min-w-0 max-w-[80px] sm:max-w-[100px] truncate">สกุล</th>
                <th className="px-2 sm:px-4 py-3 min-w-0 max-w-[140px] truncate">เมล</th>
                <th className="px-2 sm:px-4 py-3 min-w-0 max-w-[100px] truncate">เบอร์</th>
                <th className="px-2 sm:px-4 py-3 min-w-0 max-w-[90px] truncate">ยูสเนม</th>
                <th className="px-2 sm:px-4 py-3 whitespace-nowrap">วันสมัคร</th>
                <th className="px-2 sm:px-4 py-3 whitespace-nowrap">สถานะ</th>
                <th className="px-2 sm:px-4 py-3 min-w-0 max-w-[100px] truncate">ออนไลน์</th>
                <th className="px-2 sm:px-4 py-3 whitespace-nowrap">ยืนยันตัวตน</th>
                <th className="px-2 sm:px-4 py-3 min-w-0 max-w-[100px] truncate">ชื่อร้าน</th>
                <th className="px-2 sm:px-4 py-3 whitespace-nowrap">แพ็กเกจ</th>
                <th className="px-2 sm:px-4 py-3 whitespace-nowrap">หมดอายุ/สถานะ</th>
                <th className="px-2 sm:px-4 py-3 w-24 sm:w-28 text-center whitespace-nowrap">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="text-slate-300 divide-y divide-pink-900/20">
              {users.map((u, index) => {
                const status = u.status ?? "active";
                const pkg = getShopPackage(u.id);
                return (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="px-2 sm:px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-2 sm:px-4 py-3 min-w-0 max-w-[80px] sm:max-w-[100px] truncate" title={u.first_name || undefined}>{u.first_name || "—"}</td>
                    <td className="px-2 sm:px-4 py-3 min-w-0 max-w-[80px] sm:max-w-[100px] truncate" title={u.last_name || undefined}>{u.last_name || "—"}</td>
                    <td className="px-2 sm:px-4 py-3 min-w-0 max-w-[140px] truncate" title={u.email}>{u.email}</td>
                    <td className="px-2 sm:px-4 py-3 min-w-0 max-w-[100px] truncate" title={u.phone || undefined}>{u.phone || "—"}</td>
                    <td className="px-2 sm:px-4 py-3 font-mono min-w-0 max-w-[90px] truncate" title={u.username}>{u.username}</td>
                    <td className="px-2 sm:px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString("th-TH")}</td>
                    <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          status === "active"
                            ? "text-emerald-400"
                            : status === "suspended"
                              ? "text-amber-400"
                              : "text-slate-500"
                        }
                      >
                        {statusLabel[status] ?? status}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 min-w-0 max-w-[100px] truncate">
                      <OnlineBadge lastSeenAt={u.last_seen_at} />
                    </td>
                    <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                      {(() => {
                        const hasDoc = Boolean(u.verification_document_url?.trim());
                        const displayStatus =
                          u.verification_status === "verified"
                            ? "verified"
                            : u.verification_status === "rejected"
                              ? "rejected"
                              : u.verification_status === "pending" && hasDoc
                                ? "pending"
                                : null;
                        const label = displayStatus ? verificationLabel[displayStatus] : "—";
                        return (
                          <span
                            className={
                              displayStatus === "verified"
                                ? "text-emerald-400"
                                : displayStatus === "pending"
                                  ? "text-amber-400"
                                  : displayStatus === "rejected"
                                    ? "text-red-400"
                                    : "text-slate-500"
                            }
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-2 sm:px-4 py-3 min-w-0 max-w-[100px] truncate" title={getShopName(u.id)}>{getShopName(u.id)}</td>
                    <td className="px-2 sm:px-4 py-3 whitespace-nowrap">{pkg.plan}</td>
                    <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                      {pkg.status ? (
                        pkg.status === "หมดอายุ" ? (
                          <span className="text-amber-400 text-xs">หมดอายุ</span>
                        ) : (
                          <span className="text-emerald-400 text-xs">{pkg.status}</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-pink-900/50 px-2 sm:px-3 py-1.5 text-xs font-medium text-pink-200 hover:bg-pink-800/50"
                      >
                        รายละเอียด
                        <ChevronRight size={14} className="shrink-0" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
