"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";

type RoomRow = { id: number; name: string };
type AnnouncementRow = {
  id: string;
  room_id: number;
  shop_name: string;
  message: string;
  created_at: string;
  expires_at?: string | null;
  announcement_source?: string | null;
};
const SOURCE_LABELS: Record<string, string> = { megaphone: "แถบ Live (ประกาศวิ่ง)", board: "ป้ายประกาศ" };

export default function CmsAnnouncementsPage() {
  const [roomFilter, setRoomFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [shopName, setShopName] = useState("");
  const [message, setMessage] = useState("");
  const [roomId, setRoomId] = useState<string>("");
  const [announcementSource, setAnnouncementSource] = useState<"megaphone" | "board">("megaphone");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoomId, setEditRoomId] = useState<string>("");
  const [editShopName, setEditShopName] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editSource, setEditSource] = useState<"megaphone" | "board">("megaphone");

  const loadData = useCallback(() => {
    Promise.all([
      fetch("/api/data/rooms").then((r) => r.json()),
      fetch("/api/data/announcements").then((r) => r.json()),
    ])
      .then(([roomsData, annData]) => {
        const nextRooms = Array.isArray(roomsData) ? roomsData : [];
        setRooms(nextRooms);
        const nextAnnouncements = Array.isArray((annData as { announcements?: unknown[] })?.announcements)
          ? ((annData as { announcements?: AnnouncementRow[] }).announcements ?? [])
          : [];
        setAnnouncements(nextAnnouncements);
        if (!roomId && nextRooms.length > 0) setRoomId(String(nextRooms[0].id));
      })
      .catch(() => {
        setError("โหลดข้อมูลประกาศไม่สำเร็จ");
      });
  }, [roomId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!roomId || !shopName.trim() || !message.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/data/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: Number(roomId),
          shop_name: shopName.trim(),
          message: message.trim(),
          announcement_source: announcementSource,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "สร้างประกาศไม่สำเร็จ");
      setShopName("");
      setMessage("");
      setExpiresAt("");
      setAnnouncementSource("megaphone");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างประกาศไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("ลบประกาศนี้ใช่หรือไม่?");
    if (!ok) return;
    setError(null);
    try {
      const res = await fetch(`/api/data/announcements?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "ลบประกาศไม่สำเร็จ");
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบประกาศไม่สำเร็จ");
    }
  };

  const startEdit = (row: AnnouncementRow) => {
    setEditingId(row.id);
    setEditRoomId(String(row.room_id));
    setEditShopName(row.shop_name);
    setEditMessage(row.message);
    setEditExpiresAt(row.expires_at ? toInputDateTime(row.expires_at) : "");
    setEditSource((row.announcement_source === "board" ? "board" : "megaphone") as "megaphone" | "board");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRoomId("");
    setEditShopName("");
    setEditMessage("");
    setEditExpiresAt("");
    setEditSource("megaphone");
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setError(null);
    if (!editRoomId || !editShopName.trim() || !editMessage.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบก่อนบันทึก");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/data/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          room_id: Number(editRoomId),
          shop_name: editShopName.trim(),
          message: editMessage.trim(),
          announcement_source: editSource,
          expires_at: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "บันทึกการแก้ไขไม่สำเร็จ");
      const updated = (data as { announcement?: AnnouncementRow }).announcement;
      if (updated) {
        setAnnouncements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      }
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!roomId && rooms.length > 0) setRoomId(String(rooms[0].id));
  }, [roomId, rooms]);

  useEffect(() => {
    if (roomFilter && !rooms.some((r) => String(r.id) === roomFilter)) setRoomFilter("");
  }, [roomFilter, rooms]);

  const getRoomName = (id: number) => rooms.find((r) => r.id === id)?.name || (id ? `ห้อง ${id}` : "—");

  const filtered = useMemo(() => {
    let list = announcements;
    if (typeFilter === "megaphone" || typeFilter === "board") {
      list = list.filter((a) => (a.announcement_source === "board" ? "board" : "megaphone") === typeFilter);
    }
    if (roomFilter) {
      const rid = Number(roomFilter);
      list = list.filter((a) => a.room_id === rid);
    }
    return list;
  }, [roomFilter, typeFilter, announcements]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-bold text-white">ประกาศ (แถบ Live / ป้ายประกาศ)</h1>
      <p className="text-slate-400 text-sm mt-1 mb-4">
        จัดการข้อความประกาศ — เลือกประเภท: แถบ Live (วิ่งบนแผนที่) หรือ ป้ายประกาศ (ประวัติ/ป๊อปอัป)
      </p>
      <form onSubmit={handleCreate} className="rounded-xl border border-pink-900/30 bg-slate-900/40 p-4 mb-6 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">ประเภทประกาศ</label>
            <select
              value={announcementSource}
              onChange={(e) => setAnnouncementSource(e.target.value as "megaphone" | "board")}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50"
            >
              <option value="megaphone">{SOURCE_LABELS.megaphone}</option>
              <option value="board">{SOURCE_LABELS.board}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ห้อง</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || `ห้อง ${r.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ชื่อผู้ประกาศ</label>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50"
              placeholder="ชื่อร้านหรือชื่อเจ้าของร้าน (เมื่อผู้ใช้ประกาศ)"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">ข้อความประกาศ</label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50"
            placeholder="กรอกข้อความ..."
          />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">เวลาสิ้นสุด (ไม่บังคับ)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white text-sm font-medium"
          >
            {saving ? "กำลังบันทึก..." : "เพิ่มประกาศ"}
          </button>
        </div>
      </form>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-2 text-red-300 text-sm">{error}</div>
      )}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <span className="text-slate-500 text-sm">กรอง:</span>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-pink-900/30 bg-slate-800 text-white px-4 py-2 text-sm focus:outline-none focus:border-pink-500/50 min-w-[180px]"
        >
          <option value="">ทุกประเภท</option>
          <option value="megaphone">{SOURCE_LABELS.megaphone}</option>
          <option value="board">{SOURCE_LABELS.board}</option>
        </select>
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className="rounded-lg border border-pink-900/30 bg-slate-800 text-white px-4 py-2 text-sm focus:outline-none focus:border-pink-500/50 min-w-[140px]"
        >
          <option value="">ทุกห้อง</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name || `ห้อง ${r.id}`}
            </option>
          ))}
        </select>
      </div>
      <p className="text-slate-500 text-xs mb-3">ตารางแสดงรายการประกาศ — แยกตามประเภท (แถบ Live / ป้ายประกาศ) และห้อง</p>
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">ประเภท</th>
                <th className="px-4 py-3">ห้อง</th>
                <th className="px-4 py-3">ชื่อผู้ประกาศ</th>
                <th className="px-4 py-3">ข้อความ</th>
                <th className="px-4 py-3">เมื่อ</th>
                <th className="px-4 py-3">เวลาสิ้นสุด</th>
                <th className="px-4 py-3 text-center w-36">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-slate-300 divide-y divide-pink-900/20">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    {editingId === a.id ? (
                      <select
                        value={editSource}
                        onChange={(e) => setEditSource(e.target.value as "megaphone" | "board")}
                        className="rounded border border-pink-900/30 bg-slate-800 text-white px-2 py-1 text-xs"
                      >
                        <option value="megaphone">{SOURCE_LABELS.megaphone}</option>
                        <option value="board">{SOURCE_LABELS.board}</option>
                      </select>
                    ) : (
                      <span className="text-pink-200 text-xs">{SOURCE_LABELS[a.announcement_source === "board" ? "board" : "megaphone"]}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === a.id ? (
                      <select
                        value={editRoomId}
                        onChange={(e) => setEditRoomId(e.target.value)}
                        className="rounded border border-pink-900/30 bg-slate-800 text-white px-2 py-1 text-xs"
                      >
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name || `ห้อง ${r.id}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{getRoomName(a.room_id)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {editingId === a.id ? (
                      <input
                        value={editShopName}
                        onChange={(e) => setEditShopName(e.target.value)}
                        className="w-full rounded border border-pink-900/30 bg-slate-800 text-white px-2 py-1 text-xs"
                      />
                    ) : (
                      a.shop_name
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    {editingId === a.id ? (
                      <textarea
                        rows={2}
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        className="w-full rounded border border-pink-900/30 bg-slate-800 text-white px-2 py-1 text-xs"
                      />
                    ) : (
                      a.message
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(a.created_at).toLocaleDateString("th-TH")}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {editingId === a.id ? (
                      <input
                        type="datetime-local"
                        value={editExpiresAt}
                        onChange={(e) => setEditExpiresAt(e.target.value)}
                        className="rounded border border-pink-900/30 bg-slate-800 text-white px-2 py-1 text-xs"
                      />
                    ) : (
                      a.expires_at ? new Date(a.expires_at).toLocaleDateString("th-TH") : "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {editingId === a.id ? (
                        <>
                          <button type="button" onClick={handleUpdate} disabled={saving} className="text-emerald-400 hover:text-emerald-300 text-xs">
                            บันทึก
                          </button>
                          <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-white text-xs">
                            ยกเลิก
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(a)} className="text-amber-400 hover:text-amber-300 text-xs">
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(a.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            ลบ
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function toInputDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
