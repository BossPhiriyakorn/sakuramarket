"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStore, DONATION_SOUND_KEY, SOUND_UNLOCK_DONE_KEY } from "../store";
import { getMinZoom, MAX_ZOOM } from "../constants";
import { UnifiedHeader } from "./UnifiedHeader";
import { AnnouncementsBar } from "./map/AnnouncementsBar";
import { AnnouncementHistoryPanel } from "./map/AnnouncementHistoryPanel";
import { FloatingControls } from "./map/FloatingControls";
import { DonationPopUp } from "./map/DonationPopUp";
import { Volume2 } from "lucide-react";
import type { Announcement } from "@/types";
import { unlockAudioForNotifications } from "@/lib/playNotificationSound";
import { isMobile } from "@/lib/device";

export const UIOverlay = () => {
  const setViewport = useStore((s) => s.setViewport);
  const announcements = useStore((s) => s.announcements);
  const showGridLines = useStore((s) => s.showGridLines);
  const setShowGridLines = useStore((s) => s.setShowGridLines);
  const donationSoundEnabled = useStore((s) => s.donationSoundEnabled);
  const setDonationSoundEnabled = useStore((s) => s.setDonationSoundEnabled);
  const donationQueue = useStore((s) => s.donationQueue);
  const removeDonation = useStore((s) => s.removeDonation);
  const setAnnouncements = useStore((s) => s.setAnnouncements);
  const currentRoom = useStore((s) => s.currentRoom);
  const setCurrentRoom = useStore((s) => s.setCurrentRoom);
  const [announcementHistoryOpen, setAnnouncementHistoryOpen] = useState(false);
  const [announcementHasUnread, setAnnouncementHasUnread] = useState(false);
  const rooms = useStore((s) => s.rooms); // โหลดครั้งเดียวจาก App → store (ลดเรียก /api/data/rooms ซ้ำบนมือถือ)
  const [showSoundUnlockHint, setShowSoundUnlockHint] = useState(false);
  const soundUnlockHintDismissed = useRef(false);

  const roomOptions = rooms.map((r) => r.id);
  const roomNames: Record<number, string> = Object.fromEntries(
    rooms.map((r) => [r.id, (r.name && r.name.trim()) || `ห้อง ${r.id}`])
  );

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(DONATION_SOUND_KEY);
      const alreadyUnlocked = window.localStorage.getItem(SOUND_UNLOCK_DONE_KEY) === "true";
      if (v === "true" || v === "false") {
        setDonationSoundEnabled(v === "true");
        if (v === "true" && !alreadyUnlocked && !soundUnlockHintDismissed.current) setShowSoundUnlockHint(true);
      }
    } catch (_) {
      /* ignore */
    }
  }, [setDonationSoundEnabled]);

  // โมดัลเปิดเสียง: กันไม่ให้ปิดด้วย Escape
  useEffect(() => {
    if (!showSoundUnlockHint || !donationSoundEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [showSoundUnlockHint, donationSoundEnabled]);

  // ช่วงโพล Real-time: บนมือถือใช้ช่วงยาวขึ้น เพื่อลดโหลดและความเสี่ยงมือถือค้าง/รีเฟรช
  const mobile = isMobile();
  const announcementsPollMs = mobile ? 30_000 : 8_000;   // มือถือยืดช่วงโพลเพื่อลดภาระ

  // โพลประกาศวิ่ง — อัปเดตแถบ Live เท่านั้น (ประกาศวิ่งไม่เด้งป๊อปอัป) — ส่ง cookie สำหรับมือถือ
  useEffect(() => {
    if (!currentRoom) return;
    const roomId = currentRoom;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timer = setTimeout(poll, announcementsPollMs);
        return;
      }
      try {
        const res = await fetch(`/api/data/announcements?roomId=${roomId}`, { credentials: "include" });
        const data = (await res.json()) as { announcements?: Announcement[] };
        const list = Array.isArray(data.announcements) ? data.announcements : [];
        setAnnouncements(list);
      } catch (_) {
        /* ignore */
      } finally {
        timer = setTimeout(poll, announcementsPollMs);
      }
    };
    poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentRoom, setAnnouncements, announcementsPollMs]);

  // มีประกาศใหม่ที่ยังไม่ได้อ่าน (จุดแดงไอคอนประวัติประกาศ)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/data/me/announcements/has-unread", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { hasUnread?: boolean }) => {
        if (!cancelled && typeof data.hasUnread === "boolean") setAnnouncementHasUnread(data.hasUnread);
      })
      .catch(() => {
        if (!cancelled) setAnnouncementHasUnread(false);
      });
    return () => {
      cancelled = true;
    };
  }, [announcementHistoryOpen]);

  // โพลประวัติป้ายประกาศย้ายไป BoardAnnouncementPoller ใน layout — เล่นเสียงทุกหน้า, ป๊อปอัปแสดงเฉพาะหน้าแผนที่ (ที่นี่)

  const handleOpenAnnouncementHistory = () => {
    fetch("/api/data/me/announcements/mark-read", { method: "POST", credentials: "include" })
      .then(() => setAnnouncementHasUnread(false))
      .catch(() => {});
    setAnnouncementHistoryOpen(true);
  };

  const handleZoomIn = () => {
    const zoom = useStore.getState().viewport.zoom;
    setViewport({ zoom: Math.min(zoom * 1.2, MAX_ZOOM) });
  };
  const handleZoomOut = () => {
    const zoom = useStore.getState().viewport.zoom;
    setViewport({ zoom: Math.max(zoom / 1.2, getMinZoom(mobile)) });
  };

  const currentDonation = donationQueue[0] ?? null;

  return (
    <div className="w-full h-full flex flex-col pointer-events-none">
      <UnifiedHeader
        showBrand
        showUsername
        showRoomSwitcher
        currentRoom={currentRoom}
        setCurrentRoom={setCurrentRoom}
        roomOptions={roomOptions}
        roomNames={roomNames}
      />

      {/* โมดัลบังคับกดเปิด/ปิดเสียง 1 ครั้ง — ปิดได้เฉพาะเมื่อกดปุ่ม "เปิดเสียงแจ้งเตือน" เท่านั้น */}
      {showSoundUnlockHint && donationSoundEnabled && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 pointer-events-auto"
          onKeyDown={(e) => e.key === "Escape" && e.preventDefault()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sound-unlock-title"
        >
          <div className="w-full max-w-sm rounded-xl app-glass p-6 text-center">
            <p id="sound-unlock-title" className="text-slate-200 text-sm mb-6">
              กรุณาเปิด/ปิด เสียง 1 ครั้ง เพื่อให้แสดงเสียงแจ้งเตือนประกาศได้
            </p>
            <button
              type="button"
              onClick={() => {
                unlockAudioForNotifications();
                try {
                  window.localStorage.setItem(SOUND_UNLOCK_DONE_KEY, "true");
                } catch (_) {}
                soundUnlockHintDismissed.current = true;
                setShowSoundUnlockHint(false);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium transition-colors"
            >
              <Volume2 size={20} />
              เปิดเสียงแจ้งเตือน
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 px-3 py-4 sm:px-4 md:px-6 flex flex-col justify-start">
        <AnnouncementsBar announcements={announcements} />
        <DonationPopUp
          current={currentDonation}
          soundEnabled={donationSoundEnabled}
          onDismiss={removeDonation}
        />
      </div>

      <div className="px-3 pt-2 pb-4 safe-bottom sm:px-4 md:px-6 flex justify-end items-end">
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <FloatingControls
            showGridLines={showGridLines}
            onToggleGridLines={() => setShowGridLines(!showGridLines)}
            soundEnabled={donationSoundEnabled}
            onToggleSound={() => {
              const next = !donationSoundEnabled;
              setDonationSoundEnabled(next);
              if (next) {
                unlockAudioForNotifications();
                try {
                  window.localStorage.setItem(SOUND_UNLOCK_DONE_KEY, "true");
                } catch (_) {}
                soundUnlockHintDismissed.current = true;
                setShowSoundUnlockHint(false);
              }
            }}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onOpenAnnouncementHistory={handleOpenAnnouncementHistory}
            announcementHasUnread={announcementHasUnread}
          />
        </div>
      </div>

      <AnnouncementHistoryPanel
        open={announcementHistoryOpen}
        onClose={() => setAnnouncementHistoryOpen(false)}
        currentRoom={currentRoom}
        roomOptions={roomOptions}
        roomNames={roomNames}
      />
    </div>
  );
};
