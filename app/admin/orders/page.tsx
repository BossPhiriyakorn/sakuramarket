"use client";

import React, { useState, useEffect } from "react";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระ",
  paid: "ชำระแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

type OrderRow = { id: string; user_id: string; status: string; subtotal: number; gas_fee: number; total: number; created_at: string };
type OrderItemRow = { id: string; order_id: string; product_name: string; quantity: number; price: number; line_total: number };

export default function CmsOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);

  useEffect(() => {
    fetch("/api/data/orders")
      .then((r) => r.json())
      .then((data: { orders?: OrderRow[]; orderItems?: OrderItemRow[] }) => {
        setOrders(Array.isArray(data?.orders) ? data.orders : []);
        setOrderItems(Array.isArray(data?.orderItems) ? data.orderItems : []);
      })
      .catch(() => {});
  }, []);

  const getItems = (orderId: string) => orderItems.filter((i) => i.order_id === orderId);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-bold text-white">คำสั่งซื้อ</h1>
      <p className="text-slate-400 text-sm mt-1 mb-6">
        ดูคำสั่งซื้อ (orders, order_items)
      </p>
      <div className="space-y-4">
        {orders.map((o) => {
          const items = getItems(o.id);
          return (
            <div key={o.id} className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
              <div className="px-4 py-3 bg-slate-800/50 flex flex-wrap items-center gap-4 text-sm">
                <span className="font-mono text-pink-300">#{o.id}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  o.status === "completed" ? "bg-green-900/50 text-green-300" :
                  o.status === "paid" ? "bg-blue-900/50 text-blue-300" :
                  o.status === "pending" ? "bg-amber-900/50 text-amber-300" :
                  "bg-slate-700 text-slate-400"
                }`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <span className="text-slate-400">ยอดรวม {o.total.toLocaleString()} เหรียญ</span>
                <span className="text-slate-500 text-xs">{new Date(o.created_at).toLocaleString("th-TH")}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/30 text-slate-400 text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left">สินค้า</th>
                      <th className="px-4 py-2 text-right">จำนวน</th>
                      <th className="px-4 py-2 text-right">ราคา (เหรียญ)</th>
                      <th className="px-4 py-2 text-right">รวม (เหรียญ)</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300 divide-y divide-pink-900/20">
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td className="px-4 py-2">{i.product_name}</td>
                        <td className="px-4 py-2 text-right">{i.quantity}</td>
                        <td className="px-4 py-2 text-right">{Number(i.price).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{Number(i.line_total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
