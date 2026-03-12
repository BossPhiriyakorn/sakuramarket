"use client";

import React from "react";
import { Minus, Plus, Eye, EyeOff, Volume2, VolumeX, ScrollText } from "lucide-react";

export interface FloatingControlsProps {
  showGridLines: boolean;
  onToggleGridLines: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** เปิดประวัติประกาศ (ป้ายประกาศ) — ถ้ามีจะแสดงเป็นไอคอนในกรอบเดียวกัน */
  onOpenAnnouncementHistory?: () => void;
  /** มีประกาศใหม่ที่ยังไม่ได้อ่าน (แสดงจุดแดงที่ไอคอนประกาศ) */
  announcementHasUnread?: boolean;
}

export function FloatingControls({
  showGridLines,
  onToggleGridLines,
  soundEnabled,
  onToggleSound,
  onZoomIn,
  onZoomOut,
  onOpenAnnouncementHistory,
  announcementHasUnread = false,
}: FloatingControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="app-glass rounded-xl p-1 flex flex-col gap-1">
        {onOpenAnnouncementHistory != null && (
          <>
            <button
              type="button"
              onClick={onOpenAnnouncementHistory}
              className="relative p-2.5 rounded-md transition-all text-pink-400 hover:bg-white/10"
              title="ประวัติประกาศ"
              aria-label="เปิดประวัติประกาศ"
            >
              <ScrollText size={20} />
              {announcementHasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-slate-900" aria-hidden />
              )}
            </button>
            <div className="h-px bg-pink-900/20 mx-2" />
          </>
        )}
        <button
          type="button"
          onClick={onToggleGridLines}
          className={`p-2.5 rounded-md transition-all ${
            showGridLines ? "text-pink-400 hover:bg-white/10" : "bg-white/10 text-slate-500"
          }`}
          title={showGridLines ? "ซ่อนเส้นตาราง" : "แสดงเส้นตาราง"}
          aria-label={showGridLines ? "ซ่อนเส้นตาราง" : "แสดงเส้นตาราง"}
        >
          {showGridLines ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
        <button
          type="button"
          onClick={onToggleSound}
          className={`p-2.5 rounded-md transition-all ${
            soundEnabled ? "text-pink-400 hover:bg-white/10" : "bg-white/10 text-slate-500"
          }`}
          title={soundEnabled ? "ปิดเสียงแจ้งเตือนประกาศ/โดเนท" : "เปิดเสียงแจ้งเตือนประกาศ/โดเนท"}
          aria-label={soundEnabled ? "ปิดเสียงแจ้งเตือน" : "เปิดเสียงแจ้งเตือน"}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
        <div className="h-px bg-pink-900/20 mx-2" />
        <button
          type="button"
          onClick={onZoomIn}
          className="p-2.5 text-pink-400 hover:bg-white/10 rounded-md transition-colors"
        >
          <Plus size={20} />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="p-2.5 text-pink-400 hover:bg-white/10 rounded-md transition-colors"
        >
          <Minus size={20} />
        </button>
      </div>
    </div>
  );
}
