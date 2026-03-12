"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ArrowLeft } from "lucide-react";

type Step = "email" | "otp";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ส่ง OTP ไม่สำเร็จ");
        if (data.cooldownSeconds) setCooldownSeconds(data.cooldownSeconds);
        return;
      }
      setStep("otp");
      if (data.cooldownSeconds) setCooldownSeconds(data.cooldownSeconds);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
        return;
      }
      router.push("/login?reset=1");
      // ไม่ต้องเรียก router.refresh() — /login เป็น static page ไม่มี RSC ที่ต้องการ refresh
      // router.refresh() อาจทำให้ navigation ไปยัง /login ถูก interrupt ก่อนที่หน้าจะโหลดเสร็จ
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-pink-500/20 px-4 py-3 flex items-center justify-center">
        <h1 className="text-lg font-bold text-white">Sakura Market</h1>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-6 text-pink-400">
            <KeyRound size={24} />
            <h2 className="text-xl font-bold">ลืมรหัสผ่าน</h2>
          </div>

          {step === "email" ? (
            <form
              onSubmit={handleRequestOtp}
              className="rounded-xl border border-pink-900/30 bg-slate-900/40 p-6 space-y-4"
            >
              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <p className="text-sm text-slate-400">
                กรอกอีเมลที่ใช้สมัครสมาชิก เราจะส่งรหัส OTP ไปให้คุณเพื่อตั้งรหัสผ่านใหม่
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  placeholder="กรุณากรอกอีเมล"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={otpLoading || cooldownSeconds > 0}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {otpLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : cooldownSeconds > 0 ? (
                  `รอ ${cooldownSeconds} วินาที`
                ) : (
                  "ขอ OTP"
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleResetPassword}
              className="rounded-xl border border-pink-900/30 bg-slate-900/40 p-6 space-y-4"
            >
              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <p className="text-sm text-slate-400">
                ใส่รหัส OTP ที่ส่งไปยัง <span className="text-slate-300">{email}</span> แล้วตั้งรหัสผ่านใหม่
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">รหัส OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  placeholder="กรุณากรอกรหัส OTP"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">ยืนยันรหัสผ่าน</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  placeholder="กรุณากรอกอีกครั้ง"
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : "ตั้งรหัสผ่านใหม่"}
              </button>
              <button
                type="button"
                onClick={() => setStep("email")}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 py-2.5 text-sm"
              >
                <ArrowLeft size={16} />
                เปลี่ยนอีเมล
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-slate-400 text-sm">
            <Link href="/login" className="text-pink-400 hover:text-pink-300 inline-flex items-center gap-1">
              <ArrowLeft size={14} />
              กลับไปเข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
