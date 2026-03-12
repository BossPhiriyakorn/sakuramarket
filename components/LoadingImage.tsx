"use client";

import React from "react";

const LOADING_GIF = "/loading/loading.gif";

interface LoadingImageProps {
  /** ข้อความใต้รูป (ถ้ามี) */
  message?: string;
  /** คลาสของ container */
  className?: string;
  /** ขนาดรูป (ความกว้าง) เช่น 48, 64 */
  size?: number;
}

/**
 * แสดงรูปโหลด (loading.gif) ใช้ในส่วนที่ต้องรอโหลดก่อนไปส่วนถัดไป
 */
export function LoadingImage({ message = "กำลังโหลด...", className = "", size = 64 }: LoadingImageProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-slate-400 ${className}`}
      role="status"
      aria-label={message}
    >
      <img
        src={LOADING_GIF}
        alt=""
        width={size}
        height={size}
        className="object-contain"
      />
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
