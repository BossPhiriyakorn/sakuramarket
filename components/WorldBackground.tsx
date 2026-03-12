"use client";

import { useEffect, useMemo, useState } from 'react';
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

function isGifSourceLike(value: unknown): value is GifSourceLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'totalFrames' in value &&
    typeof (value as { totalFrames?: unknown }).totalFrames === 'number'
  );
}

function loadTextureFromUrl(url: string): Promise<PIXI.Texture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(PIXI.Texture.from(img));
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
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
  const defaultBgUrl = ROOM_GRID_BACKGROUND[currentRoom as 1 | 2] ?? null;
  // ใช้ค่าจาก DB ก่อน ถ้าไม่มีค่อย fallback ไป constant
  const preferredBgUrl =
    gridBgUrlProp !== undefined
      ? gridBgUrlProp
      : defaultBgUrl;
  const shouldTryGif = useMemo(
    () => /\.gif(?:$|\?)/i.test(preferredBgUrl ?? '') || /\.gif(?:$|\?)/i.test(defaultBgUrl ?? ''),
    [preferredBgUrl, defaultBgUrl]
  );
  const displayCandidates = useMemo(() => {
    const preferred = getDriveImageDisplayUrl(preferredBgUrl ?? '');
    const fallback = defaultBgUrl ? getDriveImageDisplayUrl(defaultBgUrl) : '';
    const seed = [preferred, fallback].filter((u): u is string => Boolean(u));
    const expanded: string[] = [];
    for (const u of seed) {
      if (!u) continue;
      expanded.push(u);
      if (u.startsWith('/api/proxy-image?url=')) {
        try {
          const parsed = new URL(`http://local${u}`);
          const upstream = parsed.searchParams.get('url');
          if (upstream) expanded.push(upstream);
        } catch {
          // ignore parse error and keep original URL
        }
      }
    }
    const dedup = Array.from(new Set(expanded));
    return dedup.map((u) => {
      if (typeof window !== 'undefined' && u.startsWith('/')) {
        return window.location.origin + u;
      }
      return u;
    });
  }, [preferredBgUrl, defaultBgUrl]);
  const displayGridBgUrl = displayCandidates[0] ?? '';
  const isMobileDevice = isMobile();

  useEffect(() => {
    if (displayCandidates.length === 0) {
      setAsset(null);
      return;
    }
    let cancelled = false;

    const loadWithFallback = async (): Promise<GridBackgroundAsset> => {
      for (const url of displayCandidates) {
        if (shouldTryGif) {
          try {
            const loaded = await PIXI.Assets.load(url);
            if (isGifSourceLike(loaded)) {
              return { type: 'gif', source: loaded };
            }
          } catch {
            // fallback to normal image loader
          }
        }
        try {
          const texture = await loadTextureFromUrl(url);
          return { type: 'texture', texture };
        } catch {
          // try next candidate
        }
      }
      return null;
    };

    loadWithFallback().then((loadedAsset) => {
      if (cancelled) return;
      setAsset(loadedAsset);
    }).catch(() => {
      if (!cancelled) setAsset(null);
    });
    return () => { cancelled = true; };
  }, [displayGridBgUrl, displayCandidates, shouldTryGif]);

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
