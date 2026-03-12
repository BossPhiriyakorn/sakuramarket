"use client";

import React, { useState, useEffect } from "react";
import { CreditCard, Loader2, Pencil, Trash2 } from "lucide-react";

type PlanRow = {
  plan_key: string;
  name_th: string;
  duration_days: number;
  max_categories: number;
  max_products_visible: number;
  map_expansion_limit: number;
  ad_credits_granted: number;
  sort_order: number;
  price_credits: number;
};

export default function CmsPackagesPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPlans = () => {
    fetch("/api/data/package-plans")
      .then((r) => r.json())
      .then((d: { plans?: PlanRow[] }) => setPlans(Array.isArray(d.plans) ? d.plans : []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/data/package-plans")
      .then((r) => r.json())
      .then((d: { plans?: PlanRow[] }) => setPlans(Array.isArray(d.plans) ? d.plans : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (planKey: string) => {
    if (!confirm(`ต้องการลบแพ็กเกจ "${plans.find((p) => p.plan_key === planKey)?.name_th ?? planKey}" ใช่หรือไม่? (ลบได้เฉพาะเมื่อไม่มีร้านใช้แพ็กเกจนี้)`)) return;
    setDeleting(planKey);
    try {
      const res = await fetch(`/api/data/package-plans/${encodeURIComponent(planKey)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "ลบไม่สำเร็จ");
        return;
      }
      fetchPlans();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 min-w-0 max-w-full">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 truncate">
          <CreditCard size={22} className="text-pink-400 shrink-0" />
          แพ็กเกจ
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1 break-words">
          จัดการแพ็กเกจ — แก้ไข ลบ (ดูว่าร้านเป็นแพ็กเกจไหนได้ที่เมนู ผู้ใช้)
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-pink-400" />
        </div>
      ) : (
        <>
          <section className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-pink-200 mb-3">รายการแพ็กเกจ</h2>
            <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden min-w-0">
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full text-sm text-left min-w-[640px]">
                  <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
                    <tr>
                      <th className="px-2 sm:px-4 py-3 whitespace-nowrap">แพ็กเกจ</th>
                      <th className="px-2 sm:px-4 py-3 whitespace-nowrap">ระยะเวลา</th>
                      <th className="px-2 sm:px-4 py-3 whitespace-nowrap">หมวดหมู่</th>
                      <th className="px-2 sm:px-4 py-3 whitespace-nowrap">สินค้าแสดง</th>
                      <th className="px-2 sm:px-4 py-3 whitespace-nowrap">ขยายแผนที่</th>
                      <th className="px-2 sm:px-4 py-3 whitespace-nowrap">เครดิตโฆษณา</th>
                      <th className="px-2 sm:px-4 py-3 whitespace-nowrap">ราคา (เหรียญ)</th>
                      <th className="px-2 sm:px-4 py-3 w-28 text-center whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300 divide-y divide-white/10">
                    {plans.map((p) => (
                      <tr key={p.plan_key} className="hover:bg-slate-800/30">
                        <td className="px-2 sm:px-4 py-3 font-medium min-w-0 max-w-[120px] truncate" title={p.name_th}>{p.name_th}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap">{p.duration_days} วัน</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap">ไม่เกิน {p.max_categories} หมวด</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap">{p.max_products_visible >= 999999 ? "ไม่จำกัด" : `ไม่เกิน ${p.max_products_visible}`}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap">{p.map_expansion_limit === 0 ? "ขยายไม่ได้" : `${p.map_expansion_limit} ครั้ง`}</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap">{p.ad_credits_granted} เหรียญ</td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap">{p.price_credits ?? 0} เหรียญ</td>
                        <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setEditing({ ...p })}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-700 hover:bg-slate-600 px-2 py-1.5 text-xs text-white"
                            >
                              <Pencil size={14} className="shrink-0" />
                              แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.plan_key)}
                              disabled={deleting !== null}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-900/60 hover:bg-red-800/60 px-2 py-1.5 text-xs text-red-200 disabled:opacity-50"
                            >
                              {deleting === p.plan_key ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Trash2 size={14} className="shrink-0" />}
                              ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !saving && setEditing(null)}>
              <div className="rounded-xl border border-white/10 bg-slate-900 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-base sm:text-lg font-semibold text-white break-words">แก้ไขแพ็กเกจ — {editing.name_th}</h3>
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (saving) return;
                    const form = e.currentTarget;
                    const get = (name: string) => (form.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value;
                    setSaving(true);
                    try {
                      const res = await fetch(`/api/data/package-plans/${editing.plan_key}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                          name_th: get("name_th") || editing.name_th,
                          duration_days: parseInt(get("duration_days") || String(editing.duration_days), 10),
                          max_categories: parseInt(get("max_categories") || String(editing.max_categories), 10),
                          max_products_visible: parseInt(get("max_products_visible") || String(editing.max_products_visible), 10),
                          map_expansion_limit: parseInt(get("map_expansion_limit") || String(editing.map_expansion_limit), 10),
                          ad_credits_granted: parseInt(get("ad_credits_granted") || String(editing.ad_credits_granted), 10),
                          price_credits: parseInt(get("price_credits") || String(editing.price_credits ?? 0), 10),
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        alert(data.error || "บันทึกไม่สำเร็จ");
                        return;
                      }
                      fetchPlans();
                      setEditing(null);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <div className="min-w-0">
                    <label className="block text-xs text-slate-400 mb-1">ชื่อ (ไทย)</label>
                    <input name="name_th" defaultValue={editing.name_th} className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label className="block text-xs text-slate-400 mb-1">ระยะเวลา (วัน)</label>
                      <input name="duration_days" type="number" min={1} defaultValue={editing.duration_days} className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white text-sm" />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs text-slate-400 mb-1">ราคา (เหรียญ)</label>
                      <input name="price_credits" type="number" min={0} defaultValue={editing.price_credits ?? 0} className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label className="block text-xs text-slate-400 mb-1">หมวดหมู่สูงสุด</label>
                      <input name="max_categories" type="number" min={0} defaultValue={editing.max_categories} className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white text-sm" />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs text-slate-400 mb-1">สินค้าแสดงสูงสุด</label>
                      <input name="max_products_visible" type="number" min={0} defaultValue={editing.max_products_visible} className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label className="block text-xs text-slate-400 mb-1">ขยายแผนที่ (ครั้ง)</label>
                      <input name="map_expansion_limit" type="number" min={0} defaultValue={editing.map_expansion_limit} className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white text-sm" />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs text-slate-400 mb-1">เครดิตโฆษณา (เหรียญ)</label>
                      <input name="ad_credits_granted" type="number" min={0} defaultValue={editing.ad_credits_granted} className="w-full min-w-0 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <button type="button" onClick={() => setEditing(null)} className="flex-1 min-w-[80px] rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">ยกเลิก</button>
                    <button type="submit" disabled={saving} className="flex-1 min-w-[80px] rounded-lg bg-pink-600 px-3 py-2 text-sm text-white hover:bg-pink-500 disabled:opacity-50 flex items-center justify-center gap-1">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : "บันทึก"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
