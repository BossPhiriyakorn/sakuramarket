"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { X, MapPin, Loader2, Trash2, CheckCircle, MousePointer2, PlusCircle } from "lucide-react";
import { WORLD_WIDTH, WORLD_HEIGHT, ROOM_GRID_BACKGROUND } from "@/constants";
import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

type RoomRow = { id: number; name: string; background_url?: string | null; slot_price_per_day?: number; min_rent_days?: number };
type ParcelRow = { id: string; room_id?: number; grid_x: number; grid_y: number; width: number; height: number; owner_id?: string };

function getColumnLabel(x: number): string {
  if (x < 26) return String.fromCharCode(65 + x);
  return String.fromCharCode(65 + Math.floor(x / 26) - 1) + String.fromCharCode(65 + (x % 26));
}

const CELL_PX = 16;
const DEBOUNCE_MS = 300;
const POLL_OTHER_HOLDS_MS = 4000;
const LONG_PRESS_MS = 400;

/** เช็คว่าช่อง (x,y) ติดกับชุดที่เลือกอยู่หรือไม่ (บน/ล่าง/ซ้าย/ขวา) — ถ้ายังไม่มีอะไรเลือก ถือว่าติด */
function isAdjacentToSelection(x: number, y: number, sel: Set<string>): boolean {
  if (sel.size === 0) return true;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]] as const;
  return dirs.some(([dx, dy]) => sel.has(`${x + dx},${y + dy}`));
}

/** เช็คว่ามีอย่างน้อยหนึ่งช่องในสี่เหลี่ยม (minX..maxX, minY..maxY) ที่ติดกับ sel */
function isRectAdjacentToSet(minX: number, minY: number, maxX: number, maxY: number, sel: Set<string>): boolean {
  if (sel.size === 0) return true;
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (isAdjacentToSelection(x, y, sel)) return true;
    }
  }
  return false;
}

interface BookLockModalProps {
  open: boolean;
  onClose: () => void;
  /** เรียกหลังจองสำเร็จ (ใช้ refetch ข้อมูลร้าน/แผนที่) */
  onBookSuccess?: () => void;
}

/** ส่ง cookie กับ request — จำเป็นสำหรับมือถือ/LINE browser */
const CREDS: RequestInit = { credentials: "include" };

