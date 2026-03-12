"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { ArrowLeft, Wallet, Loader2 } from "lucide-react";

type PayoutRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "รอจ่าย",
  completed: "โอนแล้ว",
  cancelled: "ยกเลิก",
};

export default function ManageShopRevenuePage() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/data/me/shop/payouts")
      .then((r) => r.json())
      .then((data: { payouts?: PayoutRow[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setPayouts(Array.isArray(data.payouts) ? data.payouts : []);
      })
      .catch(() => setPayouts([]))
      .finally(() => setLoading(false));
  }, []);

  const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = payouts.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
  const completedAmount = payouts.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.amount, 0);

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
            <Wallet size={22} className="text-pink-400" />
            ตรวจสอบรายรับ
          </h1>
        </div>
        <p className="text-slate-400 text-sm">
          รายการรายได้จากคำสั่งซื้อเมื่อลูกค้ารับสินค้าแล้ว — รายการรอจ่ายจะได้รับการโอนจากแอดมิน
        </p>

        {/* สรุปยอด */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl app-glass p-4">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">รวมรายได้</p>
            <p className="text-2xl font-bold text-white">{totalAmount.toLocaleString()} เหรียญ</p>
          </div>
          <div className="rounded-xl app-glass p-4">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">รอจ่าย</p>
            <p className="text-2xl font-bold text-amber-400">{pendingAmount.toLocaleString()} เหรียญ</p>
          </div>
          <div className="rounded-xl app-glass p-4">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">โอนแล้ว</p>
            <p className="text-2xl font-bold text-emerald-400">{completedAmount.toLocaleString()} เหรียญ</p>
          </div>
        </div>

        {/* ตารางรายการ */}
        <div className="rounded-xl app-glass overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 size={32} className="animate-spin text-pink-400" />
            </div>
          ) : payouts.length === 0 ? (
            <p className="p-6 text-slate-500 text-sm text-center">ยังไม่มีรายการรายได้</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">วันที่</th>
                    <th className="px-4 py-3">คำสั่งซื้อ</th>
                    <th className="px-4 py-3 text-right">จำนวน (เหรียญ)</th>
                    <th className="px-4 py-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-pink-900/20">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                        {new Date(p.created_at).toLocaleDateString("th-TH")}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs truncate max-w-[140px]" title={p.order_id}>
                        {p.order_id}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{p.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            p.status === "completed"
                              ? "text-emerald-400"
                              : p.status === "cancelled"
                                ? "text-slate-500"
                                : "text-amber-400"
                          }
                        >
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                        {p.paid_at && (
                          <span className="block text-slate-500 text-xs">
                            {new Date(p.paid_at).toLocaleDateString("th-TH")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}
