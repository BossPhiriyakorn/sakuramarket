"use client";

import React, { useEffect } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { useToastStore, type ToastItem } from "@/store/toastStore";

const TOAST_DURATION_MS = 3_000;

function ToastItemView({ item }: { item: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast);

  useEffect(() => {
    const t = setTimeout(() => removeToast(item.id), TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [item.id, removeToast]);

  const icon =
    item.type === "success" ? (
      <CheckCircle size={20} className="text-emerald-400 shrink-0" />
    ) : item.type === "error" ? (
      <XCircle size={20} className="text-red-400 shrink-0" />
    ) : (
      <Info size={20} className="text-pink-400 shrink-0" />
    );

  const bg =
    item.type === "success"
      ? "bg-emerald-950/95 border-emerald-800/50"
      : item.type === "error"
        ? "bg-red-950/95 border-red-800/50"
        : "bg-slate-900/95 border-pink-900/50";

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${bg} animate-toast-in`}
    >
      {icon}
      <p className="text-sm text-slate-100 flex-1">{item.message}</p>
      <button
        type="button"
        onClick={() => removeToast(item.id)}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="ปิด"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastBar() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[10000] flex flex-col gap-2 max-w-md mx-auto pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItemView key={t.id} item={t} />
        ))}
      </div>
    </div>
  );
}
