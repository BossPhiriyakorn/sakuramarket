"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, User, Lock } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sakura_remember_email");
      if (saved) setEmailOrUsername(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("reset") === "1") {
      setSuccessMessage("ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่");
      router.replace("/login", { scroll: false });
    }
  }, [searchParams, router]);

  const loginWithCredentials = async (userEmailOrUsername: string, userPassword: string) => {
    setError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmailOrUsername.trim(), password: userPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      try {
        if (rememberMe) {
          localStorage.setItem("sakura_remember_email", userEmailOrUsername.trim());
        } else {
          localStorage.removeItem("sakura_remember_email");
        }
      } catch {
        // ignore
      }

      await fetch("/api/auth/me", { credentials: "include" }).catch(() => null);
      router.replace("/map");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithCredentials(emailOrUsername, password);
  };

  const inputBase =
    "login-input-glass w-full rounded-xl px-4 py-3 pr-11 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all";

  return (
    <div className="login-page-bg text-slate-100 flex flex-col relative min-h-screen">
      <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none" style={{ opacity: 0.5 }} aria-hidden />

      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 min-h-0">
        <div className="w-full max-w-md">
          <form
            onSubmit={handleSubmit}
            className="login-glass rounded-2xl overflow-hidden"
          >
            <div className="px-6 pt-6 pb-4 text-center border-b border-white/10">
              <h1 className="text-lg font-bold text-white">Sakura Market</h1>
            </div>
            <div className="p-6 sm:p-8 space-y-5">
            <h2 className="text-2xl font-bold text-white text-center">เข้าสู่ระบบ</h2>

            {successMessage && (
              <p className="text-sm text-green-300 bg-green-950/40 border border-green-800/50 rounded-xl px-3 py-2">
                {successMessage}
              </p>
            )}
            {error && (
              <p className="text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label className="sr-only">อีเมล หรือ ชื่อผู้ใช้</label>
              <div className="relative">
                <input
                  type="text"
                  autoComplete="username"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className={inputBase}
                  placeholder="อีเมล หรือ ชื่อผู้ใช้"
                  required
                />
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-0">
                <label className="sr-only">รหัสผ่าน</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-white/80 hover:text-white ml-auto"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <div className="relative mt-1">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputBase}
                  placeholder="รหัสผ่าน"
                  required
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 bg-white/10 text-pink-500 focus:ring-white/30"
                />
                <span className="text-sm text-white/90">จดจำอีเมล/ชื่อผู้ใช้</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-slate-900 font-semibold py-3 px-4 transition-opacity hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                "เข้าสู่ระบบ"
              )}
            </button>
            </div>
          </form>

          <p className="mt-5 text-center text-white/80 text-sm">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="text-white font-medium hover:underline">
              สมัครสมาชิก
            </Link>
          </p>
          <p className="mt-3 text-center text-white/60 text-xs">
            แอดมิน?{" "}
            <Link href="/admin/login" className="text-pink-300 hover:text-pink-200 font-medium">
              เข้าสู่ระบบแอดมิน
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-page-bg flex flex-col items-center justify-center">
          <Loader2 size={32} className="animate-spin text-white/70" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
