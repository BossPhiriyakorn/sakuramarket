"use client";

import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

let nextId = 0;

export const useToastStore = create<{
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType) => number;
  removeToast: (id: number) => void;
}>((set) => ({
  toasts: [],
  addToast: (message, type = "info") => {
    const id = ++nextId;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    return id;
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
