"use client";

import React from "react";

interface OnlineBadgeProps {
  lastSeenAt: string | null | undefined;
  /** "full" = จุด + ข้อความ (default), "dot" = จุดอย่างเดียว */
  variant?: "full" | "dot";
  className?: string;
}

/** ออนไลน์ถ้า last_seen_at ภายใน 3 นาที (ลดการหลุดเมื่อเบราว์เซอร์ throttle แท็บในพื้นหลัง) */
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

function formatLastSeen(lastSeenAt: string): string {
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_THRESHOLD_MS) return "ออนไลน์";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `ออนไลน์ ${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `ออนไลน์ ${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(diff / 86_400_000);
  return `ออนไลน์ ${days} วันที่แล้ว`;
}

function isOnline(lastSeenAt: string): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

export function OnlineBadge({ lastSeenAt, variant = "full", className = "" }: OnlineBadgeProps) {
  if (!lastSeenAt) return null;

  const online = isOnline(lastSeenAt);
  const label = formatLastSeen(lastSeenAt);

  if (variant === "dot") {
    return (
      <span
        title={label}
        className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
          online ? "bg-emerald-400" : "bg-slate-500"
        } ${className}`}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          online ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-slate-500"
        }`}
      />
      <span className={`text-xs ${online ? "text-emerald-400" : "text-slate-400"}`}>
        {label}
      </span>
    </span>
  );
}
