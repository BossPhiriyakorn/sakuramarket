"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { CreditCard, ArrowLeft, Loader2, MapPin, FolderOpen, Package, Sparkles } from "lucide-react";

type PlanRow = {
  plan_key: string;
  name_th: string;
  duration_days: number;
  max_categories: number;
  max_products_visible: number;
  map_expansion_limit: number;
  ad_credits_granted: number;
  sort_order: number;
  price_credits?: number;
};

export default function PackagesPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/data/package-plans", { cache: "no-store" }).then((r) => r.json()).then((d: { plans?: PlanRow[] }) => setPlans(Array.isArray(d.plans) ? d.plans : [])).catch(() => setPlans([])),
      fetch("/api/data/me/balance", { credentials: "include" }).then((r) => r.json()).then((d: { balance?: number }) => setBalance(typeof d.balance === "number" ? d.balance : 0)).catch(() => setBalance(0)),
    ]).finally(() => setLoading(false));
  }, []);

  const displayPlans = plans.length > 0 ? plans : [
    { plan_key: "free", name_th: "ฟรี", duration_days: 7, max_categories: 3, max_products_visible: 10, map_expansion_limit: 0, ad_credits_granted: 5, sort_order: 0, price_credits: 0 },
    { plan_key: "basic", name_th: "พื้นฐาน", duration_days: 15, max_categories: 5, max_products_visible: 10, map_expansion_limit: 3, ad_credits_granted: 15, sort_order: 1, price_credits: 50 },
    { plan_key: "pro", name_th: "โปร", duration_days: 30, max_categories: 10, max_products_visible: 999999, map_expansion_limit: 5, ad_credits_granted: 50, sort_order: 2, price_credits: 150 },
  ].sort((a, b) => a.sort_order - b.sort_order);

  const onSubscribe = async (planKey: string) => {
    if (subscribing) return;
    setSubscribing(planKey);
    try {
      const res = await fetch("/api/data/me/shop/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_key: planKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "สมัครไม่สำเร็จ");
        return;
      }
      alert("สมัครแพ็กเกจสำเร็จ");
      window.location.reload();
    } finally {
      setSubscribing(null);
    }
  };

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.55 }} aria-hidden />
      <div className="relative z-10 flex flex-col flex-1">
        <UnifiedHeader />
        <main className="w-full max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <div className="rounded-xl border border-pink-900/20 bg-slate-900/95 shadow-lg px-4 py-4">
            <div className="flex items-center gap-3">
              <Link href="/map" className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors" aria-label="กลับ">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <CreditCard size={22} className="text-pink-400" />
                แพ็กเกจ
              </h1>
            </div>
            <p className="text-slate-300 text-sm mt-2 ml-11">
              เลือกแพ็กเกจที่เหมาะกับร้านคุณ — ชำระด้วยเหรียญได้เลย ไม่ต้องติดต่อแอดมิน
            </p>
            {balance !== null && (
              <p className="text-pink-200 text-sm mt-1 ml-11">
                เหรียญคงเหลือ: <span className="font-semibold">{balance}</span> เหรียญ
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-pink-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayPlans.map((plan) => (
                <div
                  key={plan.plan_key}
                  className={`rounded-xl border p-5 flex flex-col shadow-lg ${
                    plan.plan_key === "pro"
                      ? "border-pink-500/50 bg-slate-900/95 ring-1 ring-pink-500/30"
                      : plan.plan_key === "basic"
                        ? "border-pink-900/40 bg-slate-900/95"
                        : "border-pink-900/30 bg-slate-900/95"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {plan.plan_key === "pro" && <Sparkles size={18} className="text-pink-400 shrink-0" />}
                    <h2 className="text-lg font-bold text-white">{plan.name_th}</h2>
                  </div>
                  <p className="text-pink-300 font-semibold text-sm mb-4">
                    {plan.duration_days} วัน
                  </p>
                  <ul className="space-y-2 text-sm text-slate-200 flex-1">
                    <li className="flex items-center gap-2">
                      <FolderOpen size={14} className="text-pink-400 shrink-0" />
                      หมวดหมู่ได้ไม่เกิน {plan.max_categories} หมวด
                    </li>
                    <li className="flex items-center gap-2">
                      <Package size={14} className="text-pink-400 shrink-0" />
                      สินค้าแสดงได้ {plan.max_products_visible >= 999999 ? "ไม่จำกัด" : `ไม่เกิน ${plan.max_products_visible} รายการ`}
                    </li>
                    <li className="flex items-center gap-2">
                      <MapPin size={14} className="text-pink-400 shrink-0" />
                      {plan.plan_key === "free"
                        ? "จองล็อคในแผนที่ได้ 1 ครั้ง (ขยายไม่ได้)"
                        : `ขยายล็อคในแผนที่ได้ ${plan.map_expansion_limit} ครั้ง`}
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-400 shrink-0" />
                      เครดิตโฆษณา {plan.ad_credits_granted} เหรียญ
                    </li>
                  </ul>
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                    <p className="text-pink-200 font-semibold">
                      {plan.price_credits == null || plan.price_credits === 0 ? "ฟรี" : `${plan.price_credits} เหรียญ`}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSubscribe(plan.plan_key)}
                      disabled={subscribing !== null || (plan.price_credits != null && plan.price_credits > 0 && (balance ?? 0) < plan.price_credits)}
                      className="w-full rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      {subscribing === plan.plan_key ? <Loader2 size={16} className="animate-spin" /> : plan.price_credits === 0 ? "สมัครฟรี" : "ชำระด้วยเหรียญ"}
                    </button>
                    <p className="text-slate-400 text-xs">ต้องมีร้านก่อนถึงจะสมัครแพ็กเกจได้</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-pink-900/20 bg-slate-900/95 shadow-lg p-4">
            <p className="font-medium text-slate-200 mb-1">เมื่อแพ็กเกจหมดอายุ</p>
            <p className="text-slate-300 text-sm">สินค้าและหมวดที่เกินจำนวนจะถูกซ่อนอัตโนมัติ (แสดงตามยอดขาย/ล่าสุด) คุณยังสามารถเปิด-ปิดการแสดงสินค้าได้เองภายในจำนวนที่แพ็กเกจอนุญาต</p>
          </div>
        </main>
      </div>
    </div>
  );
}
