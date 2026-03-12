"use client";

import React, { useState, useEffect } from "react";
import { Loader2, User } from "lucide-react";
import { LoadingImage } from "@/components/LoadingImage";
import { updateAdminById } from "@/lib/api/client";

type AdminMe = {
  id: string | null;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  isFirst: boolean;
};

export default function AdminProfilePage() {
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/auth/admin-me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        return res.json();
      })
      .then((data: AdminMe) => {
        if (!cancelled) {
          setAdmin(data);
          setForm({
            first_name: data.firstName ?? "",
            last_name: data.lastName ?? "",
            display_name: data.displayName ?? "",
            newPassword: "",
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin?.id) return;
    setSaving(true);
    setError("");
    try {
      await updateAdminById(admin.id, {
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        display_name: form.display_name.trim() || undefined,
        newPassword: form.newPassword || undefined,
      });
      setForm((f) => ({ ...f, newPassword: "" }));
      const res = await fetch("/api/auth/admin-me", { credentials: "include" });
      const data = await res.json();
      setAdmin(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="py-12">
          <LoadingImage message="กำลังโหลดโปรไฟล์..." size={64} />
        </div>
      </div>
    );
  }

  if (error && !admin) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <User size={28} className="text-pink-400" />
          โปรไฟล์แอดมิน
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          ข้อมูลการเข้าใช้งานของแอดมิน
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/10 app-glass-subtle p-6 max-w-lg">
        <div className="mb-4">
          <span className="text-slate-500 text-sm">อีเมล</span>
          <p className="text-white font-medium">{admin?.email || "—"}</p>
        </div>
        {admin?.isFirst ? (
          <p className="text-slate-400 text-sm">
            บัญชีนี้ยังไม่มีในตาราง admins — ไม่สามารถแก้ไขจากหน้านี้ได้ (จัดการจากเมนู <strong>จัดการแอดมิน</strong>)
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">ชื่อ</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">สกุล</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">ชื่อที่แสดง (ใต้โลโก้ CMS)</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-white"
                placeholder="ชื่อเล่นหรือชื่อที่ใช้แสดง"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-white"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              บันทึก
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