export function BookLockModal({ open, onClose, onBookSuccess }: BookLockModalProps) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [parcels, setParcels] = useState<ParcelRow[]>([]);
  const [roomId, setRoomId] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [selectionStarted, setSelectionStarted] = useState(false);
  const [hasExistingParcel, setHasExistingParcel] = useState(false);
  const [myParcelIds, setMyParcelIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherHoldCells, setOtherHoldCells] = useState<Set<string>>(new Set());
  const [needsLogin, setNeedsLogin] = useState(false);
  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didMoveRef = useRef(false);
  const justClickedCellRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchDragRef = useRef(false);
  const dragRemoveRef = useRef(false);
  const selectedRef = useRef<Set<string>>(new Set());

  const [blockedSlots, setBlockedSlots] = useState<{ grid_x: number; grid_y: number }[]>([]);

  // โหลด rooms + parcels + blocked_slots + me/shop ใน effect เดียว เพื่อให้ roomId ถูกต้องก่อน fetch parcels
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when open changes
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectionStarted(false);
    setParcels([]);
    setBlockedSlots([]);

    let cancelled = false;

    (async () => {
      try {
        // 1) โหลด rooms + me/shop พร้อมกัน
        const [roomsData, shopData] = await Promise.all([
          fetch("/api/data/rooms", { ...CREDS, cache: "no-store" }).then((r) => r.json()),
          fetch("/api/data/me/shop", CREDS).then((r) => r.json()).catch(() => ({ shop: null })),
        ]);
        if (cancelled) return;

        const list = Array.isArray(roomsData) ? roomsData : [];
        const mapped: RoomRow[] = list.map((r: { id?: number; name?: string | null; background_url?: string | null; slot_price_per_day?: number | string | null; min_rent_days?: number | string | null }) => ({
          id: Number(r.id) || 0,
          name: r.name ?? "",
          background_url: r.background_url ?? null,
          slot_price_per_day: r.slot_price_per_day != null ? Number(r.slot_price_per_day) : 0,
          min_rent_days: r.min_rent_days != null ? Number(r.min_rent_days) : 1,
        }));
        setRooms(mapped);

        // 2) หา roomId ที่ถูกต้อง (ใช้ roomId ปัจจุบันถ้ามีในรายการ มิฉะนั้นใช้ห้องแรก)
        const targetRoomId = mapped.some((r) => r.id === roomId)
          ? roomId
          : (mapped[0]?.id ?? 1);
        if (targetRoomId !== roomId) setRoomId(targetRoomId);

        // 3) โหลด parcels + blocked_slots ด้วย roomId ที่ถูกต้อง
        const parcelsData = await fetch(`/api/data/parcels?roomId=${targetRoomId}`, { ...CREDS, cache: "no-store" }).then((r) => r.json());
        if (cancelled) return;

        const blocked = Array.isArray(parcelsData.blocked_slots) ? parcelsData.blocked_slots : [];
        setParcels(parcelsData.parcels ?? []);
        setBlockedSlots(blocked);

        // 4) ตั้งค่า shop
        const shop = (shopData as { shop?: { parcel_id?: string | null; shop_parcel_ids?: string[] } })?.shop;
        setHasExistingParcel(Boolean(shop?.parcel_id));
        const ids = new Set<string>();
        if (shop?.parcel_id) ids.add(shop.parcel_id);
        (shop?.shop_parcel_ids ?? []).forEach((id: string) => ids.add(id));
        setMyParcelIds(ids);
      } catch {
        if (!cancelled) {
          setRooms([]);
          setParcels([]);
          setBlockedSlots([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  // เมื่อผู้ใช้เปลี่ยนห้องใน dropdown ให้โหลด parcels + blocked_slots ใหม่
  useEffect(() => {
    if (!open || loading) return;
    let cancelled = false;
    fetch(`/api/data/parcels?roomId=${roomId}`, { ...CREDS, cache: "no-store" })
      .then((r) => r.json())
      .then((data: { parcels?: ParcelRow[]; blocked_slots?: { grid_x: number; grid_y: number }[] }) => {
        if (cancelled) return;
        setParcels(data.parcels ?? []);
        setBlockedSlots(Array.isArray(data.blocked_slots) ? data.blocked_slots : []);
      })
      .catch(() => {
        if (!cancelled) { setParcels([]); setBlockedSlots([]); }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const fetchOtherHoldCells = useCallback(() => {
    fetch(`/api/data/parcel-selection-hold?roomId=${roomId}`, CREDS)
      .then((r) => {
        if (r.status === 401) {
          setNeedsLogin(true);
          return { otherSlots: [] };
        }
        setNeedsLogin(false);
        return r.json();
      })
      .then((data: { otherSlots?: { grid_x: number; grid_y: number }[] }) => {
        const set = new Set<string>();
        (data.otherSlots ?? []).forEach((s) => set.add(`${s.grid_x},${s.grid_y}`));
        setOtherHoldCells(set);
      })
      .catch(() => setOtherHoldCells(new Set()));
  }, [roomId]);

  useEffect(() => {
    if (!open || roomId == null) return;
    fetchOtherHoldCells();
    const t = setInterval(fetchOtherHoldCells, POLL_OTHER_HOLDS_MS);
    return () => clearInterval(t);
  }, [open, roomId, fetchOtherHoldCells]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setOtherHoldCells(new Set());
    setNeedsLogin(false);
    setSelectionStarted(false);
  }, [open]);

  useEffect(() => {
    if (!open || needsLogin) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const slots = Array.from(selected).map((k) => {
        const [x, y] = k.split(",").map(Number);
        return { grid_x: x, grid_y: y };
      });
      if (slots.length === 0) {
        fetch(`/api/data/parcel-selection-hold?roomId=${roomId}`, { ...CREDS, method: "DELETE" }).catch(() => {});
      } else {
        fetch("/api/data/parcel-selection-hold", {
          ...CREDS,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, slots }),
        }).catch(() => {});
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, roomId, selected, needsLogin]);

  const occupied = useMemo(() => {
    const set = new Set<string>();
    parcels.forEach((p) => {
      for (let dx = 0; dx < (p.width || 1); dx++) {
        for (let dy = 0; dy < (p.height || 1); dy++) {
          set.add(`${p.grid_x + dx},${p.grid_y + dy}`);
        }
      }
    });
    blockedSlots.forEach((b) => set.add(`${b.grid_x},${b.grid_y}`));
    return set;
  }, [parcels, blockedSlots]);

  /** ช่องที่เป็นของร้านเราเอง */
  const myOccupied = useMemo(() => {
    const set = new Set<string>();
    parcels.forEach((p) => {
      if (!myParcelIds.has(p.id)) return;
      for (let dx = 0; dx < (p.width || 1); dx++) {
        for (let dy = 0; dy < (p.height || 1); dy++) {
          set.add(`${p.grid_x + dx},${p.grid_y + dy}`);
        }
      }
    });
    return set;
  }, [parcels, myParcelIds]);

  const currentRoom = rooms.find((r) => r.id === roomId);
  const pricePerDay = currentRoom?.slot_price_per_day ?? 0;
  const minDays = Math.max(1, currentRoom?.min_rent_days ?? 1);

  const getCellFromPoint = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const col = Math.floor((clientX - rect.left) / CELL_PX);
    const row = Math.floor((clientY - rect.top) / CELL_PX) - 1;
    if (col < 0 || col >= WORLD_WIDTH || row < 0 || row >= WORLD_HEIGHT) return null;
    return { x: col, y: row };
  }, []);

  const addRectangleToSelected = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    setSelected((prev) => {
      if (prev.size > 0 && !isRectAdjacentToSet(minX, minY, maxX, maxY, prev)) return prev;
      const next = new Set(prev);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const key = `${x},${y}`;
          if (!occupied.has(key)) next.add(key);
        }
      }
      return next;
    });
  }, [occupied]);

  const removeRectangleFromSelected = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    setSelected((prev) => {
      const next = new Set(prev);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          next.delete(`${x},${y}`);
        }
      }
      return next;
    });
  }, []);

  const handleCellClick = (x: number, y: number) => {
    if (!selectionStarted || needsLogin) return;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    const j = justClickedCellRef.current;
    if (j && j.x === x && j.y === y) {
      justClickedCellRef.current = null;
      return;
    }
    const key = `${x},${y}`;
    if (occupied.has(key)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (isAdjacentToSelection(x, y, prev)) next.add(key);
      return next;
    });
  };

  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectionStarted || needsLogin) return;
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell || occupied.has(`${cell.x},${cell.y}`)) return;
    const key = `${cell.x},${cell.y}`;
    const startInSelected = selectedRef.current.has(key);
    dragStartRef.current = cell;
    dragRemoveRef.current = startInSelected;
    didMoveRef.current = false;
    if (startInSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      setSelected((prev) => {
        if (prev.size > 0 && !isAdjacentToSelection(cell.x, cell.y, prev)) return prev;
        return new Set(prev).add(key);
      });
    }
    const onMove = (e2: MouseEvent) => {
      didMoveRef.current = true;
      const c = getCellFromPoint(e2.clientX, e2.clientY);
      if (c && dragStartRef.current) {
        if (dragRemoveRef.current) removeRectangleFromSelected(dragStartRef.current.x, dragStartRef.current.y, c.x, c.y);
        else addRectangleToSelected(dragStartRef.current.x, dragStartRef.current.y, c.x, c.y);
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (didMoveRef.current) isDraggingRef.current = true;
      else justClickedCellRef.current = dragStartRef.current;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [selectionStarted, needsLogin, getCellFromPoint, occupied, addRectangleToSelected, removeRectangleFromSelected]);

  const handleGridTouchStart = useCallback((e: React.TouchEvent) => {
    if (!selectionStarted || needsLogin) return;
    const touch = e.touches[0];
    if (!touch) return;
    const cell = getCellFromPoint(touch.clientX, touch.clientY);
    if (!cell || occupied.has(`${cell.x},${cell.y}`)) return;
    const startCell = { ...cell };
    const startKey = `${startCell.x},${startCell.y}`;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      isTouchDragRef.current = true;
      const startInSelected = selectedRef.current.has(startKey);
      dragRemoveRef.current = startInSelected;
      if (startInSelected) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(startKey);
          return next;
        });
      } else {
        setSelected((prev) => {
          if (prev.size > 0 && !isAdjacentToSelection(startCell.x, startCell.y, prev)) return prev;
          return new Set(prev).add(startKey);
        });
      }
      const onMove = (e2: TouchEvent) => {
        if (!e2.touches[0]) return;
        e2.preventDefault();
        const c = getCellFromPoint(e2.touches[0].clientX, e2.touches[0].clientY);
        if (c) {
          if (dragRemoveRef.current) removeRectangleFromSelected(startCell.x, startCell.y, c.x, c.y);
          else addRectangleToSelected(startCell.x, startCell.y, c.x, c.y);
        }
      };
      const onEnd = () => {
        document.removeEventListener("touchmove", onMove, { capture: true });
        document.removeEventListener("touchend", onEnd, { capture: true });
        isTouchDragRef.current = false;
      };
      document.addEventListener("touchmove", onMove, { passive: false, capture: true });
      document.addEventListener("touchend", onEnd, { capture: true });
    }, LONG_PRESS_MS);
  }, [selectionStarted, needsLogin, getCellFromPoint, occupied, addRectangleToSelected, removeRectangleFromSelected]);

  const handleGridTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleGridTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      const touch = e.changedTouches[0];
      if (touch && !isTouchDragRef.current) {
        const cell = getCellFromPoint(touch.clientX, touch.clientY);
        if (cell && !occupied.has(`${cell.x},${cell.y}`)) {
          setSelected((prev) => {
            const next = new Set(prev);
            const key = `${cell.x},${cell.y}`;
            if (next.has(key)) next.delete(key);
            else if (isAdjacentToSelection(cell.x, cell.y, prev)) next.add(key);
            return next;
          });
        }
      }
    }
  }, [getCellFromPoint, occupied]);

  const handleClearAll = () => {
    setSelected(new Set());
    setBookError(null);
    fetch(`/api/data/parcel-selection-hold?roomId=${roomId}`, { ...CREDS, method: "DELETE" }).catch(() => {});
  };

  const handleBookLock = async () => {
    if (selected.size === 0 || needsLogin || bookLoading) return;
    setBookError(null);
    setBookLoading(true);
    try {
      const slots = Array.from(selected).map((k) => {
        const [x, y] = k.split(",").map(Number);
        return { grid_x: x, grid_y: y };
      });
      const res = await fetch("/api/data/me/book-parcel", {
        ...CREDS,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, slots }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBookError((data as { error?: string }).error || "จองไม่สำเร็จ");
        return;
      }
      setSelected(new Set());
      onClose();
      onBookSuccess?.();
      alert("จองล็อคสำเร็จ ร้านของคุณจะแสดงบนแผนที่แล้ว");
    } catch {
      setBookError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBookLoading(false);
    }
  };

  const blockedSet = useMemo(
    () => new Set(blockedSlots.map((b) => `${b.grid_x},${b.grid_y}`)),
    [blockedSlots]
  );

  const getCellClass = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (!selectionStarted) {
      if (myOccupied.has(key)) return "border-pink-400/80 bg-pink-500/80 cursor-not-allowed opacity-90";
      if (blockedSet.has(key)) return "border-slate-500/80 bg-slate-600/80 cursor-not-allowed opacity-90";
      if (occupied.has(key)) return "border-red-400/80 bg-red-500/80 cursor-not-allowed opacity-90";
      return "border-slate-600/80 bg-slate-700/70 cursor-not-allowed opacity-70";
    }
    if (myOccupied.has(key)) return "border-pink-400/80 bg-pink-500/80 cursor-not-allowed";
    if (blockedSet.has(key)) return "border-slate-500/80 bg-slate-600/80 cursor-not-allowed";
    if (occupied.has(key)) return "border-red-400/80 bg-red-500/80 cursor-not-allowed";
    if (selected.has(key)) return "border-emerald-400/80 bg-emerald-500/80 ring-1 ring-emerald-400 cursor-pointer";
    if (otherHoldCells.has(key)) return "border-amber-400/80 bg-amber-500/80 cursor-default";
    return "border-slate-600/80 bg-slate-700/70 cursor-pointer hover:bg-slate-600/80";
  };

  const getCellTitle = (x: number, y: number) => {
    const key = `${x},${y}`;
    const label = `${getColumnLabel(x)} ${y + 1}`;
    if (myOccupied.has(key)) return `ล็อคของร้านฉัน (${label})`;
    if (blockedSet.has(key)) return `ปิดจอง (${label})`;
    if (occupied.has(key)) return `ไม่ว่าง (${label})`;
    if (selected.has(key)) return `ที่ฉันเลือก (${label}) — คลิกเพื่อยกเลิก`;
    if (otherHoldCells.has(key)) return `มีผู้ใช้กำลังสนใจ (${label})`;
    return `ว่าง (${label}) — คลิกเพื่อเลือก`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="rounded-xl border border-pink-900/30 bg-slate-900 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-pink-900/30 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MapPin size={20} className="text-pink-400" />
            จองล็อคร้านในแผนที่
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={22} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {needsLogin && (
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-200">
              กรุณาเข้าสู่ระบบเพื่อเลือกล็อคและจองได้
            </div>
          )}

          {/* เลือกห้อง + ราคา */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <span>ห้อง:</span>
              <select
                value={roomId}
                onChange={(e) => setRoomId(Number(e.target.value))}
                className="rounded-lg border border-pink-900/30 bg-slate-800 text-white px-3 py-1.5 text-sm"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            {currentRoom && pricePerDay > 0 && (
              <span className="text-slate-400 text-sm">
                ราคาเบื้องต้น <span className="text-pink-300 font-medium">{pricePerDay.toLocaleString()}</span> เหรียญ/ช่อง/วัน
              </span>
            )}
          </div>

          {/* แผนที่ */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : (
            <div className="relative inline-block rounded-lg overflow-hidden border-2 border-pink-500/30 bg-slate-900">
              {(currentRoom?.background_url?.trim() || ROOM_GRID_BACKGROUND[roomId as 1 | 2]) && (
                <div
                  className="absolute z-0 overflow-hidden pointer-events-none rounded-sm"
                  style={{
                    left: 0,
                    top: CELL_PX,
                    width: WORLD_WIDTH * CELL_PX,
                    height: WORLD_HEIGHT * CELL_PX,
                  }}
                >
                  {(() => {
                    const bgUrl = getDriveImageDisplayUrl(
                      currentRoom?.background_url?.trim() || ROOM_GRID_BACKGROUND[roomId as 1 | 2] || ""
                    );
                    if (!bgUrl) return null;
                    return (
                  <Image
                    src={bgUrl}
                    alt=""
                    fill
                    className="object-cover opacity-50"
                    unoptimized
                    sizes={`${WORLD_WIDTH * CELL_PX}px`}
                  />
                    );
                  })()}
                </div>
              )}
              <div
                ref={gridRef}
                className="relative grid border-collapse select-none"
                style={{
                  gridTemplateColumns: `repeat(${WORLD_WIDTH}, ${CELL_PX}px) ${CELL_PX}px`,
                  gridTemplateRows: `${CELL_PX}px repeat(${WORLD_HEIGHT}, ${CELL_PX}px)`,
                  width: (WORLD_WIDTH + 1) * CELL_PX,
                  touchAction: selectionStarted ? "none" : undefined,
                }}
                onMouseDown={handleGridMouseDown}
                onTouchStart={handleGridTouchStart}
                onTouchMove={handleGridTouchMove}
                onTouchEnd={handleGridTouchEnd}
              >
                {Array.from({ length: WORLD_WIDTH }, (_, x) => (
                  <div
                    key={`col-${x}`}
                    className="flex items-center justify-center text-pink-400 font-bold text-[10px] bg-slate-800/80 border-r border-b border-slate-600"
                    style={{ width: CELL_PX, height: CELL_PX, minWidth: CELL_PX }}
                  >
                    {getColumnLabel(x)}
                  </div>
                ))}
                <div className="bg-slate-800/80 border-b border-slate-600" style={{ width: CELL_PX, height: CELL_PX }} />
                {Array.from({ length: WORLD_HEIGHT }, (_, y) => (
                  <React.Fragment key={`row-${y}`}>
                    {Array.from({ length: WORLD_WIDTH }, (_, x) => (
                      <button
                        type="button"
                        key={`${x}-${y}`}
                        className={`shrink-0 border relative z-10 ${getCellClass(x, y)}`}
                        style={{ width: CELL_PX, height: CELL_PX, minWidth: CELL_PX, minHeight: CELL_PX }}
                        title={selectionStarted ? getCellTitle(x, y) : "กดปุ่ม เลือกล็อค เพื่อเริ่มเลือกช่อง"}
                        onClick={() => handleCellClick(x, y)}
                        disabled={needsLogin || !selectionStarted}
                      />
                    ))}
                    <div
                      className="flex items-center justify-center text-pink-400 font-bold text-[10px] bg-slate-800/80 border-b border-slate-600"
                      style={{ width: CELL_PX, height: CELL_PX, minWidth: CELL_PX }}
                    >
                      {y + 1}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-500/80 inline-block" /> ล็อคของฉัน</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/80 inline-block" /> ของผู้อื่น</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-600 inline-block" /> ปิดจอง</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-700 inline-block" /> ว่าง</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/80 inline-block" /> มีคนกำลังเลือก</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 ring-1 ring-emerald-400 inline-block" /> ที่ฉันเลือก</span>
              </div>
            </div>
          )}

          {/* ล้างทั้งหมด + จอง / ติดต่อแอดมิน */}
          {bookError && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">
              {bookError}
            </div>
          )}
          <div className="pt-2 flex flex-wrap items-center gap-2">
            {selected.size > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={bookLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium border border-slate-600 disabled:opacity-50"
              >
                <Trash2 size={16} />
                ล้างทั้งหมด
              </button>
            )}
            {selected.size > 0 && (
              <span className="text-slate-400 text-sm">
                เลือกแล้ว {selected.size} ช่อง
                {pricePerDay > 0 && (
                  <> · ค่าจอง {((pricePerDay * selected.size * minDays)).toLocaleString()} เหรียญ</>
                )}
                {pricePerDay === 0 && " · ห้องนี้ฟรี ไม่ต้องผูกกระเป๋า"}
              </span>
            )}
          </div>
          <div className="pt-1 flex flex-wrap items-center gap-2">
            {!selectionStarted ? (
              <button
                type="button"
                onClick={() => setSelectionStarted(true)}
                disabled={needsLogin || loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-sm transition-colors border border-pink-500/30 disabled:opacity-50"
              >
                <MousePointer2 size={18} />
                เลือกล็อค
              </button>
            ) : null}
            {hasExistingParcel && (
              <button
                type="button"
                onClick={() => setSelectionStarted(true)}
                disabled={needsLogin || loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-medium text-sm border border-slate-500/30 disabled:opacity-50"
              >
                <PlusCircle size={18} />
                จองเพิ่ม
              </button>
            )}
            {selectionStarted && selected.size > 0 && (
              <button
                type="button"
                onClick={handleBookLock}
                disabled={bookLoading || needsLogin}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors border border-emerald-500/30 disabled:opacity-50"
              >
                {bookLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                จองล็อค
              </button>
            )}
            <p className="text-slate-500 text-xs w-full mt-1">
              {!selectionStarted && "กดปุ่ม เลือกล็อค เพื่อเริ่มเลือกช่องบนแผนที่"}
              {selectionStarted && selected.size === 0 && "คลิกช่องแรกได้ทุกจุด จุดถัดไปต้องเลือกช่องที่ติดกัน (บน/ล่าง/ซ้าย/ขวา)"}
              {selectionStarted && selected.size > 0 && "จุดถัดไปต้องติดกับที่เลือกแล้ว — กดจองล็อคเพื่อยืนยัน"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
