"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User, Lock, Shield } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  React.useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("sakura_admin_remember_email");
      if (savedEmail) setEmail(savedEmail);
    } catch {
      // ignore
    }
  }, []);

  const loginAdminWithCredentials = async (adminEmail: string, adminPassword: string) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail.trim(), password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เข้าสู่ระบบแอดมินไม่สำเร็จ");
        return;
      }
      try {
        if (rememberMe) {
          localStorage.setItem("sakura_admin_remember_email", adminEmail.trim());
        } else {
          localStorage.removeItem("sakura_admin_remember_email");
        }
      } catch {
        // ignore
      }
      router.push("/admin");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginAdminWithCredentials(email, password);
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
              <h1 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <Shield className="w-5 h-5 text-white/80" />
                Sakura Market
              </h1>
            </div>
            <div className="p-6 sm:p-8 space-y-5">
            <h2 className="text-2xl font-bold text-white text-center">
              เข้าใช้งานแอดมิน (CMS)
            </h2>

            {error && (
              <p className="text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label className="sr-only">อีเมลแอดมิน</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputBase}
                  placeholder="อีเมลแอดมิน"
                  required
                />
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="sr-only">รหัสผ่านแอดมิน</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputBase}
                  placeholder="รหัสผ่านแอดมิน"
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
                <span className="text-sm text-white/90">จดจำอีเมลแอดมิน</span>
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
                "เข้าสู่ระบบแอดมิน"
              )}
            </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
