"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { Bell, Loader2, ChevronRight, Check } from "lucide-react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link_path: string | null;
  link_meta: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [list, setList] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = () => {
    fetch("/api/data/me/notifications", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { notifications?: NotificationItem[]; unreadCount?: number }) => {
        setList(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      })
      .catch(() => {
        setList([]);
        setUnreadCount(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkAllRead = () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    fetch("/api/data/me/notifications", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(() => {
        setUnreadCount(0);
        setList((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      })
      .finally(() => setMarkingAll(false));
  };

  const handleClick = (n: NotificationItem) => {
    if (!n.read_at) {
      fetch("/api/data/me/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
      setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.link_path) {
      router.push(n.link_path);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <UnifiedHeader showUsername />
      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell size={24} className="text-pink-400" />
            การแจ้งเตือน
          </h1>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="text-sm text-pink-400 hover:text-pink-300 disabled:opacity-50 flex items-center gap-1"
            >
              {markingAll ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              อ่านทั้งหมด
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-pink-400" />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            ยังไม่มีรายการแจ้งเตือน
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    n.read_at
                      ? "border-slate-800 bg-slate-900/50 hover:bg-slate-800/50"
                      : "border-pink-900/40 bg-pink-950/20 hover:bg-pink-950/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white truncate">{n.title}</p>
                      <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(n.created_at).toLocaleString("th-TH")}
                      </p>
                    </div>
                    {n.link_path && (
                      <ChevronRight size={20} className="text-slate-500 shrink-0" />
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
