"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { ArrowLeft, BarChart2, Megaphone, Loader2, Eye, List, Users, TrendingUp } from "lucide-react";
import { useToastStore } from "@/store/toastStore";

type MostViewedProduct = { product_id: string; product_name: string; view_count: number };

type AdData = {
  activeAd: {
    id: string;
    amount_paid: number;
    days: number | null;
    start_at: string;
    end_at: string;
    ad_type?: string;
    clicks_purchased?: number | null;
    clicks_used?: number | null;
  } | null;
  totalAdSpend: number;
  shop_views: number;
  product_list_views: number;
  total_visitors: number;
  most_viewed_products?: MostViewedProduct[];
};

export default function ManageShopAdPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [data, setData] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adCredits, setAdCredits] = useState<number | null>(null);
  const [coinsPerClick, setCoinsPerClick] = useState<number>(1);
  const [clicksCount, setClicksCount] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  const totalForClicks = clicksCount * coinsPerClick;
  const creditsToClicks = coinsPerClick > 0 && adCredits != null ? Math.floor(adCredits / coinsPerClick) : 0;

  useEffect(() => {
    Promise.all([
      fetch("/api/data/me/shop/ad", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/data/me/ad-credits", { credentials: "include" }).then((r) => r.json()).catch(() => ({ credits: 0 })),
      fetch("/api/data/ad-price-tiers").then((r) => r.json()).then((d: { coins_per_click?: number }) => {
        setCoinsPerClick(typeof d.coins_per_click === "number" ? d.coins_per_click : 1);
      }),
    ])
      .then(([adRes, creditsRes]) => {
        if (adRes.error && adRes.activeAd === undefined) {
          setData(null);
          return;
        }
        setData({
          activeAd: adRes.activeAd ?? null,
          totalAdSpend: adRes.totalAdSpend ?? 0,
          shop_views: adRes.shop_views ?? 0,
          product_list_views: adRes.product_list_views ?? 0,
          total_visitors: adRes.total_visitors ?? 0,
          most_viewed_products: Array.isArray(adRes.most_viewed_products) ? adRes.most_viewed_products : [],
        } as AdData);
        setAdCredits(typeof creditsRes.credits === "number" ? creditsRes.credits : 0);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const cnt = Math.max(1, Math.min(99999, Math.floor(clicksCount)));
    const amt = cnt * coinsPerClick;
    if (amt > 0 && adCredits !== null && amt > adCredits) {
      addToast("เครดิตโฆษณาไม่เพียงพอ (ใช้เครดิตฟรีโฆษณาหรือเหรียญ)", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/data/me/shop/ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ad_type: "clicks", clicks_count: cnt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "เปิดใช้งานโฆษณาไม่สำเร็จ");
      addToast("เปิดใช้งานโฆษณาเรียบร้อย", "success");
      setClicksCount(100);
      const refetch = await fetch("/api/data/me/shop/ad", { credentials: "include" });
      const next = await refetch.json();
      setData({
        activeAd: next.activeAd ?? null,
        totalAdSpend: next.totalAdSpend ?? 0,
        shop_views: next.shop_views ?? 0,
        product_list_views: next.product_list_views ?? 0,
        total_visitors: next.total_visitors ?? 0,
        most_viewed_products: Array.isArray(next.most_viewed_products) ? next.most_viewed_products : [],
      } as AdData);
      if (typeof adCredits === "number" && amt > 0) setAdCredits(adCredits - amt);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "เปิดใช้งานโฆษณาไม่สำเร็จ", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />
      <div className="relative z-10 flex flex-col flex-1">
        <UnifiedHeader />
        <main className="w-full max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href="/manage-shop"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="กลับ"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Megaphone size={22} className="text-pink-400" />
              โฆษณาร้านค้า
            </h1>
          </div>
          <p className="text-slate-400 text-sm">
            เปิดใช้งานโฆษณาแบบต่อคลิก — ร้านจะอยู่บนรายการร้านค้า คิดเงินเมื่อมีคนกดเข้าดูร้าน (คลิกละแอดมินตั้งค่า)
          </p>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-pink-400" />
            </div>
          ) : (
            <>
              {/* เปิดใช้งานโฆษณา */}
              <section className="rounded-xl app-glass p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Megaphone size={18} />
                  เปิดใช้งานโฆษณา
                </h2>
                {adCredits !== null && (
                  <p className="text-slate-400 text-sm mb-2">
                    เครดิตโฆษณาคงเหลือ: <span className="text-pink-400 font-medium">{adCredits.toLocaleString()} เหรียญ</span>
                    {coinsPerClick > 0 && (
                      <span className="text-slate-500 text-xs ml-2">≈ ได้ประมาณ {creditsToClicks.toLocaleString()} คลิก</span>
                    )}
                  </p>
                )}
                <p className="text-slate-500 text-xs mb-4">คลิกละ <span className="text-pink-400 font-medium">{coinsPerClick}</span> เหรียญ (แอดมินตั้งค่า) — ใช้เครดิตฟรีโฆษณาหรือเหรียญ</p>
                <form onSubmit={handleActivate} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">จำนวนคลิกที่ต้องการ</label>
                    <input
                      type="number"
                      min={1}
                      max={99999}
                      value={clicksCount}
                      onChange={(e) => setClicksCount(Math.max(1, Math.min(99999, parseInt(e.target.value, 10) || 1)))}
                      className="w-full max-w-xs rounded-lg bg-slate-800 border border-pink-900/30 text-white px-4 py-2.5 focus:outline-none focus:border-pink-500/50"
                    />
                    <p className="text-pink-300/90 text-sm mt-2">
                      คลิกละ {coinsPerClick} เหรียญ = รวม {totalForClicks.toLocaleString()} เหรียญ
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Megaphone size={18} />}
                    {submitting ? "กำลังดำเนินการ..." : "เปิดใช้งานโฆษณา"}
                  </button>
                </form>
                {data?.activeAd && (
                  <div className="mt-4 p-4 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
                    <p className="text-emerald-300 text-sm font-medium">โฆษณากำลังเปิดอยู่</p>
                    <p className="text-slate-400 text-xs mt-1">
                      เหลือ {Math.max(0, (data.activeAd.clicks_purchased ?? 0) - (data.activeAd.clicks_used ?? 0))} คลิก
                    </p>
                  </div>
                )}
              </section>

              {/* Analytics */}
              <section className="rounded-xl app-glass p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart2 size={18} />
                  Analytics
                </h2>
                <p className="text-slate-400 text-sm mb-4">สถิติการเข้าชมร้าน (โดยประมาณ)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl bg-slate-800/60 p-4 border border-pink-900/20">
                    <div className="flex items-center gap-2 text-pink-400 mb-1">
                      <Eye size={18} />
                      <span className="text-sm font-medium">การกดเข้าดูร้าน</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{(data?.shop_views ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 p-4 border border-pink-900/20">
                    <div className="flex items-center gap-2 text-pink-400 mb-1">
                      <List size={18} />
                      <span className="text-sm font-medium">การดูรายการสินค้า</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{(data?.product_list_views ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 p-4 border border-pink-900/20">
                    <div className="flex items-center gap-2 text-pink-400 mb-1">
                      <Users size={18} />
                      <span className="text-sm font-medium">จำนวนผู้เข้าชม (โดยประมาณ)</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{(data?.total_visitors ?? 0).toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-3">ยอดรวมที่ใช้โฆษณา: {(data?.totalAdSpend ?? 0).toLocaleString()} เหรียญ</p>

                {/* รายการสินค้าที่คนดูเยอะสุด */}
                <div className="mt-6 pt-6 border-t border-pink-900/30">
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                    <TrendingUp size={18} className="text-pink-400" />
                    รายการสินค้าที่คนดูเยอะสุด
                  </h3>
                  {(data?.most_viewed_products?.length ?? 0) === 0 ? (
                    <p className="text-slate-500 text-sm">ยังไม่มีข้อมูล — เมื่อมีคนเข้าดูสินค้าในหน้าร้าน จะแสดงอันดับที่นี่</p>
                  ) : (
                    <ul className="space-y-2">
                      {data?.most_viewed_products?.map((item, index) => (
                        <li
                          key={item.product_id}
                          className="flex items-center gap-3 rounded-lg bg-slate-800/60 px-4 py-3 border border-pink-900/20"
                        >
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-600/30 text-pink-300 font-bold text-sm shrink-0">
                            {index + 1}
                          </span>
                          <span className="flex-1 truncate text-white font-medium">{item.product_name}</span>
                          <span className="text-pink-400 text-sm font-medium shrink-0">{item.view_count.toLocaleString()} ครั้ง</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
