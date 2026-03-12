"use client";

import React, { useState, useEffect } from "react";
import {
  fetchAdmins,
  createAdmin,
  updateAdminById,
  deleteAdminById,
  type AdminListItem,
} from "@/lib/api/client";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import { LoadingImage } from "@/components/LoadingImage";

export default function CmsAdminsPage() {
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<AdminListItem | null>(null);

  const loadAdmins = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdmins();
      setAdmins(data.admins);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดรายการแอดมินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const [addForm, setAddForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    display_name: "",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    newPassword: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setError("");
    try {
      await createAdmin({
        email: addForm.email.trim(),
        password: addForm.password,
        first_name: addForm.first_name.trim() || undefined,
        last_name: addForm.last_name.trim() || undefined,
        display_name: addForm.display_name.trim() || undefined,
      });
      setAddForm({ email: "", password: "", first_name: "", last_name: "", display_name: "" });
      setShowAdd(false);
      await loadAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มแอดมินไม่สำเร็จ");
    } finally {
      setAddLoading(false);
    }
  };

  const openEdit = (admin: AdminListItem) => {
    setEditing(admin);
    setEditForm({
      first_name: admin.first_name,
      last_name: admin.last_name,
      display_name: admin.display_name,
      newPassword: "",
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditLoading(true);
    setError("");
    try {
      await updateAdminById(editing.id, {
        first_name: editForm.first_name.trim() || undefined,
        last_name: editForm.last_name.trim() || undefined,
        display_name: editForm.display_name.trim() || undefined,
        newPassword: editForm.newPassword || undefined,
      });
      setEditing(null);
      await loadAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (admin: AdminListItem) => {
    if (!confirm(`ยืนยันลบแอดมิน ${admin.email}?`)) return;
    setError("");
    try {
      await deleteAdminById(admin.id);
      await loadAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบแอดมินไม่สำเร็จ");
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">จัดการแอดมิน</h1>
          <p className="text-slate-400 text-sm mt-1">
            ตรวจสอบ แก้ไข เพิ่ม และลบแอดมิน (ใช้ตาราง admins ในฐานข้อมูล)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 text-sm font-medium"
        >
          <Plus size={18} />
          เพิ่มแอดมิน
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12">
          <LoadingImage message="กำลังโหลดรายการแอดมิน..." size={64} />
        </div>
      ) : (
        <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 w-12">ลำดับ</th>
                  <th className="px-4 py-3">เมล</th>
                  <th className="px-4 py-3">ชื่อ</th>
                  <th className="px-4 py-3">สกุล</th>
                  <th className="px-4 py-3">ชื่อเล่น</th>
                  <th className="px-4 py-3 w-40 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-slate-300 divide-y divide-pink-900/20">
                {admins.map((admin, index) => (
                  <tr key={admin.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-mono">{admin.email}</td>
                    <td className="px-4 py-3">{admin.first_name || "—"}</td>
                    <td className="px-4 py-3">{admin.last_name || "—"}</td>
                    <td className="px-4 py-3">{admin.display_name || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(admin)}
                        title="แก้ไข"
                        className="rounded-lg bg-pink-900/50 px-2 py-1.5 text-xs font-medium text-pink-200 hover:bg-pink-800/50 inline-flex items-center gap-1"
                      >
                        <Pencil size={14} />
                        แก้ไข
                      </button>
                      {!admin.isFirst && (
                        <button
                          type="button"
                          onClick={() => handleDelete(admin)}
                          title="ลบ"
                          className="rounded-lg bg-red-900/40 px-2 py-1.5 text-xs font-medium text-red-300 hover:bg-red-800/50 inline-flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          ลบ
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal เพิ่มแอดมิน */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-pink-900/30 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">เพิ่มแอดมิน</h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">เมล *</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">รหัสผ่าน * (อย่างน้อย 6 ตัว)</label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white"
                  required
                  minLength={6}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">ชื่อ</label>
                  <input
                    type="text"
                    value={addForm.first_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">สกุล</label>
                  <input
                    type="text"
                    value={addForm.last_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">ชื่อเล่น</label>
                <input
                  type="text"
                  value={addForm.display_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white"
                  placeholder="กรุณากรอก"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 rounded-lg border border-pink-900/30 px-3 py-2 text-slate-300 hover:bg-slate-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white px-3 py-2 font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {addLoading ? <Loader2 size={18} className="animate-spin" /> : "เพิ่ม"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal แก้ไขแอดมิน */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-pink-900/30 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">แก้ไขแอดมิน — {editing.email}</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">ชื่อ</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white"
                    placeholder="กรุณากรอก (หากมี)"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">สกุล</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white"
                    placeholder="กรุณากรอก (หากมี)"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">ชื่อเล่น</label>
                <input
                  type="text"
                  value={editForm.display_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white"
                  placeholder="กรุณากรอก (หากมี)"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
                <input
                  type="password"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
                  className="w-full rounded-lg border border-pink-900/30 bg-slate-800 px-3 py-2 text-white"
                  placeholder="กรุณากรอก (หากมี)"
                  minLength={6}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-lg border border-pink-900/30 px-3 py-2 text-slate-300 hover:bg-slate-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white px-3 py-2 font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {editLoading ? <Loader2 size={18} className="animate-spin" /> : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
