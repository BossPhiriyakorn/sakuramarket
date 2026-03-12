"use client";

import React from "react";

/** แปลงสตริงเป็น #rrggbb สำหรับใช้กับ input type="color" */
function toHex6(s: string): string {
  const raw = String(s).replace(/^#/, "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[0] + raw[0];
    const g = raw[1] + raw[1];
    const b = raw[2] + raw[2];
    return `#${r}${g}${b}`.toLowerCase();
  }
  return "#ec4899";
}

/** จากค่าที่ผู้ใช้พิมพ์ (อาจไม่มี # หรือ 3 หลัก) คืนค่าเป็น #rrggbb หรือค่าที่เก็บเดิม */
function normalizeHexInput(s: string): string {
  const raw = String(s).replace(/^#/, "").trim();
  if (raw === "") return "";
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[0] + raw[0];
    const g = raw[1] + raw[1];
    const b = raw[2] + raw[2];
    return `#${r}${g}${b}`.toLowerCase();
  }
  return s;
}

export interface LogoBackgroundColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  /** ค่าเริ่มต้นเมื่อ value ว่าง (ใช้กับ color picker) */
  defaultHex?: string;
}

export function LogoBackgroundColorPicker({
  value,
  onChange,
  label = "สีพื้นหลังโลโก้",
  placeholder = "กรุณากรอก (หากมี)",
  className = "",
  defaultHex = "#ec4899",
}: LogoBackgroundColorPickerProps) {
  const hexForColorInput = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : toHex6(value || defaultHex);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === "") {
      onChange("");
      return;
    }
    const normalized = normalizeHexInput(v);
    onChange(normalized);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={className}>
      {label ? (
        <label className="block text-sm font-medium text-pink-200 mb-1.5">
          {label}
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hexForColorInput}
          onChange={handleColorChange}
          title="เลือกสี"
          className="w-10 h-10 rounded border border-pink-900/30 cursor-pointer bg-slate-800 shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          placeholder={placeholder}
          className="flex-1 min-w-0 max-w-xs px-4 py-2.5 rounded-lg bg-slate-800 border border-pink-900/30 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm font-mono"
          aria-label="โค้ดสี (hex)"
        />
      </div>
      <p className="text-xs text-slate-500 mt-1">
        ใส่โค้ดสี (เช่น #ec4899 หรือ fff) หรือกดสี่เหลี่ยมเพื่อเลือกสี
      </p>
    </div>
  );
}
