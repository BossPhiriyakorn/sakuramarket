"use client";

import React, { useEffect, useState } from "react";
import type { DonationMessage } from "@/types";
import { playNotificationSound } from "@/lib/playNotificationSound";

const DISPLAY_DURATION_MS = 5000;

export interface DonationPopUpProps {
  current: DonationMessage | null;
  soundEnabled: boolean;
  onDismiss: (id: string) => void;
}

export function DonationPopUp({ current, soundEnabled, onDismiss }: DonationPopUpProps) {
  const [visible, setVisible] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    if (!current) {
      setVisible(false);
      return;
    }
    if (current.id !== lastId) {
      setLastId(current.id);
      setVisible(true);
      if (soundEnabled) playNotificationSound();
    }
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss(current.id);
    }, DISPLAY_DURATION_MS);
    return () => clearTimeout(t);
  }, [current, current?.id, lastId, soundEnabled, onDismiss]);

  if (!current || !visible) return null;

  return (
    <div
      className="pointer-events-none w-full max-w-md mx-auto mt-3 flex justify-center"
      aria-live="polite"
    >
      <div className="w-full rounded-xl border border-pink-500/30 bg-slate-950/90 backdrop-blur-md shadow-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-pink-900/30">
          <div className="flex items-center justify-between gap-2">
            <span className="text-pink-300 font-bold text-sm">
              {current.senderName}
            </span>
            {current.amount != null && current.amount !== "" && (
              <span className="text-white font-semibold text-sm">
                {current.amount} เหรียญ
              </span>
            )}
          </div>
        </div>
        <div className="px-4 py-4">
          <p className="text-slate-100 text-sm whitespace-pre-wrap break-words">
            {current.message}
          </p>
        </div>
      </div>
    </div>
  );
}
