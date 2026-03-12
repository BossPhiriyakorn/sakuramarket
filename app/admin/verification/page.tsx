"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, ExternalLink, Loader2 } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  business_registration: "ทะเบียนพาณิชย์",
  id_card: "บัตรประชาชน",
  tax_id: "เลขประจำตัวผู้เสียภาษี",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "รอตรวจ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
};

type DocRow = {
  id: string;
  shop_id: string;
  document_type: string;
  file_url: string;
  status: string;
  review_notes?: string | null;
  created_at: string;
};
type ShopRow = { id: string; shop_name: string; verification_status: string };

export default function CmsVerificationPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ docId: string } | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/data/verification-documents").then((r) => r.json()),
      fetch("/api/data/shops").then((r) => r.json()),
    ])
      .then(([docsData, shopsData]) => {
        setDocs(Array.isArray(docsData) ? docsData : []);
        setShops(Array.isArray(shopsData) ? shopsData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getShopName = (shopId: string) => shops.find((s) => s.id === shopId)?.shop_name ?? shopId;

  const handleApprove = async (docId: string) => {
    setActionId(docId);
    try {
      const res = await fetch(`/api/data/verification-documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (res.ok) {
        setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: "approved" } : d));
        setShops((prev) => prev.map((s) => {
          const doc = docs.find((d) => d.id === docId);
          return (s.id === doc?.shop_id) ? { ...s, verification_status: "verified" } : s;
        }));
      }
    } finally {
      setActionId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    const { docId } = rejectModal;
    setActionId(docId);
    try {
      const res = await fetch(`/api/data/verification-documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", review_notes: rejectNote.trim() || undefined }),
      });
      if (res.ok) {
        setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: "rejected", review_notes: rejectNote.trim() || null } : d));
        setShops((prev) => prev.map((s) => {
          const doc = docs.find((d) => d.id === docId);
          return (s.id === doc?.shop_id) ? { ...s, verification_status: "rejected" } : s;
        }));
      }
    } finally {
      setActionId(null);
      setRejectModal(null);
      setRejectNote("");
    }
  };

  const pendingDocs = docs.filter((d) => d.status === "pending");
  const otherDocs = docs.filter((d) => d.status !== "pending");

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">เอกสารยืนยันตัวตนร้าน</h1>
        <p className="text-slate-400 text-sm mt-1">
          ตรวจสอบและอนุมัติ/ปฏิเสธเอกสารยืนยันร้านค้า
        </p>
      </div>

      {loading && <p className="text-slate-400 text-sm">กำลังโหลด...</p>}

      {/* รอตรวจสอบ */}
      <section>
        <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          รอตรวจสอบ ({pendingDocs.length})
        </h2>
        {pendingDocs.length === 0 ? (
          <p className="text-slate-500 text-sm">ไม่มีเอกสารรอตรวจสอบ</p>
        ) : (
          <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">ร้าน</th>
                    <th className="px-4 py-3">ประเภทเอกสาร</th>
                    <th className="px-4 py-3">ไฟล์</th>
                    <th className="px-4 py-3">ส่งเมื่อ</th>
                    <th className="px-4 py-3 text-center w-44">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-pink-900/20">
                  {pendingDocs.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-white">{getShopName(d.shop_id)}</td>
                      <td className="px-4 py-3">{TYPE_LABEL[d.document_type] ?? d.document_type}</td>
                      <td className="px-4 py-3">
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-400 hover:text-pink-300 inline-flex items-center gap-1 text-xs"
                        >
                          <ExternalLink size={12} />
                          ดูไฟล์
                        </a>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(d.created_at).toLocaleDateString("th-TH")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            type="button"
                            disabled={actionId === d.id}
                            onClick={() => handleApprove(d.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
                          >
                            {actionId === d.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            อนุมัติ
                          </button>
                          <button
                            type="button"
                            disabled={actionId === d.id}
                            onClick={() => { setRejectModal({ docId: d.id }); setRejectNote(""); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-50"
                          >
                            <XCircle size={12} />
                            ปฏิเสธ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ดำเนินการแล้ว */}
      {otherDocs.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
            ดำเนินการแล้ว ({otherDocs.length})
          </h2>
          <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">ร้าน</th>
                    <th className="px-4 py-3">ประเภทเอกสาร</th>
                    <th className="px-4 py-3">ไฟล์</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">หมายเหตุ</th>
                    <th className="px-4 py-3">ส่งเมื่อ</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 divide-y divide-pink-900/20">
                  {otherDocs.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3">{getShopName(d.shop_id)}</td>
                      <td className="px-4 py-3">{TYPE_LABEL[d.document_type] ?? d.document_type}</td>
                      <td className="px-4 py-3">
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 inline-flex items-center gap-1 text-xs">
                          <ExternalLink size={12} />ดูไฟล์
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          d.status === "approved" ? "bg-green-900/50 text-green-300" :
                          d.status === "rejected" ? "bg-red-900/50 text-red-300" :
                          "bg-amber-900/50 text-amber-300"
                        }`}>
                          {STATUS_LABEL[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[160px] truncate">
                        {d.review_notes || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(d.created_at).toLocaleDateString("th-TH")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Modal ปฏิเสธ */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="rounded-xl border border-pink-900/30 bg-slate-900 w-full max-w-md">
            <div className="p-4 border-b border-pink-900/30">
              <h3 className="font-semibold text-white">ปฏิเสธเอกสาร</h3>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-slate-400 text-sm">เหตุผลที่ปฏิเสธ (ถ้ามี)</label>
              <textarea
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="w-full bg-slate-800 border border-pink-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500/50 resize-none"
                placeholder="เช่น เอกสารไม่ชัดเจน, ไม่ตรงกับชื่อร้าน ฯลฯ"
              />
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setRejectModal(null); setRejectNote(""); }}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-700 text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={!!actionId}
                  onClick={handleRejectConfirm}
                  className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {actionId ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  ยืนยันปฏิเสธ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
