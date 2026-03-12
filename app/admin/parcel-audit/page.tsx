"use client";

import React, { useState, useEffect, useCallback } from "react";
import { History, Filter, Loader2 } from "lucide-react";

type AuditRow = {
  id: string;
  created_at: string;
  actor_type: string;
  actor_id: string;
  room_id: number;
  parcel_id: string | null;
  slot_count: number;
  amount_paid: number;
  registration_id: string | null;
  shop_id: string | null;
  outcome: string;
};

export default function CmsParcelAuditPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState<string>("");
  const [actorType, setActorType] = useState<string>("");
  const [actorId, setActorId] = useState<string>("");
  const [shopId, setShopId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const fetchAudit = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (roomId) params.set("roomId", roomId);
    if (actorType) params.set("actorType", actorType);
    if (actorId) params.set("actorId", actorId);
    if (shopId) params.set("shopId", shopId);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    params.set("limit", "100");
    fetch(`/api/data/parcel-booking-audit?${params}`)
      .then((r) => r.json())
      .then((data: { items?: AuditRow[] }) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [roomId, actorType, actorId, shopId, fromDate, toDate]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        <History size={22} className="text-pink-400" />
        ประวัติการจองที่
      </h1>
      <p className="text-slate-400 text-sm mt-1 mb-6">
        รายการ audit การจองล็อค (ลูกค้าหรือแอดมิน)
      </p>

      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 p-4 mb-6">
        <div className="flex items-center gap-2 text-pink-200 font-medium mb-3">
          <Filter size={18} /> ตัวกรอง
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-slate-500 text-xs mb-1">ห้อง</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
            >
              <option value="">ทั้งหมด</option>
              <option value="1">ห้อง 1</option>
              <option value="2">ห้อง 2</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">ผู้ทำ</label>
            <select
              value={actorType}
              onChange={(e) => setActorType(e.target.value)}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
            >
              <option value="">ทั้งหมด</option>
              <option value="user">ลูกค้า</option>
              <option value="admin">แอดมิน</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Actor ID (UUID)</label>
            <input
              type="text"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="บางส่วนได้"
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">Shop ID (UUID)</label>
            <input
              type="text"
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              placeholder="บางส่วนได้"
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">จากวันที่</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-500 text-xs mb-1">ถึงวันที่</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={fetchAudit}
          className="mt-3 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium flex items-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Filter size={16} />}
          โหลดใหม่
        </button>
      </div>

      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 size={32} className="animate-spin text-pink-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-slate-500 text-sm">ไม่มีรายการ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">เวลา</th>
                  <th className="px-4 py-3">ผู้ทำ</th>
                  <th className="px-4 py-3">ห้อง</th>
                  <th className="px-4 py-3">Parcel</th>
                  <th className="px-4 py-3 text-right">ช่อง</th>
                  <th className="px-4 py-3 text-right">ยอดจ่าย (เหรียญ)</th>
                  <th className="px-4 py-3">ผลลัพธ์</th>
                </tr>
              </thead>
              <tbody className="text-slate-300 divide-y divide-pink-900/20">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                      {new Date(r.created_at).toLocaleString("th-TH")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={r.actor_type === "admin" ? "text-amber-400" : "text-slate-300"}>
                        {r.actor_type === "admin" ? "แอดมิน" : "ลูกค้า"}
                      </span>
                      <span className="block font-mono text-xs text-slate-500 truncate max-w-[120px]" title={r.actor_id}>
                        {r.actor_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.room_id}</td>
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[140px]" title={r.parcel_id ?? ""}>
                      {r.parcel_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{r.slot_count}</td>
                    <td className="px-4 py-3 text-right">{r.amount_paid.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={r.outcome === "success" ? "text-emerald-400" : "text-red-400"}>
                        {r.outcome === "success" ? "สำเร็จ" : "ล้มเหลว"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
