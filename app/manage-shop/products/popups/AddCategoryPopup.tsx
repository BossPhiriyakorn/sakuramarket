"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

export interface AddCategoryPopupProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}

export function AddCategoryPopup({
  open,
  onClose,
  onAdd,
}: AddCategoryPopupProps) {
  const [name, setName] = useState("");

  // ล้างช่องกรอกเมื่อเปิด/ปิด popup
  useEffect(() => {
    if (!open) setName("");
  }, [open]);

  const handleClose = () => {
    setName("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-sm bg-slate-950 border border-pink-900/50 rounded-xl shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">เพิ่มหมวด</h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg text-pink-400 hover:bg-pink-950/30"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm text-pink-300/80 mb-2">
            ชื่อหมวดใหม่
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="กรุณากรอก"
            className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-pink-900/30 text-white focus:outline-none focus:border-pink-500/50 mb-4"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-lg border border-pink-900/30 text-pink-400 hover:bg-pink-950/20 font-medium"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
