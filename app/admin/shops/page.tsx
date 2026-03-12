"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Store, MapPin } from "lucide-react";

const STATUS_LABEL = {
  not_rented: "ยังไม่เช่าที่",
  rented: "เช่าที่แล้ว",
  contact_rent: "ติดต่อเช่าที่",
} as const;

type StatusKey = keyof typeof STATUS_LABEL;
type RegRow = { id: string; user_id: string; shop_name: string; description: string; status: string; created_at: string; logo_url?: string; logo_background_color?: string };
type ShopRow = { id: string; user_id: string; parcel_id?: string; shop_name: string; logo_url?: string; logo_background_color?: string; lock_labels?: string[] };
type UserRow = { id: string; username: string; email: string; first_name?: string; last_name?: string; phone?: string; avatar_url?: string };

function getStatus(reg: RegRow, shops: ShopRow[]): StatusKey {
  const shop = shops.find((s) => s.user_id === reg.user_id);
  if (shop?.parcel_id) return "rented";
  if (reg.status === "pending_slot") return "contact_rent";
  return "not_rented";
}

export default function CmsShopsPage() {
  const [registrations, setRegistrations] = useState<RegRow[]>([]);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/data/shop-registrations").then((r) => r.json()),
      fetch("/api/data/shops").then((r) => r.json()),
      fetch("/api/data/users").then((r) => r.json()),
    ]).then(([regs, shopsData, usersData]) => {
      setRegistrations(Array.isArray(regs) ? regs : []);
      setShops(Array.isArray(shopsData) ? shopsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    }).catch(() => {});
  }, []);

  const getDisplayName = (userId: string) => {
    const u = users.find((u) => u.id === userId);
    if (!u) return "—";
    if (u.first_name || u.last_name) return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
    return u.username || u.email || "—";
  };
  const getShop = (userId: string) => shops.find((s) => s.user_id === userId);

  const totalShops = registrations.length;
  const rentedCount = shops.filter((s) => s.parcel_id).length;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-bold text-white">ร้านค้า</h1>
      <p className="text-slate-400 text-sm mt-1 mb-4">
        จัดการร้านค้าของผู้ใช้ และการจองที่
      </p>

      <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-4 mb-6">
        <div className="min-w-0 rounded-xl border border-white/10 app-glass-subtle p-5 flex items-start gap-4">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-pink-950/50 flex items-center justify-center">
            <Store size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white">จำนวนร้านทั้งหมด</h2>
            <p className="text-slate-500 text-xs mt-0.5">ร้านที่ลงทะเบียน</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">{totalShops}</span>
        </div>
        <div className="min-w-0 rounded-xl border border-white/10 app-glass-subtle p-5 flex items-start gap-4">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-pink-950/50 flex items-center justify-center">
            <MapPin size={20} className="text-pink-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-white">จำนวนร้านที่เช่าที่แล้ว</h2>
            <p className="text-slate-500 text-xs mt-0.5">มีล็อคบนแผนที่</p>
          </div>
          <span className="text-pink-400 font-bold text-lg shrink-0">{rentedCount}</span>
        </div>
      </div>

      <div className="min-w-0 max-w-full rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">ชื่อร้าน</th>
                <th className="px-4 py-3">ชื่อเจ้าของ</th>
                <th className="px-4 py-3">เบอร์โทร</th>
                <th className="px-4 py-3">เมล</th>
                <th className="px-4 py-3">วันลงทะเบียน</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3">ล็อค/ที่จอง</th>
                <th className="px-4 py-3 w-28 text-center">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="text-slate-300 divide-y divide-pink-900/20">
              {registrations.map((reg) => {
                const userRow = users.find((u) => u.id === reg.user_id);
                const shop = getShop(reg.user_id);
                const status = getStatus(reg, shops);
                const detailId = shop?.id ?? reg.id;
                const lockLabels = shop?.lock_labels ?? [];
                return (
                  <tr key={reg.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium">{reg.shop_name}</td>
                    <td className="px-4 py-3">{getDisplayName(reg.user_id)}</td>
                    <td className="px-4 py-3">{userRow?.phone || "—"}</td>
                    <td className="px-4 py-3">{users.find((u) => u.id === reg.user_id)?.email ?? reg.user_id}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(reg.created_at).toLocaleDateString("th-TH")}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          status === "rented"
                            ? "bg-green-900/50 text-green-300"
                            : status === "contact_rent"
                              ? "bg-amber-900/50 text-amber-300"
                              : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-pink-200/90 text-xs max-w-[200px]">
                      {lockLabels.length > 0 ? lockLabels.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/admin/shops/${detailId}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-pink-900/50 px-3 py-1.5 text-xs font-medium text-pink-200 hover:bg-pink-800/50"
                      >
                        รายละเอียด
                        <ChevronRight size={14} />
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
