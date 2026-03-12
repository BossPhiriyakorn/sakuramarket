"use client";

import React from "react";
import { Megaphone } from "lucide-react";
import type { Announcement } from "@/types";

export interface AnnouncementsBarProps {
  announcements: Announcement[];
}

export function AnnouncementsBar({ announcements }: AnnouncementsBarProps) {
  return (
    <div className="w-full md:max-w-2xl app-glass rounded-lg overflow-hidden flex items-center h-8 pointer-events-auto">
      <div className="bg-pink-600 px-3 h-full flex items-center z-10 shadow-r shadow-pink-900/40">
        <Megaphone size={12} className="text-white mr-2" />
        <span className="hidden md:inline text-[10px] font-bold text-white uppercase tracking-widest">
          Live
        </span>
      </div>
      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        <div className="animate-marquee">
          {announcements.map((ann) => (
            <span key={ann.id} className="inline-flex items-center mx-8">
              <span className="text-pink-400 font-bold text-xs uppercase mr-2">
                [{ann.lockLabel ? `${ann.shopName} · ${ann.lockLabel}` : ann.shopName}]
              </span>
              <span className="text-slate-100 text-xs font-medium">
                {ann.message}
              </span>
              {ann.linkUrl && (
                <a
                  href={ann.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-pink-400 hover:text-pink-300 underline text-xs truncate max-w-[160px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  ลิงก์
                </a>
              )}
              <span className="ml-8 text-pink-500/40 text-sm">🌸</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
