"use client";

import React, { useState, useEffect } from "react";
import { Megaphone, Loader2, Save, Store } from "lucide-react";

type ActiveAdShop = {
  shop_id: string;
  shop_name: string;
  amount_paid: number;
  total_ad_spend: number;
  clicks_purchased: number;
  clicks_used: number;
  shop_views: number;
  total_visitors: number;
};

export default function CmsAdPricingPage() {
  const [coinsPerClick, setCoinsPerClick] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeShops, setActiveShops] = useState<ActiveAdShop[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);

  useEffect(() => {
    fetch("/api/data/ad-price-tiers", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { coins_per_click?: number }) => {
        setCoinsPerClick(typeof data.coins_per_click === "number" ? data.coins_per_click : 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/data/active-ad-shops", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { shops?: ActiveAdShop[] }) => {
        setActiveShops(Array.isArray(data.shops) ? data.shops : []);
      })
      .catch(() => setActiveShops([]))
      .finally(() => setLoadingShops(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/data/ad-price-tiers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ coins_per_click: Number(coinsPerClick) >= 0 ? Number(coinsPerClick) : 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "บันทึกไม่สำเร็จ");
      if (typeof (data as { coins_per_click?: number }).coins_per_click === "number") setCoinsPerClick((data as { coins_per_click: number }).coins_per_click);
      setMessage("บันทึกราคาต่อคลิกเรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Megaphone size={24} className="text-pink-400" />
        <h1 className="text-xl font-bold text-white">ราคาโฆษณา (แบบคลิก)</h1>
      </div>
      <p className="text-slate-400 text-sm">
        ตั้งค่าคลิกละกี่เหรียญ — ผู้ใช้ซื้อโฆษณาแบบคลิก จะหักเหรียญ = จำนวนคลิก × ค่าต่อคลิก (ตั้งทศนิยมได้ เช่น 0.01)
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-pink-400" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-pink-200">ราคาต่อคลิก (เหรียญ)</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-slate-300 text-sm">คลิกละ (เหรียญ)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={coinsPerClick}
                onChange={(e) => setCoinsPerClick(parseFloat(e.target.value) || 0)}
                className="w-28 rounded-lg bg-slate-800 border border-pink-900/30 text-white px-3 py-2 focus:outline-none focus:border-pink-500/50"
              />
              <span className="text-slate-500 text-xs">รองรับทศนิยม เช่น 0.01</span>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-emerald-400 text-sm">{message}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </>
      )}

      {/* ตารางร้านที่ใช้โฆษณาอยู่ */}
      <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
        <h2 className="text-lg font-semibold text-white p-4 flex items-center gap-2">
          <Store size={18} className="text-pink-400" />
          ร้านที่เปิดโฆษณาอยู่
        </h2>
        {loadingShops ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-pink-400" />
          </div>
        ) : activeShops.length === 0 ? (
          <p className="text-slate-500 text-sm p-4">ยังไม่มีร้านที่เปิดโฆษณาอยู่</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">ร้าน</th>
                  <th className="px-4 py-3">ยอดจ่ายโฆษณา (แคมเปญนี้)</th>
                  <th className="px-4 py-3">ยอดจ่ายรวม</th>
                  <th className="px-4 py-3">คลิกซื้อ / ใช้แล้ว</th>
                  <th className="px-4 py-3">กดเข้าดูร้าน</th>
                  <th className="px-4 py-3">ผู้เข้าชม (โดยประมาณ)</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {activeShops.map((row) => (
                  <tr key={row.shop_id} className="border-t border-white/10">
                    <td className="px-4 py-3 font-medium">{row.shop_name}</td>
                    <td className="px-4 py-3">{row.amount_paid.toLocaleString()} เหรียญ</td>
                    <td className="px-4 py-3">{row.total_ad_spend.toLocaleString()} เหรียญ</td>
                    <td className="px-4 py-3">{row.clicks_purchased.toLocaleString()} / {row.clicks_used.toLocaleString()}</td>
                    <td className="px-4 py-3">{row.shop_views.toLocaleString()}</td>
                    <td className="px-4 py-3">{row.total_visitors.toLocaleString()}</td>
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
