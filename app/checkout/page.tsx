"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { Store, CreditCard, Loader2, CheckCircle, ArrowLeft, Package, Wallet } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";
import { useToastStore } from "@/store/toastStore";
import { CHECKOUT_GAS_FEE } from "@/constants";

export default function CheckoutPage() {
  const router = useRouter();
  const itemsByShop = useCartStore((s) => s.itemsByShop);
  const removeItem = useCartStore((s) => s.removeItem);
  const addToast = useToastStore((s) => s.addToast);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);
  const [walletLinked, setWalletLinked] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/data/me/wallet/token-balance", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { linked?: boolean }) => {
        if (!cancelled) setWalletLinked(!!data.linked);
      })
      .catch(() => {
        if (!cancelled) setWalletLinked(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { selectedGroups, subtotal, gasFee, total } = useMemo(() => {
    const entries = Object.entries(itemsByShop);
    const groups = entries
      .map(([shopId, g]) => ({
        shopId,
        shopName: g.shopName,
        shopImageUrl: g.shopImageUrl,
        items: g.items.filter((i) => i.selected !== false),
      }))
      .filter((g) => g.items.length > 0);

    let sub = 0;
    groups.forEach((g) => {
      g.items.forEach((i) => {
        sub += i.price * i.quantity;
      });
    });
    const gas = sub > 0 ? CHECKOUT_GAS_FEE : 0;
    return {
      selectedGroups: groups,
      subtotal: sub,
      gasFee: gas,
      total: sub + gas,
    };
  }, [itemsByShop]);

  const handlePay = async () => {
    setPayError(null);
    setPaying(true);
    try {
      const items = selectedGroups.flatMap((g) =>
        g.items.map((i) => ({
          shopId: g.shopId,
          productId: i.productId,
          productName: i.name,
          productImageUrl: i.image_url,
          price: i.price,
          quantity: i.quantity,
        }))
      );
      const res = await fetch("/api/data/me/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "ชำระเงินไม่สำเร็จ");
      }
      selectedGroups.forEach((g) => {
        g.items.forEach((i) => removeItem(g.shopId, i.productId));
      });
      setPaySuccess(true);
      addToast("ชำระเงินสำเร็จ กำลังพาคุณไปหน้ารายการสั่งซื้อ", "success");
      setTimeout(() => router.push("/tracking"), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
      setPayError(msg);
      addToast(msg, "error");
    } finally {
      setPaying(false);
    }
  };

  if (selectedGroups.length === 0) {
    return (
      <div className="app-page-bg min-h-screen text-slate-100 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-pink-400">ไม่มีรายการที่เลือกชำระ</p>
        <Link
          href="/map"
          className="flex items-center gap-2 text-pink-400 hover:text-white"
        >
          <ArrowLeft size={20} />
          กลับแผนที่
        </Link>
      </div>
    );
  }

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />
      <div className="relative z-10 flex flex-col flex-1">
        <UnifiedHeader />

      <main className="w-full max-w-2xl mx-auto p-4 md:p-6 space-y-6 flex-1">
        <h1 className="text-xl font-bold text-white mb-4">สรุปรายการสินค้า</h1>
        <section>
          <h2 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3">
            รายการสินค้า
          </h2>
          <ul className="space-y-4">
            {selectedGroups.map((group) => (
              <li
                key={group.shopId}
                className="rounded-xl app-glass overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 bg-pink-950/20 border-b border-pink-900/20">
                  {group.shopImageUrl && getDriveImageDisplayUrl(group.shopImageUrl) ? (
                    <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-pink-900/30 bg-slate-800">
                      <img
                        src={getDriveImageDisplayUrl(group.shopImageUrl)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <Store size={18} className="text-pink-400 shrink-0" />
                  )}
                  <span className="font-semibold text-white text-sm truncate">
                    {group.shopName}
                  </span>
                </div>
                <ul className="divide-y divide-pink-900/20">
                  {group.items.map((item) => (
                    <li
                      key={`${group.shopId}-${item.productId}`}
                      className="flex gap-3 p-3"
                    >
                      <div className="w-12 h-12 shrink-0 rounded-lg bg-slate-800 overflow-hidden border border-pink-900/20">
                        {item.image_url ? (
                          <img
                            src={getDriveImageDisplayUrl(item.image_url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-pink-500/50">
                            <Package size={20} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">
                          {item.name}
                        </p>
                        <p className="text-pink-400 text-sm">
                          {item.price.toLocaleString()} เหรียญ × {item.quantity} = {item.price * item.quantity} เหรียญ
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        {/* สรุปยอด */}
        <section className="rounded-xl app-glass p-4">
          <h2 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-3">
            สรุปการชำระเงิน
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>ยอดสินค้า</span>
              <span>{subtotal.toLocaleString()} เหรียญ</span>
            </div>
            {gasFee > 0 && (
              <div className="flex justify-between text-slate-300">
                <span>Gas fee</span>
                <span>{gasFee.toLocaleString()} เหรียญ</span>
              </div>
            )}
            <div className="border-t border-pink-900/30 pt-3 mt-3 flex justify-between font-bold text-white">
              <span>ยอดรวม</span>
              <span className="text-pink-400">{total === 0 ? "ฟรี" : `${total.toLocaleString()} เหรียญ`}</span>
            </div>
          </div>
        </section>

        {walletLinked === false && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 flex items-start gap-3 text-amber-200 text-sm">
            <Wallet size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">กรุณาผูกกระเป๋าก่อนทำการซื้อ</p>
              <p className="text-amber-300/80 mt-1">คุณยังไม่ได้ผูกกระเป๋า จึงไม่สามารถชำระเงินได้</p>
              <Link href="/profile" className="inline-block mt-2 text-pink-400 hover:text-pink-300 font-medium">
                ไปผูกกระเป๋าในโปรไฟล์ →
              </Link>
            </div>
          </div>
        )}
        {payError && (
          <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-red-300 text-sm">
            {payError}
          </div>
        )}
        {paySuccess ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-4 flex items-center gap-3 text-emerald-300">
            <CheckCircle size={22} className="shrink-0" />
            <div>
              <p className="font-semibold">ชำระเงินสำเร็จ!</p>
              <p className="text-sm text-emerald-400/80">กำลังนำไปยังหน้าติดตามสินค้า...</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handlePay}
            disabled={paying || walletLinked === false}
            className="w-full min-h-[48px] py-3.5 rounded-xl bg-pink-600 hover:bg-pink-500 active:scale-[0.98] disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-all duration-150 shadow-lg shadow-pink-900/20"
          >
            {paying ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
            {paying
              ? total === 0
                ? "กำลังดำเนินการ..."
                : "กำลังชำระเงิน..."
              : walletLinked === false
                ? "กรุณาผูกกระเป๋าก่อนชำระเงิน"
                : total === 0
                  ? "รับฟรี"
                  : `ชำระเงิน ${total.toLocaleString()} เหรียญ`}
          </button>
        )}
        </main>
      </div>
    </div>
  );
}
