"use client";

import React from "react";
import { Shield } from "lucide-react";

interface VerifiedBadgeProps {
  /** สี: blue หรือ green */
  variant?: "blue" | "green";
  /** ขนาดไอคอน (px) */
  size?: number;
  /** แสดง tooltip หรือข้อความ */
  title?: string;
  className?: string;
}

/**
 * ไอคอนโล่ยืนยันตัวตน/ร้าน — แสดงให้ผู้ใช้อื่นเห็น (สีฟ้าหรือสีเขียว)
 */
export function VerifiedBadge({
  variant = "green",
  size = 20,
  title = "ยืนยันแล้ว",
  className = "",
}: VerifiedBadgeProps) {
  const colorClass = variant === "blue" ? "text-blue-400" : "text-emerald-400";
  return (
    <span
      className={`inline-flex items-center justify-center ${colorClass} ${className}`}
      title={title}
      role="img"
      aria-label={title}
    >
      <Shield size={size} className="fill-current" />
    </span>
  );
}
