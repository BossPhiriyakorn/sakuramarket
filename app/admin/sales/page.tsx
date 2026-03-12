"use client";

import React, { useState, useEffect } from "react";
import { ShoppingBag } from "lucide-react";
import { LoadingImage } from "@/components/LoadingImage";

const CATEGORY_LABEL: Record<string, string> = {
  frame: "กรอบตกแต่ง",
  megaphone: "ประกาศวิ่ง",
  board: "ป้ายประกาศ",
  other: "อื่นๆ",
};

const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งานอยู่",
  used: "ใช้แล้ว",
  expired: "หมดอายุ",
};

type SaleRow = {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  product_id: string;
  product_name: string;
  category: string;
  price_unit: string;
  purchased_at: string;
  expires_at: string | null;
  uses_left: number | null;
  status: string;
};

export default function CmsSalesPage() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/data/sales")
      .then((r) => r.json())
      .then((data: { sales?: SaleRow[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setSales(Array.isArray(data.sales) ? data.sales : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        <ShoppingBag size={22} className="text-pink-400" />
        ประวัติการซื้อสินค้า
      </h1>
      <p className="text-slate-400 text-sm mt-1 mb-6">
        รายการที่ซื้อจาก Item Shop — กรอบตกแต่ง, ประกาศวิ่ง, ป้ายประกาศ ฯลฯ
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingImage message="กำลังโหลดประวัติการซื้อ..." size={64} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">เมื่อ</th>
                  <th className="px-4 py-3">ผู้ซื้อ</th>
                  <th className="px-4 py-3">หมวด</th>
                  <th className="px-4 py-3">รายการ</th>
                  <th className="px-4 py-3">หน่วย</th>
                  <th className="px-4 py-3">หมดอายุ</th>
                  <th className="px-4 py-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="text-slate-300 divide-y divide-pink-900/20">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      — ยังไม่มีรายการซื้อจาก Item Shop
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(s.purchased_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">
                          {s.display_name || s.username}
                        </span>
                        {s.display_name && (
                          <span className="text-slate-500 text-xs ml-1">(@{s.username})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-pink-950/50 text-pink-300">
                          {CATEGORY_LABEL[s.category] ?? s.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">{s.product_name}</td>
                      <td className="px-4 py-3 text-slate-400">{s.price_unit}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {s.expires_at
                          ? new Date(s.expires_at).toLocaleDateString("th-TH")
                          : s.uses_left !== null
                          ? `ใช้ได้ ${s.uses_left} ครั้ง`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            s.status === "active"
                              ? "bg-emerald-900/50 text-emerald-300"
                              : s.status === "used"
                              ? "bg-blue-900/50 text-blue-300"
                              : "bg-slate-700 text-slate-400"
                          }`}
                        >
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
