"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { MapPin, Plus, Pencil, X, Upload, Loader2, Lock, Trash2 } from "lucide-react";
import { ROOM_GRID_BACKGROUND, WORLD_WIDTH, WORLD_HEIGHT } from "../../../constants";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

type RoomRow = { id: number; name: string; background_url: string | null; slot_price_per_day: number; min_rent_days: number };
type ParcelRow = {
  id: string;
  room_id: number;
  grid_x: number;
  grid_y: number;
  width: number;
  height: number;
  title: string;
  description: string;
  image_url: string | null;
};

export default function CmsParcelsPage() {
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingParcelId, setEditingParcelId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [parcels, setParcels] = useState<ParcelRow[]>([]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [parcelFilterRoomId, setParcelFilterRoomId] = useState<string>("");
  const [blockedSlotsRoomId, setBlockedSlotsRoomId] = useState<string>("");
  const [blockedSlots, setBlockedSlots] = useState<{ grid_x: number; grid_y: number }[]>([]);
  const [blockedSlotsLoading, setBlockedSlotsLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/data/rooms").then((r) => r.json()),
      fetch("/api/data/parcels").then((r) => r.json()),
    ])
      .then(([roomsData, parcelsData]) => {
        setRooms(Array.isArray(roomsData) ? roomsData : []);
        const list = Array.isArray(parcelsData?.parcels) ? parcelsData.parcels : [];
        setParcels(list as ParcelRow[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (rooms.length > 0 && !blockedSlotsRoomId) setBlockedSlotsRoomId(String(rooms[0].id));
  }, [rooms, blockedSlotsRoomId]);

  useEffect(() => {
    if (!blockedSlotsRoomId) return;
    setBlockedSlotsLoading(true);
    fetch(`/api/data/rooms/${blockedSlotsRoomId}/blocked-slots`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { blocked_slots?: { grid_x: number; grid_y: number }[] }) => {
        setBlockedSlots(Array.isArray(data.blocked_slots) ? data.blocked_slots : []);
      })
      .catch(() => setBlockedSlots([]))
      .finally(() => setBlockedSlotsLoading(false));
  }, [blockedSlotsRoomId]);

  const getDisplayBg = (r: RoomRow) =>
    r.background_url ?? (ROOM_GRID_BACKGROUND[r.id as 1 | 2] ?? null);

  const handleSaved = (
    roomId: number,
    name: string,
    backgroundUrl: string | null,
    slotPrice: number,
    minDays: number
  ) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, name, background_url: backgroundUrl, slot_price_per_day: slotPrice, min_rent_days: minDays }
          : r
      )
    );
    setEditingRoomId(null);
  };

  const handleCreateRoom = async () => {
    setCreateError(null);
    setCreatingRoom(true);
    try {
      const res = await fetch("/api/data/rooms", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "สร้างห้องไม่สำเร็จ");
      const room = (data as { room?: RoomRow }).room;
      if (!room) throw new Error("สร้างห้องไม่สำเร็จ");
      setRooms((prev) => [...prev, room].sort((a, b) => a.id - b.id));
      setEditingRoomId(room.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "สร้างห้องไม่สำเร็จ");
    } finally {
      setCreatingRoom(false);
    }
  };

  const editingRoom = editingRoomId != null ? rooms.find((r) => r.id === editingRoomId) : null;
  const editingParcel = editingParcelId != null ? parcels.find((p) => p.id === editingParcelId) : null;
  const filteredParcels =
    parcelFilterRoomId === ""
      ? parcels
      : parcels.filter((p) => p.room_id === Number(parcelFilterRoomId));

  const getRoomName = (roomId: number) => rooms.find((r) => r.id === roomId)?.name?.trim() || (roomId ? `ห้อง ${roomId}` : "—");

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-bold text-white flex items-center gap-2">
        <MapPin size={22} className="text-pink-400" />
        จัดการห้องและตาราง
      </h1>
      <p className="text-slate-400 text-sm mt-1 mb-6">
        สร้าง แก้ไข ปรับปรุงห้องและตารางในห้อง รวมถึงภาพพื้นหลัง
      </p>

      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-sm font-bold text-pink-400 uppercase tracking-wider">จัดการห้อง</h2>
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={creatingRoom}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium"
        >
          <Plus size={16} /> {creatingRoom ? "กำลังสร้าง..." : "เพิ่มห้อง"}
        </button>
      </div>
      {createError && (
        <p className="text-red-300 text-sm mb-3">{createError}</p>
      )}
      <p className="text-slate-500 text-sm mb-4">
        สร้าง แก้ไข หรือปรับปรุงห้อง และตั้งค่าภาพพื้นหลังของตารางในห้อง
      </p>

      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">ชื่อห้อง</th>
              <th className="px-4 py-3">ภาพพื้นหลังตาราง</th>
              <th className="px-4 py-3">ราคาช่อง/วัน (เหรียญ)</th>
              <th className="px-4 py-3">ขั้นต่ำ (วัน)</th>
              <th className="px-4 py-3 w-24 text-center">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="text-slate-300 divide-y divide-pink-900/20">
            {rooms.map((r) => {
              const bg = getDisplayBg(r);
              return (
                <tr key={r.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono">{r.id}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    {bg ? (
                      <span
                        className="text-pink-200 font-mono text-xs truncate max-w-[200px] block"
                        title={bg}
                      >
                        {bg}
                      </span>
                    ) : (
                      <span className="text-slate-500">— ไม่ตั้งค่า</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {(r.slot_price_per_day ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.min_rent_days ?? 1}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setEditingRoomId(r.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-pink-400 hover:bg-slate-700"
                      title="แก้ไขห้อง"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 mt-8 mb-4">
        <h2 className="text-sm font-bold text-pink-400 uppercase tracking-wider">จัดการล็อค (Parcels)</h2>
        <select
          value={parcelFilterRoomId}
          onChange={(e) => setParcelFilterRoomId(e.target.value)}
          className="rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50"
        >
          <option value="">ทุกห้อง</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {getRoomName(r.id)}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-800/80 text-pink-200 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">ห้อง</th>
              <th className="px-4 py-3">พิกัด</th>
              <th className="px-4 py-3">ขนาด</th>
              <th className="px-4 py-3">ชื่อ</th>
              <th className="px-4 py-3 w-24 text-center">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="text-slate-300 divide-y divide-pink-900/20">
            {filteredParcels.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
                <td className="px-4 py-3">{getRoomName(p.room_id)}</td>
                <td className="px-4 py-3 font-mono">
                  ({Number(p.grid_x)}, {Number(p.grid_y)})
                </td>
                <td className="px-4 py-3 font-mono">
                  {Number(p.width)}×{Number(p.height)}
                </td>
                <td className="px-4 py-3">{p.title || "—"}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setEditingParcelId(p.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-pink-400 hover:bg-slate-700"
                    title="แก้ไขล็อค"
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredParcels.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  ยังไม่มีข้อมูลล็อค
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Lock size={16} />
          ช่องปิดจอง (ห้ามจอง)
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          ช่องที่ตั้งเป็นปิดจองจะไม่ให้ลูกค้าหรือแอดมินจองได้ — เลือกห้องแล้วเพิ่ม/ลบช่องปิดจอง
        </p>
        <BlockedSlotsEditor
          rooms={rooms}
          roomId={blockedSlotsRoomId}
          setRoomId={setBlockedSlotsRoomId}
          blockedSlots={blockedSlots}
          setBlockedSlots={setBlockedSlots}
          loading={blockedSlotsLoading}
          getRoomName={getRoomName}
          getDisplayBg={getDisplayBg}
        />
      </div>

      {editingRoom && (
        <EditRoomModal
          room={{
            ...editingRoom,
            backgroundUrl: getDisplayBg(editingRoom),
            slot_price_per_day: editingRoom.slot_price_per_day ?? 0,
            min_rent_days: editingRoom.min_rent_days ?? 1,
          }}
          onSaved={handleSaved}
          onClose={() => setEditingRoomId(null)}
        />
      )}
      {editingParcel && (
        <EditParcelModal
          rooms={rooms}
          parcel={editingParcel}
          onSaved={(updated) => {
            setParcels((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditingParcelId(null);
          }}
          onClose={() => setEditingParcelId(null)}
        />
      )}
    </div>
  );
}

const CELL_PX = 14;

function getColumnLabel(x: number): string {
  if (x < 26) return String.fromCharCode(65 + x);
  return String.fromCharCode(65 + Math.floor(x / 26) - 1) + String.fromCharCode(65 + (x % 26));
}

function BlockedSlotsEditor({
  rooms,
  roomId,
  setRoomId,
  blockedSlots,
  setBlockedSlots,
  loading,
  getRoomName,
  getDisplayBg,
}: {
  rooms: RoomRow[];
  roomId: string;
  setRoomId: (v: string) => void;
  blockedSlots: { grid_x: number; grid_y: number }[];
  setBlockedSlots: (v: { grid_x: number; grid_y: number }[]) => void;
  loading: boolean;
  getRoomName: (id: number) => string;
  getDisplayBg: (r: RoomRow) => string | null;
}) {
  const [parcels, setParcels] = useState<{ grid_x: number; grid_y: number; width: number; height: number }[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftBlocked, setDraftBlocked] = useState<{ grid_x: number; grid_y: number }[]>([]);

  const selectedRoom = rooms.find((r) => r.id === Number(roomId));
  const backgroundUrl = selectedRoom ? getDisplayBg(selectedRoom) : null;
  const rid = roomId ? Number(roomId) : 0;
  const fallbackBg = (rid >= 1 && rid <= 2 ? ROOM_GRID_BACKGROUND[rid as 1 | 2] : null) ?? null;
  const bgToShow = backgroundUrl ?? fallbackBg;

  useEffect(() => {
    setDraftBlocked([...blockedSlots]);
  }, [roomId, blockedSlots]);

  useEffect(() => {
    if (!roomId) return;
    setMapLoading(true);
    fetch(`/api/data/parcels?roomId=${roomId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { parcels?: { grid_x: number; grid_y: number; width: number; height: number }[] }) => {
        const list = Array.isArray(data.parcels) ? data.parcels : [];
        setParcels(list.map((p) => ({ grid_x: p.grid_x, grid_y: p.grid_y, width: p.width ?? 1, height: p.height ?? 1 })));
      })
      .catch(() => setParcels([]))
      .finally(() => setMapLoading(false));
  }, [roomId]);

  const occupied = useMemo(() => {
    const set = new Set<string>();
    parcels.forEach((p) => {
      for (let dx = 0; dx < (p.width || 1); dx++) {
        for (let dy = 0; dy < (p.height || 1); dy++) {
          set.add(`${p.grid_x + dx},${p.grid_y + dy}`);
        }
      }
    });
    return set;
  }, [parcels]);

  const blockedSet = useMemo(
    () => new Set(draftBlocked.map((b) => `${b.grid_x},${b.grid_y}`)),
    [draftBlocked]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (draftBlocked.length !== blockedSlots.length) return true;
    const a = new Set(blockedSlots.map((s) => `${s.grid_x},${s.grid_y}`));
    const b = new Set(draftBlocked.map((s) => `${s.grid_x},${s.grid_y}`));
    if (a.size !== b.size) return true;
    for (const k of a) if (!b.has(k)) return true;
    return false;
  }, [draftBlocked, blockedSlots]);

  const saveBlocked = async (slots: { grid_x: number; grid_y: number }[]) => {
    if (!roomId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/data/rooms/${roomId}/blocked-slots`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "บันทึกไม่สำเร็จ");
      setBlockedSlots((data as { blocked_slots?: { grid_x: number; grid_y: number }[] }).blocked_slots ?? slots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleCellClick = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (occupied.has(key)) return;
    if (blockedSet.has(key)) {
      setDraftBlocked((prev) => prev.filter((s) => s.grid_x !== x || s.grid_y !== y));
    } else {
      setDraftBlocked((prev) => [...prev, { grid_x: x, grid_y: y }]);
    }
  };

  const handleSave = () => {
    saveBlocked(draftBlocked);
  };

  const getCellClass = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (occupied.has(key)) return "bg-red-500/70 border-red-400/80 cursor-not-allowed";
    if (blockedSet.has(key)) return "bg-slate-600 border-slate-500 cursor-pointer hover:bg-slate-500";
    return "bg-slate-700/80 border-slate-600 cursor-pointer hover:bg-slate-600";
  };

  const getCellTitle = (x: number, y: number) => {
    const key = `${x},${y}`;
    const label = `${getColumnLabel(x)} ${y + 1}`;
    if (occupied.has(key)) return `จองแล้ว (${label}) — ไม่สามารถปิดจอง`;
    if (blockedSet.has(key)) return `ปิดจอง (${label}) — คลิกเพื่อยกเลิกปิดจอง`;
    return `ว่าง (${label}) — คลิกเพื่อปิดจอง`;
  };

  const handleClearAllBlocked = () => {
    setDraftBlocked([]);
  };

  return (
    <div className="rounded-xl border border-pink-900/30 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>ห้อง:</span>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2 text-sm"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {getRoomName(r.id)}
              </option>
            ))}
          </select>
        </label>
        {draftBlocked.length > 0 && (
          <button
            type="button"
            onClick={handleClearAllBlocked}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 size={14} />
            ล้างทั้งหมดปิดจอง
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
          className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          บันทึก
        </button>
        {hasUnsavedChanges && (
          <span className="text-amber-400 text-sm">มีการเปลี่ยนแปลงยังไม่ได้บันทึก</span>
        )}
      </div>
      {error && <p className="text-red-300 text-sm mb-2">{error}</p>}
      {loading || mapLoading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
          <Loader2 size={18} className="animate-spin" />
          กำลังโหลดแผนที่...
        </div>
      ) : (
        <>
          <p className="text-slate-400 text-sm mb-2">
            คลิกช่องบนแผนที่เพื่อปิดจองหรือยกเลิกปิดจอง (ช่องที่จองแล้วไม่สามารถปิดจองได้) — เมื่อแก้ไขเสร็จกดปุ่ม <strong className="text-pink-300">บันทึก</strong> เพื่อให้ผู้ใช้เห็นช่องปิดจอง
          </p>
          <div className="relative inline-block rounded-lg overflow-hidden border-2 border-pink-500/30 bg-slate-900">
            {bgToShow && (
              <div
                className="absolute z-0 overflow-hidden pointer-events-none rounded-sm"
                style={{
                  left: 0,
                  top: CELL_PX,
                  width: WORLD_WIDTH * CELL_PX,
                  height: WORLD_HEIGHT * CELL_PX,
                }}
              >
                <Image
                  src={getDriveImageDisplayUrl(bgToShow)}
                  alt=""
                  fill
                  className="object-cover opacity-60"
                  unoptimized
                  sizes={`${WORLD_WIDTH * CELL_PX}px`}
                />
              </div>
            )}
            <div
              className="relative grid border-collapse select-none"
              style={{
                gridTemplateColumns: `repeat(${WORLD_WIDTH}, ${CELL_PX}px) ${CELL_PX}px`,
                gridTemplateRows: `${CELL_PX}px repeat(${WORLD_HEIGHT}, ${CELL_PX}px)`,
                width: (WORLD_WIDTH + 1) * CELL_PX,
                border: "1px solid rgba(100, 116, 139, 0.5)",
              }}
            >
              {Array.from({ length: WORLD_WIDTH }, (_, x) => (
                <div
                  key={`col-${x}`}
                  className="flex items-center justify-center text-pink-400 font-bold text-[9px] bg-slate-800/90 border-r border-b border-slate-600"
                  style={{ width: CELL_PX, height: CELL_PX, minWidth: CELL_PX }}
                >
                  {getColumnLabel(x)}
                </div>
              ))}
              <div className="bg-slate-800/90 border-b border-slate-600" style={{ width: CELL_PX, height: CELL_PX }} />
              {Array.from({ length: WORLD_HEIGHT }, (_, y) => (
                <React.Fragment key={`row-${y}`}>
                  {Array.from({ length: WORLD_WIDTH }, (_, x) => (
                    <button
                      type="button"
                      key={`${x}-${y}`}
                      className={`shrink-0 border relative z-10 ${getCellClass(x, y)}`}
                      style={{
                        width: CELL_PX,
                        height: CELL_PX,
                        minWidth: CELL_PX,
                        minHeight: CELL_PX,
                        borderWidth: 1,
                      }}
                      title={getCellTitle(x, y)}
                      onClick={() => handleCellClick(x, y)}
                      disabled={saving}
                    />
                  ))}
                  <div
                    className="flex items-center justify-center text-pink-400 font-bold text-[9px] bg-slate-800/90 border-b border-slate-600"
                    style={{ width: CELL_PX, height: CELL_PX, minWidth: CELL_PX }}
                  >
                    {y + 1}
                  </div>
                </React.Fragment>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-slate-500 bg-red-500/70 inline-block" /> จองแล้ว
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-slate-500 bg-slate-600 inline-block" /> ปิดจอง
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-slate-600 bg-slate-700 inline-block" /> ว่าง (คลิกเพื่อปิดจอง)
              </span>
            </div>
          </div>
          {draftBlocked.length > 0 && (
            <p className="text-slate-400 text-sm mt-2">
              ปิดจอง {draftBlocked.length} ช่อง {hasUnsavedChanges && "(ยังไม่ได้บันทึก)"}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function EditRoomModal({
  room,
  onSaved,
  onClose,
}: {
  room: { id: number; name: string; backgroundUrl: string | null; slot_price_per_day: number; min_rent_days: number };
  onSaved: (roomId: number, name: string, backgroundUrl: string | null, slotPrice: number, minDays: number) => void;
  onClose: () => void;
}) {
  const [roomName, setRoomName] = useState(room.name);
  const [slotPrice, setSlotPrice] = useState(String(room.slot_price_per_day ?? 0));
  const [minDays, setMinDays] = useState(String(room.min_rent_days ?? 1));
  // URL ที่บันทึกไว้ใน DB / constant (ยังไม่มีการเปลี่ยน)
  const [savedBgUrl, setSavedBgUrl] = useState<string | null>(room.backgroundUrl);
  // ไฟล์ที่ผู้ใช้เลือกใหม่ (ยังไม่ได้ upload)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // preview URL ของไฟล์ที่รอ (สร้างจาก object URL)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // cleanup object URL เมื่อ component unmount หรือเปลี่ยนไฟล์
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // ลบ object URL เก่าก่อน
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleRemoveBg = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    setSavedBgUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalBgUrl = savedBgUrl;

      // upload ไฟล์ตอนกดบันทึกเท่านั้น
      if (pendingFile) {
        setUploading(true);
        const form = new FormData();
        form.append("file", pendingFile);
        form.append("folder", "cms");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
        const uploadData = await uploadRes.json();
        setUploading(false);
        if (!uploadRes.ok) throw new Error(uploadData.error || "อัปโหลดรูปไม่สำเร็จ");
        const uploadedUrl = typeof uploadData.url === "string" ? uploadData.url.trim() : "";
        if (uploadedUrl) finalBgUrl = uploadedUrl;
      }

      const slotPriceNum = Math.max(0, parseFloat(slotPrice) || 0);
      const minDaysNum = Math.max(1, Math.floor(parseInt(minDays, 10) || 1));

      // บันทึกข้อมูลห้องลง DB
      const res = await fetch(`/api/data/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          background_url: finalBgUrl,
          slot_price_per_day: slotPriceNum,
          min_rent_days: minDaysNum,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "บันทึกไม่สำเร็จ");
      }

      onSaved(room.id, roomName, finalBgUrl, slotPriceNum, minDaysNum);
    } catch (err) {
      alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const displayUrl = previewUrl ?? savedBgUrl;
  const isBusy = uploading || saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-900 border border-pink-900/30 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900 border-b border-pink-900/30 px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">แก้ไขห้อง — {room.name}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          {/* ชื่อห้อง */}
          <div>
            <label className="block text-sm font-medium text-pink-200 mb-2">ชื่อห้อง</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-4 py-2.5 focus:outline-none focus:border-pink-500/50"
              placeholder="กรุณากรอก"
            />
          </div>

          {/* ราคาช่องต่อวัน + ขั้นต่ำวัน */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-2">ราคาช่องต่อวัน (เหรียญ)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={slotPrice}
                onChange={(e) => setSlotPrice(e.target.value)}
                className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-4 py-2.5 focus:outline-none focus:border-pink-500/50"
                placeholder="0"
              />
              <p className="text-slate-500 text-xs mt-1">ราคาตั้งต้นต่อช่องต่อวัน — คำนวณจริงในเมนูร้านค้าเมื่อลูกค้าเลือกวัน</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-2">ขั้นต่ำ (วัน)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={minDays}
                onChange={(e) => setMinDays(e.target.value)}
                className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-4 py-2.5 focus:outline-none focus:border-pink-500/50"
                placeholder="1"
              />
              <p className="text-slate-500 text-xs mt-1">เช่าขั้นต่ำกี่วันสำหรับห้องนี้</p>
            </div>
          </div>

          {/* ภาพพื้นหลังตาราง */}
          <div>
            <label className="block text-sm font-medium text-pink-200 mb-2">ภาพพื้นหลังตาราง</label>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex items-center gap-3 flex-wrap">
              {displayUrl && (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-800 border border-pink-900/30 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getDriveImageDisplayUrl(displayUrl)} alt="" className="w-full h-full object-cover" />
                  {pendingFile && (
                    <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-amber-600/90 text-white py-0.5">
                      รอบันทึก
                    </span>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => bgInputRef.current?.click()}
                disabled={isBusy}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 border border-pink-900/30 text-pink-200 hover:bg-slate-700 disabled:opacity-50 text-sm"
              >
                <Upload size={16} />
                {pendingFile ? "เปลี่ยนรูป" : "เลือกรูปพื้นหลัง"}
              </button>
              {displayUrl && (
                <button
                  type="button"
                  onClick={handleRemoveBg}
                  disabled={isBusy}
                  className="text-slate-500 hover:text-red-400 text-sm disabled:opacity-50"
                >
                  ลบรูป
                </button>
              )}
            </div>
            <p className="text-slate-500 text-xs mt-1.5">
              JPEG, PNG, WebP, GIF สูงสุด 5MB •{" "}
              <span className="text-amber-400/80">รูปจะถูกอัพโหลดเมื่อกดบันทึกเท่านั้น</span>
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="px-4 py-2.5 rounded-lg border border-pink-900/30 text-slate-400 hover:bg-slate-800 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium disabled:opacity-50"
            >
              {isBusy && <Loader2 size={18} className="animate-spin" />}
              {uploading ? "กำลังอัพโหลด..." : saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditParcelModal({
  rooms,
  parcel,
  onSaved,
  onClose,
}: {
  rooms: RoomRow[];
  parcel: ParcelRow;
  onSaved: (parcel: ParcelRow) => void;
  onClose: () => void;
}) {
  const [roomId, setRoomId] = useState(String(parcel.room_id));
  const [gridX, setGridX] = useState(String(parcel.grid_x));
  const [gridY, setGridY] = useState(String(parcel.grid_y));
  const [width, setWidth] = useState(String(parcel.width));
  const [height, setHeight] = useState(String(parcel.height));
  const [title, setTitle] = useState(parcel.title);
  const [description, setDescription] = useState(parcel.description ?? "");
  const [imageUrl, setImageUrl] = useState(parcel.image_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/data/parcels/${encodeURIComponent(parcel.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: Number(roomId),
          grid_x: Number(gridX),
          grid_y: Number(gridY),
          width: Number(width),
          height: Number(height),
          title,
          description,
          image_url: imageUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "บันทึกไม่สำเร็จ");
      const updated = (data as { parcel?: ParcelRow }).parcel;
      if (!updated) throw new Error("บันทึกไม่สำเร็จ");
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-900 border border-pink-900/30 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900 border-b border-pink-900/30 px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">แก้ไขล็อค — {parcel.id}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-1">ห้อง</label>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2">
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-1">ชื่อ</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-1">X</label>
              <input type="number" value={gridX} onChange={(e) => setGridX(e.target.value)} className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-1">Y</label>
              <input type="number" value={gridY} onChange={(e) => setGridY(e.target.value)} className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-1">W</label>
              <input type="number" min={1} value={width} onChange={(e) => setWidth(e.target.value)} className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-pink-200 mb-1">H</label>
              <input type="number" min={1} value={height} onChange={(e) => setHeight(e.target.value)} className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-pink-200 mb-1">คำอธิบาย</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-pink-200 mb-1">รูป (URL)</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-2" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-pink-900/30 text-slate-400 hover:bg-slate-800">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
