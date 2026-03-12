"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/store";
import { playNotificationSound } from "@/lib/playNotificationSound";
import { isMobile } from "@/lib/device";

type HistoryAnnouncement = {
  id: string;
  shopName: string;
  lockLabel?: string | null;
  message: string;
};

/**
 * โพลประวัติป้ายประกาศทุกหน้า — เมื่อมีประกาศใหม่:
 * - เพิ่มเข้า donationQueue (ให้หน้าแผนที่แสดงป๊อปอัปได้)
 * - ถ้าอยู่หน้าอื่นและเปิดเสียงอยู่ → เล่นเสียงแจ้งเตือน (ไม่แสดงป๊อปอัปเพื่อไม่รบกวน)
 */
export function BoardAnnouncementPoller() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const currentRoom = useStore((s) => s.currentRoom);
  const addDonation = useStore((s) => s.addDonation);
  const seenIds = useRef<Set<string>>(new Set());
  const firstRun = useRef(true);

  useEffect(() => {
    if (!currentRoom) return;
    const roomId = currentRoom;
    const mobile = isMobile();
    const historyPollMs = mobile ? 20_000 : 4_000;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timer = setTimeout(poll, historyPollMs);
        return;
      }
      try {
        const res = await fetch(`/api/data/announcements?roomId=${roomId}&history=1`, {
          credentials: "include",
        });
        const data = (await res.json()) as { announcements?: HistoryAnnouncement[] };
        const list = Array.isArray(data.announcements) ? data.announcements : [];
        if (firstRun.current) {
          firstRun.current = false;
          seenIds.current = new Set(list.map((a) => a.id));
          timer = setTimeout(poll, historyPollMs);
          return;
        }
        for (const ann of list) {
          if (!seenIds.current.has(ann.id)) {
            seenIds.current.add(ann.id);
            const senderName = ann.lockLabel ? `${ann.shopName} · ${ann.lockLabel}` : ann.shopName;
            addDonation({ senderName, message: ann.message });
            const isMapPage = pathnameRef.current === "/map";
            const soundOn = useStore.getState().donationSoundEnabled;
            if (!isMapPage && soundOn) {
              playNotificationSound();
            }
          }
        }
      } catch (_) {
        /* ignore */
      } finally {
        if (!stopped) timer = setTimeout(poll, historyPollMs);
      }
    };

    poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentRoom, addDonation]);

  useEffect(() => {
    firstRun.current = true;
    seenIds.current = new Set();
  }, [currentRoom]);

  return null;
}
