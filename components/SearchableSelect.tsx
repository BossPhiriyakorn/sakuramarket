"use client";

import React, { useState, useRef, useEffect } from "react";

export type OptionItem = {
  id: number;
  name_th: string;
  name_en?: string;
  zip_code?: number;
};

type Props = {
  options: OptionItem[];
  value: string;
  onChange: (name_th: string, id: number, extra?: { zip_code?: number }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "เลือกหรือพิมพ์ค้นหา...",
  disabled = false,
  className = "",
  inputClassName = "",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) =>
    o.name_th.toLowerCase().includes(search.toLowerCase().trim())
  );

  useEffect(() => {
    if (!isOpen) return;
    const onBlur = (e: FocusEvent) => {
      const target = e.relatedTarget as Node | null;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    const el = containerRef.current;
    el?.addEventListener("focusout", onBlur);
    return () => el?.removeEventListener("focusout", onBlur);
  }, [isOpen]);

  const displayText = isOpen ? search : value;
  const showList = isOpen && !disabled;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={displayText}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          if (!disabled) {
            setIsOpen(true);
            setSearch(value);
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
      />
      {showList && (
        <ul
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-pink-900/30 bg-slate-800 py-1 text-sm shadow-lg"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">ไม่พบรายการ</li>
          ) : (
            filtered.map((o) => (
              <li
                key={o.id}
                role="option"
                aria-selected={value === o.name_th}
                className="cursor-pointer px-3 py-2 text-white hover:bg-pink-900/30 focus:bg-pink-900/30"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.name_th, o.id, o.zip_code !== undefined ? { zip_code: o.zip_code } : undefined);
                  setSearch("");
                  setIsOpen(false);
                }}
              >
                {o.name_th}
                {o.zip_code !== undefined && (
                  <span className="ml-2 text-slate-400">({o.zip_code})</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
