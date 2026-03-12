"use client";

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useStore } from '../store';
import { GridBackground } from './GridBackground';
import { ParcelLayer } from './ParcelLayer';
import { WorldBackground } from './WorldBackground';
import { HoverLayer } from './HoverLayer';
import { getMinZoom, MAX_ZOOM, GRID_SIZE, FRAME_MARGIN } from '../constants';
import { isMobile } from '@/lib/device';
import * as PIXI from 'pixi.js';

/**
 * GLOBAL LOCK SYSTEM
 * To prevent "Extension type batcher already has a handler" errors in v8,
 * we must ensure that PIXI.Application.init() is never called while
 * another initialization or destruction is in progress.
 */
let globalLock: Promise<void> = Promise.resolve();

export const GridMap = () => {
  const viewport = useStore((state) => state.viewport);
  const setViewport = useStore((state) => state.setViewport);
  const isDragging = useStore((state) => state.isDragging);
  const setDragging = useStore((state) => state.setDragging);
  const setMapDragEndedAt = useStore((state) => state.setMapDragEndedAt);
  const selectParcel = useStore((state) => state.selectParcel);
  const setHoveredGridPos = useStore((state) => state.setHoveredGridPos);
  const currentRoom = useStore((state) => state.currentRoom);
  const showGridLines = useStore((state) => state.showGridLines);
  const rooms = useStore((state) => state.rooms);
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  
  // Explicit Layers for z-index management
  const worldLayerRef = useRef<PIXI.Container | null>(null);
  const gridLayerRef = useRef<PIXI.Container | null>(null);
  const hoverLayerRef = useRef<PIXI.Container | null>(null);
  const parcelLayerRef = useRef<PIXI.Container | null>(null);
  const rootContainerRef = useRef<PIXI.Container | null>(null);
  
  const [isPixiReady, setIsPixiReady] = useState(false);
  // พื้นหลังตารางดึงจาก rooms ใน store (โหลดครั้งเดียวกับ UIOverlay — ลดเรียก API ซ้ำบนมือถือ)
  const roomBgUrls: Record<number, string | null> = Object.fromEntries(
    rooms.map((r) => [r.id, r.background_url ?? null])
  );
  
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastViewportPosRef = useRef({ x: 0, y: 0 });
  const rafHoverRef = useRef<number | null>(null);
  const isMobileDevice = isMobile();

  // Refs for native touch listeners (always see latest viewport/setViewport)
  const viewportRef = useRef(viewport);
  const setViewportRef = useRef(setViewport);
  viewportRef.current = viewport;
  setViewportRef.current = setViewport;

  // Pinch state: 2-finger zoom on mobile
  const pinchRef = useRef<{
    distance: number;
    viewport: { x: number; y: number; zoom: number };
    center: { x: number; y: number };
  } | null>(null);
  const isPinchingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; selectParcel/viewport in closure intentionally not in deps
    let mounted = true;

    // The sequence must be: WAIT -> INIT -> FINISH
    const startPixi = async () => {
      // 1. Wait for any previous instance to finish initialization or destruction
      await globalLock;

      // 2. Wrap the next operation in a new lock
      let resolveLock: () => void;
      globalLock = new Promise((resolve) => { resolveLock = resolve; });

      try {
        if (!mounted) {
            resolveLock!();
            return;
        }

        // 3. Create and Initialize Application (พื้นหลังโปร่งใสเพื่อให้เห็นรูปพื้นหลังแอป)
        // มือถือ iOS/Android: ใช้ safe renderer settings เพื่อลดโอกาส WebGL memory pressure แล้วรีโหลดหน้า
        const safeResolution = isMobileDevice
          ? 1
          : Math.min(window.devicePixelRatio || 1, 2);
        const app = new PIXI.Application();
        await app.init({
            resizeTo: containerRef.current ?? window,
            backgroundColor: 0x000000,
            backgroundAlpha: 0,
            antialias: !isMobileDevice,
            autoDensity: !isMobileDevice,
            resolution: safeResolution,
            powerPreference: isMobileDevice ? 'low-power' : 'high-performance',
        });

        // 4. Post-init check in case component unmounted during async init
        if (!mounted) {
            // Fix: remove invalid 'children' and 'texture' properties from PIXI v8 Application.destroy
            app.destroy({ removeView: true });
            resolveLock!();
            return;
        }

        if (containerRef.current) {
            containerRef.current.appendChild(app.canvas);
        }
        appRef.current = app;

        // 5. Setup Scene Hierachy
        const root = new PIXI.Container();
        root.eventMode = 'static';
        
        const worldLayer = new PIXI.Container();
        const gridLayer = new PIXI.Container();
        const hoverLayer = new PIXI.Container();
        const parcelLayer = new PIXI.Container();
        
        root.addChild(worldLayer);
        root.addChild(gridLayer);
        root.addChild(hoverLayer);
        root.addChild(parcelLayer);
        
        worldLayerRef.current = worldLayer;
        gridLayerRef.current = gridLayer;
        hoverLayerRef.current = hoverLayer;
        parcelLayerRef.current = parcelLayer;
        rootContainerRef.current = root;

        app.stage.eventMode = 'static';
        app.stage.hitArea = app.screen;
        app.stage.on('pointertap', () => {
            selectParcel(null);
        });

        app.stage.addChild(root);
        // ลด FPS บนมือถือเพื่อกันแรงกระชาก CPU/GPU
        if (isMobileDevice) app.ticker.maxFPS = 30;
        
        // Initial viewport sync (พื้นหลังห่างจากกรอบ FRAME_MARGIN px)
        root.position.set(viewport.x + FRAME_MARGIN, viewport.y + FRAME_MARGIN);
        root.scale.set(viewport.zoom);
        
        setIsPixiReady(true);

      } catch (err) {
        console.error("Failed to initialize PixiJS:", err);
      } finally {
        // 6. Release lock for the next mount/unmount cycle
        resolveLock!();
      }
    };

    startPixi();

    return () => {
      mounted = false;
      setIsPixiReady(false);

      const cleanup = async () => {
        // Wait for any pending initialization to finish before destroying
        await globalLock;

        let resolveLock: () => void;
        globalLock = new Promise((resolve) => { resolveLock = resolve; });

        if (appRef.current) {
          try {
            // v8 proper destroy sequence
            // Fix: remove invalid 'children' and 'texture' properties from PIXI v8 Application.destroy
            appRef.current.destroy({ 
              removeView: true
            });
          } catch (e) {
            console.warn("Error during Pixi cleanup:", e);
          }
          appRef.current = null;
        }
        
        // Clear refs
        worldLayerRef.current = null;
        gridLayerRef.current = null;
        hoverLayerRef.current = null;
        parcelLayerRef.current = null;
        rootContainerRef.current = null;

        resolveLock!();
      };

      cleanup();
    };
  }, []);

  // Sync Viewport Changes to root container (ห่างกรอบ FRAME_MARGIN)
  useEffect(() => {
    if (rootContainerRef.current) {
      rootContainerRef.current.position.set(viewport.x + FRAME_MARGIN, viewport.y + FRAME_MARGIN);
      rootContainerRef.current.scale.set(viewport.zoom);
    }
  }, [viewport]);

  // Handle Resize Events
  useEffect(() => {
    const handleResize = () => {
      if (appRef.current) {
        appRef.current.stage.hitArea = appRef.current.screen;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // มือถือ: ป้องกันดึงบราวเซอร์เมื่อลากแผนที่ + รองรับ pinch zoom 2 นิ้ว
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isMobileDevice) return;

    const getTouchDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const a = touches[0];
      const b = touches[1];
      return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    };
    const getTouchCenter = (touches: TouchList) => {
      if (touches.length < 2) return { x: 0, y: 0 };
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinchingRef.current = true;
        setDragging(false);
        dragStartRef.current = null;
        const v = viewportRef.current;
        pinchRef.current = {
          distance: getTouchDistance(e.touches),
          viewport: { x: v.x, y: v.y, zoom: v.zoom },
          center: getTouchCenter(e.touches),
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const dragging = dragStartRef.current != null;
      const pinching = pinchRef.current != null && e.touches.length === 2;
      if (dragging || pinching) {
        e.preventDefault();
      }
      if (pinchRef.current && e.touches.length === 2) {
        const prev = pinchRef.current;
        const newDistance = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches);
        if (newDistance <= 0) return;
        const scale = newDistance / prev.distance;
        const minZoom = getMinZoom(isMobileDevice);
        const newZoom = Math.min(Math.max(prev.viewport.zoom * scale, minZoom), MAX_ZOOM);
        const worldX = (center.x - prev.viewport.x - FRAME_MARGIN) / prev.viewport.zoom;
        const worldY = (center.y - prev.viewport.y - FRAME_MARGIN) / prev.viewport.zoom;
        const newX = center.x - FRAME_MARGIN - worldX * newZoom;
        const newY = center.y - FRAME_MARGIN - worldY * newZoom;
        setViewportRef.current({ x: newX, y: newY, zoom: newZoom });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchRef.current = null;
        isPinchingRef.current = false;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { capture: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    el.addEventListener('touchend', onTouchEnd, { capture: true });
    el.addEventListener('touchcancel', onTouchEnd, { capture: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart, { capture: true });
      el.removeEventListener('touchmove', onTouchMove, { capture: true });
      el.removeEventListener('touchend', onTouchEnd, { capture: true });
      el.removeEventListener('touchcancel', onTouchEnd, { capture: true });
    };
  }, [isMobileDevice]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const scaleFactor = 1.1;
    const direction = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
    const minZoom = getMinZoom(isMobileDevice);
    const newZoom = Math.min(Math.max(viewport.zoom * direction, minZoom), MAX_ZOOM);
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const worldX = (mouseX - viewport.x - FRAME_MARGIN) / viewport.zoom;
    const worldY = (mouseY - viewport.y - FRAME_MARGIN) / viewport.zoom;
    const newX = mouseX - FRAME_MARGIN - worldX * newZoom;
    const newY = mouseY - FRAME_MARGIN - worldY * newZoom;
    setViewport({ x: newX, y: newY, zoom: newZoom });
  }, [viewport, setViewport]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (isPinchingRef.current) return;
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastViewportPosRef.current = { x: viewport.x, y: viewport.y };
  }, [viewport, setDragging]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDragging && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setViewport({
          x: lastViewportPosRef.current.x + dx,
          y: lastViewportPosRef.current.y + dy,
        });
    }

    // Mobile Lite: ไม่ต้องคำนวณ hover ทุก event เพื่อกดภาระ render
    if (isMobileDevice) return;
    if (rafHoverRef.current !== null) cancelAnimationFrame(rafHoverRef.current);
    rafHoverRef.current = requestAnimationFrame(() => {
      const worldX = (e.clientX - viewport.x - FRAME_MARGIN) / viewport.zoom;
      const worldY = (e.clientY - viewport.y - FRAME_MARGIN) / viewport.zoom;
      const gridX = Math.floor(worldX / GRID_SIZE);
      const gridY = Math.floor(worldY / GRID_SIZE);
      setHoveredGridPos({ x: gridX, y: gridY });
    });
  }, [isDragging, viewport, setViewport, setHoveredGridPos, isMobileDevice]);

  const handlePointerUp = useCallback(() => {
    const wasDragging = dragStartRef.current != null;
    if (wasDragging) setMapDragEndedAt(Date.now());
    setDragging(false);
    dragStartRef.current = null;
  }, [setDragging, setMapDragEndedAt]);

  useEffect(() => {
    return () => {
      if (rafHoverRef.current !== null) cancelAnimationFrame(rafHoverRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full cursor-${isDragging ? 'grabbing' : 'grab'} overflow-hidden touch-none`}
      style={{ touchAction: 'none' }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { handlePointerUp(); setHoveredGridPos(null); }}
    >
        {isPixiReady && worldLayerRef.current && gridLayerRef.current && hoverLayerRef.current && parcelLayerRef.current && (
            <>
                <WorldBackground container={worldLayerRef.current} currentRoom={currentRoom} gridBgUrl={roomBgUrls[currentRoom]} />
                <GridBackground container={gridLayerRef.current} currentRoom={currentRoom} showGridLines={showGridLines} gridBgUrl={roomBgUrls[currentRoom]} />
                {!isMobileDevice && <HoverLayer container={hoverLayerRef.current} />}
                <ParcelLayer container={parcelLayerRef.current} />
            </>
        )}
    </div>
  );
};
