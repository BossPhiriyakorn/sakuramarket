"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ScrollText, Loader2 } from "lucide-react";
import type { RoomId } from "@/types";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

type AnnouncementHistoryItem = {
  id: string;
  shopName: string;
  lockLabel?: string | null;
  parcelId?: string | null;
  message: string;
  createdAt?: string;
  linkUrl?: string | null;
  logoUrl?: string | null;
  /** ห้องที่ประกาศนี้ส่งไป */
  roomId?: number;
  roomName?: string | null;
};

interface AnnouncementHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  currentRoom: RoomId;
  roomOptions: number[];
  roomNames: Record<number, string>;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function AnnouncementHistoryPanel({
  open,
  onClose,
  currentRoom,
  roomOptions,
  roomNames,
}: AnnouncementHistoryPanelProps) {
  const [roomId, setRoomId] = useState<number>(currentRoom);
  const [list, setList] = useState<AnnouncementHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    setRoomId(currentRoom);
  }, [currentRoom, open]);

  useEffect(() => {
    if (!open) setIsClosing(false);
  }, [open]);

  useEffect(() => {
    if (!open || !roomId) return;
    setLoading(true);
    fetch(`/api/data/announcements?roomId=${roomId}&history=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { announcements?: AnnouncementHistoryItem[] }) => {
        setList(Array.isArray(data.announcements) ? data.announcements : []);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [open, roomId]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => onClose(), 250);
  };

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[105] pointer-events-auto transition-opacity duration-200 ${isClosing ? "opacity-0" : "opacity-100"}`}
        onClick={handleClose}
        aria-hidden
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 w-full max-w-md app-glass border-l border-white/10 shadow-2xl z-[110] flex flex-col pointer-events-auto safe-top safe-bottom ${
          isClosing ? "animate-slide-out-to-right" : "animate-slide-in-from-right"
        }`}
        role="dialog"
        aria-label="ประวัติประกาศ"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - ลูกศร + กลับ ไม่มีกรอบปุ่ม */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 text-pink-300 hover:text-white transition-colors shrink-0 py-1 -ml-1"
            aria-label="กลับ"
          >
            <ArrowLeft size={20} />
            <span>กลับ</span>
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ScrollText size={22} className="text-pink-400 shrink-0" />
            <h2 className="text-lg font-bold text-white truncate">ประวัติประกาศ</h2>
          </div>
        </div>

        <p className="text-xs text-pink-300/70 px-4 pt-2 pb-3 shrink-0">
          ประกาศที่ส่งไปแล้วในห้องนี้ (ไม่เกี่ยวกับแถบ Live)
        </p>

        {/* เลือกห้อง */}
        <div className="px-4 pb-4 shrink-0 flex flex-wrap gap-2">
          {roomOptions.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setRoomId(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                roomId === id
                  ? "bg-pink-600 text-white"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
              }`}
            >
              {roomNames[id] ?? `ห้อง ${id}`}
            </button>
          ))}
        </div>

        {/* รายการประกาศ - แบบแชท */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="text-pink-400 animate-spin" />
              <span className="text-sm text-slate-400">กำลังโหลดประวัติ...</span>
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-pink-400/60 py-8 text-center">
              ยังไม่มีประกาศในห้องนี้
            </p>
          ) : (
            <ul className="space-y-3 pb-2">
              {list.map((ann) => (
                <li key={ann.id}>
                  <div className="rounded-xl app-glass-subtle p-3">
                    {(ann.roomName != null && ann.roomName !== "") && (
                      <p className="text-[11px] text-pink-400/80 mb-1">
                        ประกาศในห้อง: {ann.roomName}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm truncate min-w-0">
                        {ann.parcelId ? (
                          <Link
                            href={`/shop/${ann.parcelId}`}
                            className="text-pink-400 hover:text-pink-300 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {ann.shopName}
                          </Link>
                        ) : (
                          <span className="text-pink-400">{ann.shopName}</span>
                        )}
                      </span>
                      {ann.createdAt && (
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {formatDate(ann.createdAt)}
                        </span>
                      )}
                    </div>
                    {ann.lockLabel && (
                      <p className="text-[11px] text-slate-500 mb-1">
                        ร้านอยู่: {ann.lockLabel}
                      </p>
                    )}
                    <p className="text-slate-100 text-sm whitespace-pre-wrap break-words">
                      {ann.message}
                    </p>
                    {ann.logoUrl && (
                      <div className="mt-2 flex justify-start">
                        <img src={getDriveImageDisplayUrl(ann.logoUrl)} alt="" className="h-10 w-10 rounded object-contain bg-slate-800" />
                      </div>
                    )}
                    {ann.linkUrl && (
                      <a
                        href={ann.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-pink-400 hover:text-pink-300 text-xs truncate max-w-full"
                      >
                        {ann.linkUrl}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
