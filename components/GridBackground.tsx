"use client";

import { useEffect, useRef } from 'react';
import { GRID_SIZE, GRID_COLOR, GRID_FILL_COLOR, WORLD_WIDTH, WORLD_HEIGHT, ROOM_GRID_BACKGROUND } from '../constants';
import type { RoomId } from '../types';
import * as PIXI from 'pixi.js';
import { getDriveImageDisplayUrl } from '@/lib/driveImageUrl';

interface Props {
  container: PIXI.Container;
  currentRoom: RoomId;
  /** เมื่อ false จะไม่วาดเส้นตาราง (ยังมี fill, border, label ตามเดิม) */
  showGridLines: boolean;
  /** URL พื้นหลังตารางจาก DB (override constant) — ถ้าไม่ระบุจะ fallback ไป ROOM_GRID_BACKGROUND */
  gridBgUrl?: string | null;
}

export const GridBackground = ({ container, currentRoom, showGridLines, gridBgUrl: gridBgUrlProp }: Props) => {
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const textContainerRef = useRef<PIXI.Container | null>(null);

  useEffect(() => {
    // Initialize containers
    const g = new PIXI.Graphics();
    const t = new PIXI.Container();
    
    // Grid lines should be at the bottom of this layer
    container.addChild(g);
    // Text labels on top of lines
    container.addChild(t);
    
    graphicsRef.current = g;
    textContainerRef.current = t;

    // --- DRAWING LOGIC ---
    const worldWidthPx = WORLD_WIDTH * GRID_SIZE;
    const worldHeightPx = WORLD_HEIGHT * GRID_SIZE;

    // 1. Clear previous
    g.clear();
    t.removeChildren();

    // 2. เติมพื้นหลังตารางเฉพาะเมื่อห้องไม่มีภาพพื้นหลังตาราง (ให้ภาพใน WorldBackground โชว์ผ่าน)
    // ใช้ค่าจาก DB ก่อน ถ้าไม่มีค่อย fallback ไป constant
    const defaultBgUrl = ROOM_GRID_BACKGROUND[currentRoom as 1 | 2] ?? null;
    const preferredBgUrl =
      gridBgUrlProp !== undefined
        ? gridBgUrlProp
        : defaultBgUrl;
    const preferredDisplayUrl = getDriveImageDisplayUrl(preferredBgUrl ?? "");
    const fallbackDisplayUrl = defaultBgUrl ? getDriveImageDisplayUrl(defaultBgUrl) : "";
    const hasGridBackgroundImage = Boolean(preferredDisplayUrl || fallbackDisplayUrl);
    if (!hasGridBackgroundImage) {
      g.setFillStyle({ color: GRID_FILL_COLOR, alpha: 1 });
      g.rect(0, 0, worldWidthPx, worldHeightPx);
      g.fill();
    }

    // 3. Draw Grid Lines (PixiJS v8 API) — วาดเฉพาะเมื่อเปิดแสดงเส้นตาราง
    if (showGridLines) {
      g.setStrokeStyle({ width: 1, color: GRID_COLOR, alpha: 0.6 });
      for (let x = 0; x <= WORLD_WIDTH; x++) {
        const pos = x * GRID_SIZE;
        g.moveTo(pos, 0);
        g.lineTo(pos, worldHeightPx);
      }
      for (let y = 0; y <= WORLD_HEIGHT; y++) {
        const pos = y * GRID_SIZE;
        g.moveTo(0, pos);
        g.lineTo(worldWidthPx, pos);
      }
      g.stroke();
    }

    // 4. World Border (Thicker) — ใส่ใน container ไม่ใส่ใน g เพื่อเลี่ยง PIXI v8 deprecation (เฉพาะ Container ควรมี children)
    const border = new PIXI.Graphics();
    border.setStrokeStyle({ width: 4, color: 0xec4899, alpha: 0.5 });
    border.rect(0, 0, worldWidthPx, worldHeightPx);
    border.stroke();
    container.addChild(border);

    // 4. Draw Labels (Static Size, let them scale with zoom naturally)
    const _cellStyle = new PIXI.TextStyle({
      fontFamily: 'Inter, sans-serif',
      fontSize: 14, // Fixed size
      fill: 0xffffff,
      align: 'center',
    });

    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'Inter, sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xec4899,
      align: 'center',
    });

    // Row & Column Labels
    // Columns (A, B, C...)
    for (let x = 0; x < WORLD_WIDTH; x++) {
        const charCode = 65 + (x % 26);
        const prefix = x >= 26 ? String.fromCharCode(65 + Math.floor(x / 26) - 1) : '';
        const char = prefix + String.fromCharCode(charCode);
        
        const label = new PIXI.Text({ text: char, style: labelStyle });
        label.anchor.set(0.5, 1);
        label.x = (x * GRID_SIZE) + (GRID_SIZE / 2);
        label.y = -10;
        t.addChild(label);
    }

    // Rows (1, 2, 3...)
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        const label = new PIXI.Text({ text: (y + 1).toString(), style: labelStyle });
        label.anchor.set(0, 0.5);
        label.x = worldWidthPx + 15;
        label.y = (y * GRID_SIZE) + (GRID_SIZE / 2);
        t.addChild(label);
    }

    return () => {
      container.removeChild(border);
      border.destroy();
      container.removeChild(g);
      container.removeChild(t);
      g.destroy();
      t.destroy({ children: true });
    };
  }, [container, currentRoom, showGridLines, gridBgUrlProp]);

  return null;
};
