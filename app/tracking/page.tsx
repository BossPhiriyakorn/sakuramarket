"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { ProductReviewSection } from "@/components/ProductReviewSection";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";
import {
  Package,
  Store,
  Truck,
  Check,
  Loader2,
  UserCheck,
  ImageUp,
  X,
  Star,
  Copy,
} from "lucide-react";

/** Fallback เมื่อโหลด ref_status ไม่ได้ */
const SHIPPING_LABEL_FALLBACK: Record<string, string> = {
  pending_confirmation: "รอยืนยันออเดอร์",
  preparing: "เตรียมจัดส่ง",
  shipped: "จัดส่ง",
  received: "ได้รับสินค้าแล้ว",
  completed: "สำเร็จ",
  cancelled: "ยกเลิก",
};

type BuyerOrder = {
  id: string;
  user_id: string;
  status: string;
  total: number;
  created_at: string;
  items: Array<{
    id: string;
    order_id: string;
    shop_id: string;
    shop_name: string;
    product_name: string;
    product_image_url: string;
    quantity: number;
    line_total: number;
    shipping_status: string;
    tracking_number: string | null;
    shipping_notes?: string | null;
    shipped_at: string | null;
    received_at: string | null;
    proof_url: string | null;
  }>;
};

type SellerItem = {
  id: string;
  order_id: string;
  shop_id: string;
  product_name: string;
  product_image_url: string;
  quantity: number;
  line_total: number;
  shipping_status: string;
  tracking_number: string | null;
  shipping_notes?: string | null;
  shipped_at: string | null;
  received_at: string | null;
  proof_url: string | null;
  order_created_at: string;
};

function TrackingContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<"recipient" | "sender">(
    tabParam === "sender" ? "sender" : "recipient"
  );
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>([]);
  const [sellerData, setSellerData] = useState<{ shop: { id: string; shop_name: string } | null; items: SellerItem[] }>({ shop: null, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [shipModal, setShipModal] = useState<{ item: SellerItem; tracking_number: string; shipping_notes: string } | null>(null);
  const [receiveModal, setReceiveModal] = useState<{ item: BuyerOrder["items"][0] } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [shippingLabels, setShippingLabels] = useState<Record<string, string>>(SHIPPING_LABEL_FALLBACK);
  // รีวิวสินค้า
  const [unreviewedItems, setUnreviewedItems] = useState<Array<{ order_item_id: string; product_id: string; product_name: string; product_image_url: string; shop_name: string }>>([]);
  const [reviewModal, setReviewModal] = useState<{ order_item_id: string; product_id: string; product_name: string } | null>(null);

  const getShippingLabel = (code: string) => shippingLabels[code] ?? SHIPPING_LABEL_FALLBACK[code] ?? code;

  const loadUnreviewed = () => {
    fetch("/api/data/me/product-reviews", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { items?: typeof unreviewedItems }) => {
        setUnreviewedItems(data.items ?? []);
      })
      .catch(() => {});
  };

  const fetchBuyer = () => {
    fetch("/api/data/me/tracking", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { orders?: BuyerOrder[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setBuyerOrders(data.orders ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  };

  const fetchSeller = () => {
    fetch("/api/data/me/shop-tracking", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { items?: SellerItem[]; shop?: { id: string; shop_name: string } | null; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setSellerData({ shop: data.shop ?? null, items: data.items ?? [] });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  };

  useEffect(() => {
    fetch("/api/data/ref-status?type=order_item_shipping", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { items?: { code: string; label_th: string }[] }) => {
        if (Array.isArray(data.items) && data.items.length > 0) {
          setShippingLabels(
            data.items.reduce<Record<string, string>>((acc, { code, label_th }) => {
              acc[code] = label_th;
              return acc;
            }, {})
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadUnreviewed(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  const loadData = () => {
    setError(null);
    setLoading(true);
    Promise.all([
      fetch("/api/data/me/tracking", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/data/me/shop-tracking", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([buyerRes, sellerRes]) => {
        if ((buyerRes as { error?: string }).error) throw new Error((buyerRes as { error: string }).error);
        setBuyerOrders((buyerRes as { orders?: BuyerOrder[] }).orders ?? []);
        const s = sellerRes as { items?: SellerItem[]; shop?: { id: string; shop_name: string } | null; error?: string };
        if (s.error) throw new Error(s.error);
        setSellerData({ shop: s.shop ?? null, items: s.items ?? [] });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  // อัปเดตรายการติดตามสินค้าแบบ near real-time (โพลทุก 60 วินาที เมื่อแท็บเปิดอยู่)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const poll = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") loadData();
    };
    timer = setInterval(poll, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- loadData is stable

  const runAction = async (itemId: string, action: "confirm" | "ship" | "receive", extra?: { tracking_number?: string; shipping_notes?: string; proof_url?: string }) => {
    setActionLoading(itemId);
    try {
      const body: { action: string; tracking_number?: string; shipping_notes?: string; proof_url?: string } = { action };
      if (extra?.tracking_number !== undefined) body.tracking_number = extra.tracking_number;
      if (extra?.shipping_notes !== undefined) body.shipping_notes = extra.shipping_notes;
      if (extra?.proof_url) body.proof_url = extra.proof_url;
      const res = await fetch(`/api/data/me/order-items/${itemId}/shipping`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "ดำเนินการไม่สำเร็จ");
      fetchBuyer();
      fetchSeller();
      if (action === "receive") loadUnreviewed();
      setReceiveModal(null);
      setShipModal(null);
      setProofFile(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setActionLoading(null);
    }
  };

  const uploadProof = async (): Promise<string | null> => {
    if (!proofFile) return null;
    setProofUploading(true);
    try {
      const form = new FormData();
      form.append("file", proofFile);
      form.append("folder", "profile");
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "อัปโหลดไม่สำเร็จ");
      return (data as { url: string }).url;
    } catch {
      return null;
    } finally {
      setProofUploading(false);
    }
  };

  const handleReceiveSubmit = async (item: BuyerOrder["items"][0]) => {
    const proofUrl = await uploadProof();
    await runAction(item.id, "receive", { proof_url: proofUrl ?? undefined });
  };

  const ordersAsRecipient = buyerOrders;

  return (
    <div className="app-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />
      <UnifiedHeader />

      <main className="relative z-10 w-full max-w-2xl mx-auto p-4 md:p-6 space-y-4 flex-1">
        <h1 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <Package size={22} className="text-pink-400 shrink-0" />
          ติดตามสินค้า
        </h1>
        {/* Tabs */}
        <div className="flex rounded-xl app-glass-subtle p-1">
          <button
            type="button"
            onClick={() => setTab("recipient")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "recipient" ? "bg-pink-600 text-white" : "text-slate-400 hover:text-pink-200"
            }`}
          >
            <UserCheck size={18} />
            ผู้รับ
          </button>
          <button
            type="button"
            onClick={() => setTab("sender")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "sender" ? "bg-pink-600 text-white" : "text-slate-400 hover:text-pink-200"
            }`}
          >
            <Truck size={18} />
            ผู้ส่ง
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-sm px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadData()}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-red-800/50 hover:bg-red-700/50 text-red-200 font-medium text-sm transition-colors"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-pink-400 animate-spin" />
          </div>
        ) : tab === "recipient" ? (
          <>
            <p className="text-slate-400 text-sm">
              ติดตามสถานะการขนส่งและกดยืนยันรับสินค้าเมื่อได้รับของแล้ว (รายการที่คุณเป็นผู้ซื้อและรอรับจากร้าน)
            </p>
            {ordersAsRecipient.length === 0 ? (
              <div className="rounded-xl app-glass p-8 text-center">
                <Package size={48} className="mx-auto text-pink-500/50 mb-4" />
                <p className="text-slate-400">ยังไม่มีรายการที่รอรับ</p>
                <p className="text-slate-500 text-sm mt-1">เมื่อมีคำสั่งซื้อที่รอรับของ จะแสดงในหน้านี้</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {ordersAsRecipient.map((order) => (
                  <li key={order.id} className="rounded-xl app-glass overflow-hidden">
                    <div className="px-4 py-2.5 app-glass-subtle border-b border-white/10 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-pink-300">#{order.id.slice(0, 8)}</span>
                      <span>{new Date(order.created_at).toLocaleDateString("th-TH")}</span>
                      <span>รวม {order.total.toLocaleString()} เหรียญ</span>
                    </div>
                    <ul className="divide-y divide-pink-900/20">
                      {order.items.map((item) => (
                        <li key={item.id} className="p-4 flex flex-wrap gap-3 items-start">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                            {item.product_image_url ? (
                              <img src={getDriveImageDisplayUrl(item.product_image_url)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package size={24} className="text-pink-500/50" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm">{item.product_name}</p>
                            <p className="text-pink-400 text-xs flex items-center gap-1 mt-0.5">
                              <Store size={12} />
                              {item.shop_name}
                            </p>
                            <p className="text-slate-400 text-xs mt-1">
                              สถานะ: {getShippingLabel(item.shipping_status)}
                            </p>
                            {item.shipping_status === "shipped" && (item.tracking_number || item.shipping_notes) && (
                              <div className="mt-2 p-2.5 rounded-lg bg-slate-800/80 border border-pink-900/20">
                                <p className="text-slate-400 text-xs mb-1">รายละเอียดการจัดส่งจากร้าน</p>
                                {item.tracking_number && (
                                  <p className="text-slate-200 text-xs font-mono break-all">ลิงค์/รหัสติดตาม: {item.tracking_number}</p>
                                )}
                                {item.shipping_notes && (
                                  <p className="text-slate-300 text-xs mt-1 whitespace-pre-wrap">{item.shipping_notes}</p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const text = [
                                      item.tracking_number ? `ลิงค์/รหัสติดตาม: ${item.tracking_number}` : "",
                                      item.shipping_notes ? item.shipping_notes : "",
                                    ].filter(Boolean).join("\n\n");
                                    if (text) navigator.clipboard.writeText(text).then(() => alert("คัดลอกแล้ว")).catch(() => {});
                                  }}
                                  className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-pink-900/30 text-pink-200 hover:bg-pink-900/50 text-xs font-medium"
                                >
                                  <Copy size={12} /> คัดลอก
                                </button>
                              </div>
                            )}
                            {item.shipping_status === "shipped" && (
                              <button
                                type="button"
                                onClick={() => setReceiveModal({ item })}
                                disabled={actionLoading === item.id}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/80 hover:bg-green-500 text-white text-xs font-medium disabled:opacity-50"
                              >
                                {actionLoading === item.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                รับสินค้า
                              </button>
                            )}
                            {item.shipping_status === "received" && item.proof_url && (
                              <a
                                href={item.proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-pink-400 hover:underline mt-1 inline-flex items-center gap-1"
                              >
                                <ImageUp size={12} /> ดูรูปหลักฐาน
                              </a>
                            )}
                            {item.shipping_status === "received" && unreviewedItems.some((u) => u.order_item_id === item.id) && (
                              <button
                                type="button"
                                onClick={() => setReviewModal({ order_item_id: item.id, product_id: unreviewedItems.find((u) => u.order_item_id === item.id)!.product_id, product_name: item.product_name })}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-medium"
                              >
                                <Star size={13} className="fill-white" />
                                เขียนรีวิว
                              </button>
                            )}
                            {item.shipping_status === "received" && !unreviewedItems.some((u) => u.order_item_id === item.id) && (
                              <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                                <Star size={12} className="fill-amber-400 text-amber-400" />
                                รีวิวแล้ว
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            {!sellerData.shop ? (
              <div className="rounded-xl app-glass p-8 text-center">
                <Store size={48} className="mx-auto text-pink-500/50 mb-4" />
                <p className="text-slate-400">คุณยังไม่มีร้านค้า</p>
                <p className="text-slate-500 text-sm mt-1">ลงทะเบียนร้านและมีคำสั่งซื้อก่อน จึงจะเห็นรายการที่ต้องจัดส่ง</p>
                <Link href="/manage-shop" className="inline-block mt-4 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium">
                  จัดการร้านค้า
                </Link>
              </div>
            ) : (
              <>
                <p className="text-slate-400 text-sm">
                  อัปเดตสถานะขนส่ง: ยืนยันออเดอร์ → เตรียมส่ง → กดจัดส่ง (กรอกรายละเอียดในป๊อปอัป) รายการที่ลูกค้ากดรับแล้วจะแสดงรูปหลักฐานได้
                </p>
                {sellerData.items.length === 0 ? (
                  <div className="rounded-xl app-glass p-6 text-center">
                    <Truck size={40} className="mx-auto text-pink-500/50 mb-3" />
                    <p className="text-slate-400">ยังไม่มีรายการที่ต้องจัดส่ง</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {sellerData.items.map((item) => (
                      <li key={item.id} className="rounded-xl app-glass p-4">
                        <div className="flex gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                            {item.product_image_url ? (
                              <img src={getDriveImageDisplayUrl(item.product_image_url)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package size={20} className="text-pink-500/50" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm">{item.product_name}</p>
                            <p className="text-slate-400 text-xs">
                              {item.quantity} ชิ้น · {Number(item.line_total).toLocaleString()} เหรียญ
                            </p>
                            <p className="text-slate-500 text-xs mt-1">
                              สถานะ: {getShippingLabel(item.shipping_status)}
                            </p>
                            {item.shipping_status === "pending_confirmation" && (
                              <button
                                type="button"
                                onClick={() => runAction(item.id, "confirm")}
                                disabled={actionLoading === item.id}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium disabled:opacity-50"
                              >
                                {actionLoading === item.id ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                                ยืนยันการรับออเดอร์
                              </button>
                            )}
                            {item.shipping_status === "preparing" && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => setShipModal({ item, tracking_number: "", shipping_notes: "" })}
                                  disabled={actionLoading === item.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium disabled:opacity-50"
                                >
                                  {actionLoading === item.id ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                                  จัดส่ง
                                </button>
                              </div>
                            )}
                            {item.shipping_status === "shipped" && (item.tracking_number || item.shipping_notes) && (
                              <p className="text-slate-300 text-xs mt-1">
                                {item.tracking_number && <span className="font-mono">เลขติดตาม: {item.tracking_number}</span>}
                                {item.shipping_notes && <span className="block mt-0.5 text-slate-400">{item.shipping_notes}</span>}
                              </p>
                            )}
                            {item.shipping_status === "received" && (
                              <>
                                <p className="text-green-400 text-xs mt-1">ลูกค้ารับแล้ว</p>
                                {item.proof_url && (
                                  <a
                                    href={item.proof_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-pink-400 hover:underline mt-1 inline-flex items-center gap-1"
                                  >
                                    <ImageUp size={12} /> ดูรูปหลักฐานจากผู้รับ
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Modal รีวิวสินค้า */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setReviewModal(null)}>
          <div className="rounded-xl app-glass max-w-md w-full max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Star size={16} className="text-amber-400 fill-amber-400" />
                เขียนรีวิวสินค้า
              </h3>
              <button type="button" onClick={() => setReviewModal(null)} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <p className="text-pink-200 text-sm font-medium mb-4">{reviewModal.product_name}</p>
            <ProductReviewSection
              productId={reviewModal.product_id}
              productName={reviewModal.product_name}
              pendingOrderItemId={reviewModal.order_item_id}
              onReviewed={() => { setReviewModal(null); loadUnreviewed(); }}
            />
          </div>
        </div>
      )}

      {/* Modal จัดส่ง: กรอกลิงค์/รหัสติดตาม + รายละเอียด */}
      {shipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShipModal(null)}>
          <div className="rounded-xl app-glass max-w-sm w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Truck size={20} className="text-green-400" />
                รายละเอียดการจัดส่ง
              </h3>
              <button type="button" onClick={() => setShipModal(null)} className="p-1 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-3">{shipModal.item.product_name}</p>
            <label className="block text-slate-400 text-xs mb-1">ลิงค์หรือรหัสติดตามสินค้า</label>
            <input
              type="text"
              placeholder="เช่น ลิงค์ขนส่ง หรือเลขพัสดุ"
              value={shipModal.tracking_number}
              onChange={(e) => setShipModal((prev) => prev ? { ...prev, tracking_number: e.target.value } : null)}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white text-sm px-3 py-2 mb-3"
            />
            <label className="block text-slate-400 text-xs mb-1">รายละเอียดเพิ่มเติม (ถ้ามี)</label>
            <textarea
              placeholder="ข้อความสำหรับผู้รับ เช่น หมายเหตุการส่ง"
              value={shipModal.shipping_notes}
              onChange={(e) => setShipModal((prev) => prev ? { ...prev, shipping_notes: e.target.value } : null)}
              rows={3}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white text-sm px-3 py-2 mb-4 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShipModal(null)}
                className="flex-1 py-2 rounded-lg border border-pink-900/30 text-slate-300 hover:bg-slate-800 text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!shipModal) return;
                  runAction(shipModal.item.id, "ship", {
                    tracking_number: shipModal.tracking_number.trim() || "",
                    shipping_notes: shipModal.shipping_notes.trim() || "",
                  });
                }}
                disabled={actionLoading === shipModal?.item.id}
                className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {actionLoading === shipModal?.item.id ? <Loader2 size={18} className="animate-spin" /> : <><Truck size={18} /> จัดส่ง</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal รับสินค้า + อัปโหลดหลักฐาน */}
      {receiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setReceiveModal(null)}>
          <div className="rounded-xl app-glass max-w-sm w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">ยืนยันรับสินค้า</h3>
              <button type="button" onClick={() => setReceiveModal(null)} className="p-1 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-3">{receiveModal.item.product_name}</p>
            <label className="block text-slate-400 text-xs mb-1">อัปโหลดรูปหลักฐาน (ถ้ามี)</label>
            <input
              type="file"
              accept="image/*"
              className="w-full text-sm text-slate-300 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-pink-600 file:text-white"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setReceiveModal(null)}
                className="flex-1 py-2 rounded-lg border border-pink-900/30 text-slate-300 hover:bg-slate-800 text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleReceiveSubmit(receiveModal.item)}
                disabled={actionLoading === receiveModal.item.id || proofUploading}
                className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {actionLoading === receiveModal.item.id || proofUploading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Check size={18} />
                    ยืนยันรับ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="app-page-bg min-h-screen flex items-center justify-center text-slate-400">กำลังโหลด...</div>}>
      <TrackingContent />
    </Suspense>
  );
}
