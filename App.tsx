"use client";

import React, { useEffect, useState } from 'react';
import { GridMap } from './components/GridMap';
import { Sidebar } from './components/Sidebar';
import { UIOverlay } from './components/UIOverlay';
import { useStore } from './store';
import { BACKGROUND_IMAGE } from './constants';
import type { RoomId } from './types';

interface AppProps {
  /** โหมดทดสอบ: เปิดแผนที่แล้วไปห้อง 2 เลย (จาก ?room=2) */
  initialRoom?: RoomId;
}

const MAP_HINT_KEY = 'sakura_map_hint_seen';

export default function App({ initialRoom }: AppProps = {}) {
  const fetchParcels = useStore((state) => state.fetchParcels);
  const fetchRooms = useStore((state) => state.fetchRooms);
  const setCurrentRoom = useStore((state) => state.setCurrentRoom);
  const hasRooms = useStore((state) => state.rooms.length > 0);
  const hasParcels = useStore((state) => state.parcels.length > 0);
  const [isReady, setIsReady] = useState(false);
  const [showMapHint, setShowMapHint] = useState(false);

  useEffect(() => {
    try {
      setShowMapHint(localStorage.getItem(MAP_HINT_KEY) !== 'true');
    } catch {
      setShowMapHint(true);
    }
  }, []);

  const dismissMapHint = () => {
    try {
      localStorage.setItem(MAP_HINT_KEY, 'true');
    } catch {}
    setShowMapHint(false);
  };

  useEffect(() => {
    if (!showMapHint) return;
    const t = setTimeout(dismissMapHint, 6000);
    return () => clearTimeout(t);
  }, [showMapHint]);

  useEffect(() => {
    if (!hasRooms) fetchRooms();
    // อ่าน ?room= จาก URL โดยตรง (client-only) — แทน useSearchParams ที่บังคับ Suspense/streaming
    const urlRoom = new URLSearchParams(window.location.search).get("room");
    const room = initialRoom ?? (urlRoom === "2" ? 2 : undefined);
    if (room) {
      setCurrentRoom(room);
    } else if (!hasParcels) {
      fetchParcels();
    }
    setIsReady(true);
  }, [fetchParcels, fetchRooms, setCurrentRoom, initialRoom, hasRooms, hasParcels]);

  return (
    <div className="relative w-full h-[100dvh] min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* พื้นหลังแอปเต็มจอ — เหมือนกันทุกห้อง (ห้อง 1 style) */}
      {BACKGROUND_IMAGE.ENABLED && BACKGROUND_IMAGE.MAIN && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${BACKGROUND_IMAGE.MAIN})`,
            backgroundSize: BACKGROUND_IMAGE.SIZE,
            backgroundPosition: 'center',
          }}
          aria-hidden
        />
      )}
      {/* ชั้นมืดทับพื้นหลังให้อ่านตารางง่าย */}
      {BACKGROUND_IMAGE.ENABLED && (
        <div
          className="absolute inset-0 z-0 bg-slate-950 pointer-events-none"
          style={{ opacity: BACKGROUND_IMAGE.OVERLAY_OPACITY }}
          aria-hidden
        />
      )}
      {/* Main Canvas Layer */}
      <div className="absolute inset-0 z-[1]">
        {isReady ? (
          <GridMap />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-3 text-slate-400">
            <img src="/loading/loading.gif" alt="" width={80} height={80} className="object-contain" />
            <p className="text-sm">กำลังโหลดแผนที่...</p>
          </div>
        )}
      </div>

      {/* UI Overlay Layer (HUD, Zoom Controls) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <UIOverlay />
      </div>

      {/* Sidebar Overlay (Right Panel) */}
      <div className="absolute top-0 right-0 h-full z-20 pointer-events-none flex flex-row justify-end">
        <Sidebar />
      </div>

      {/* คำแนะนำครั้งแรก: แตะร้านบนแผนที่เพื่อเข้าชม */}
      {showMapHint && isReady && (
        <div
          className="absolute left-4 right-4 z-[15] flex justify-center pointer-events-auto"
          style={{ bottom: "max(6rem, calc(env(safe-area-inset-bottom) + 1rem))" }}
        >
          <div
            role="dialog"
            aria-label="คำแนะนำการใช้แผนที่"
            className="rounded-xl border border-pink-500/40 bg-slate-900/95 backdrop-blur shadow-xl px-4 py-3 flex items-center justify-between gap-3 max-w-md animate-toast-in"
          >
            <p className="text-sm text-slate-200">
              แตะร้านบนแผนที่เพื่อเข้าชมสินค้า
            </p>
            <button
              type="button"
              onClick={dismissMapHint}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
