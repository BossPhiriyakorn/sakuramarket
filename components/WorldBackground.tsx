"use client";

import { useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import type { RoomId } from '../types';
import { ROOM_GRID_BACKGROUND, WORLD_TOTAL_SIZE_PX } from '../constants';
import { isMobile } from '@/lib/device';
import { getDriveImageDisplayUrl } from '@/lib/driveImageUrl';

// ลงทะเบียน GIF loader ให้ Assets.load('.gif') คืน GifSource
import 'pixi.js/gif';

interface GifSourceLike {
  totalFrames: number;
  textures?: PIXI.Texture[];
  /** Total duration in ms (optional, ใช้คำนวณความเร็วเปลี่ยนเฟรม) */
  duration?: number;
  frames?: unknown[];
}

interface Props {
  container: PIXI.Container;
  currentRoom: RoomId;
  /** URL พื้นหลังตารางจาก DB (override constant) — ถ้าไม่ระบุจะ fallback ไป ROOM_GRID_BACKGROUND */
  gridBgUrl?: string | null;
}

type GridBackgroundAsset =
  | { type: 'texture'; texture: PIXI.Texture }
  | { type: 'gif'; source: GifSourceLike }
  | null;

/** ชั้นพื้นหลังโลก — พื้นหลังแอปอยู่ที่ App.tsx | ห้อง 2 ใช้ภาพพื้นหลังตาราง (รองรับ PNG/JPG และ GIF) */
export const WorldBackground = ({ container, currentRoom, gridBgUrl: gridBgUrlProp }: Props) => {
  const [asset, setAsset] = useState<GridBackgroundAsset>(null);
  // ใช้ค่าจาก DB ก่อน ถ้าไม่มีค่อย fallback ไป constant
  const gridBgUrl =
    gridBgUrlProp !== undefined
      ? gridBgUrlProp
      : (ROOM_GRID_BACKGROUND[currentRoom as 1 | 2] ?? null);
  const displayGridBgUrl = getDriveImageDisplayUrl(gridBgUrl ?? '');
  const isMobileDevice = isMobile();

  useEffect(() => {
    if (!displayGridBgUrl) {
      setAsset(null);
      return;
    }
    let cancelled = false;
    const isGif = /\.gif$/i.test(displayGridBgUrl);

    PIXI.Assets.load(displayGridBgUrl).then((loaded) => {
      if (cancelled) return;
      if (isGif && loaded && 'totalFrames' in loaded && typeof (loaded as GifSourceLike).totalFrames === 'number') {
        setAsset({ type: 'gif', source: loaded as GifSourceLike });
      } else if (loaded) {
        setAsset({ type: 'texture', texture: loaded as PIXI.Texture });
      } else {
        setAsset(null);
      }
    }).catch(() => {
      if (!cancelled) setAsset(null);
    });
    return () => { cancelled = true; };
  }, [displayGridBgUrl]);

  useEffect(() => {
    const layer = new PIXI.Container();
    container.addChild(layer);

    if (asset) {
      if (asset.type === 'texture') {
        const sprite = new PIXI.Sprite(asset.texture);
        sprite.width = WORLD_TOTAL_SIZE_PX;
        sprite.height = WORLD_TOTAL_SIZE_PX;
        sprite.position.set(0, 0);
        layer.addChild(sprite);
      } else if (asset.type === 'gif' && asset.source.textures?.length) {
        const textures = asset.source.textures;
        const totalFrames = asset.source.totalFrames;
        const durationMs = asset.source.duration ?? 0;
        const frameDurationMs = totalFrames > 0 && durationMs > 0
          ? durationMs / totalFrames
          : 100; // fallback 10 fps

        const sprite = new PIXI.Sprite(textures[0]);
        sprite.width = WORLD_TOTAL_SIZE_PX;
        sprite.height = WORLD_TOTAL_SIZE_PX;
        sprite.position.set(0, 0);
        layer.addChild(sprite);

        // Mobile Lite: แสดงเฟรมแรกของ GIF แบบภาพนิ่ง เพื่อลดภาระ CPU/GPU และกันรีโหลดซ้ำจาก memory pressure
        if (isMobileDevice) {
          return () => {
            container.removeChild(layer);
            layer.destroy({ children: true });
          };
        }

        let elapsedMs = 0;
        const tick = (ticker: PIXI.Ticker) => {
          elapsedMs += ticker.deltaMS;
          const frameIndex = Math.floor(elapsedMs / frameDurationMs) % totalFrames;
          const tex = textures[frameIndex];
          if (tex) sprite.texture = tex;
        };
        PIXI.Ticker.shared.add(tick);

        return () => {
          PIXI.Ticker.shared.remove(tick);
          container.removeChild(layer);
          layer.destroy({ children: true });
        };
      } else if (asset.type === 'gif' && asset.source.textures?.[0]) {
        const sprite = new PIXI.Sprite(asset.source.textures[0]);
        sprite.width = WORLD_TOTAL_SIZE_PX;
        sprite.height = WORLD_TOTAL_SIZE_PX;
        sprite.position.set(0, 0);
        layer.addChild(sprite);
      }
    }

    return () => {
      container.removeChild(layer);
      layer.destroy({ children: true });
    };
  }, [container, asset]);

  return null;
};
