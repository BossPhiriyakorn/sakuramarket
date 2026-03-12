"use client";

import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { GRID_SIZE } from '../constants';
import * as PIXI from 'pixi.js';
import { normalizeImageUrl } from '@/lib/imageUrl';

interface Props {
  container: PIXI.Container;
}

function destroyChildSafely(child: PIXI.Container) {
  const c = child as PIXI.Container & { __pulseCleanupList?: Array<() => void> };
  if (Array.isArray(c.__pulseCleanupList)) {
    c.__pulseCleanupList.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore cleanup error
      }
    });
    c.__pulseCleanupList = [];
  }
  child.destroy({ children: true });
}

export const ParcelLayer = ({ container }: Props) => {
  const parcels = useStore(state => state.parcels);
  const selectedId = useStore(state => state.selectedParcelId);
  const selectParcel = useStore(state => state.selectParcel);
  
  const layerRef = useRef<PIXI.Container | null>(null);
  const pulseRef = useRef<number>(0);
  const loadIdRef = useRef<number>(0);

  useEffect(() => {
    // Initialize Layer Container
    const layer = new PIXI.Container();
    layer.sortableChildren = true; // Ensure z-index works if needed
    container.addChild(layer);
    layerRef.current = layer;

    // Animation Loop for Selection Pulse
    const pulseTicker = (ticker: PIXI.Ticker) => {
        pulseRef.current += 0.05 * ticker.deltaTime;
    };
    PIXI.Ticker.shared.add(pulseTicker);

    return () => {
      PIXI.Ticker.shared.remove(pulseTicker);
      const children = layer.removeChildren();
      children.forEach((child) => destroyChildSafely(child as PIXI.Container));
      container.removeChild(layer);
      layer.destroy();
      layerRef.current = null;
    };
  }, [container]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    loadIdRef.current += 1;
    const currentLoadId = loadIdRef.current;

    // Clear existing children to redraw (ต้อง destroy เพื่อลด memory leak)
    const oldChildren = layer.removeChildren();
    oldChildren.forEach((child) => destroyChildSafely(child as PIXI.Container));

    // แปลง URL รูป: รองรับทั้ง URL เต็ม (Drive) และ path ในโปรเจกต์
    // URL ภายนอก (เช่น Drive) จะพยายามผ่าน proxy ก่อน เพื่อเลี่ยง CORS บน Canvas/WebGL
    const toAbsoluteUrl = (rawPath: string) => {
      const normalized = normalizeImageUrl(rawPath) ?? "";
      if (!normalized) return "";
      if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return normalized;
      if (/^https?:\/\//i.test(normalized)) {
        if (typeof window !== "undefined") {
          try {
            const u = new URL(normalized);
            if (u.origin !== window.location.origin) {
              return `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(normalized)}`;
            }
          } catch {
            // fallback to direct URL
          }
        }
        return normalized;
      }
      const withSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
      return typeof window !== "undefined" ? `${window.location.origin}${withSlash}` : withSlash;
    };

    const getImageCandidateUrls = (rawPath: string): string[] => {
      const normalized = normalizeImageUrl(rawPath) ?? "";
      if (!normalized) return [];
      if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return [normalized];
      if (!/^https?:\/\//i.test(normalized)) return [toAbsoluteUrl(normalized)];
      if (typeof window === "undefined") return [normalized];
      try {
        const u = new URL(normalized);
        if (u.origin === window.location.origin) return [normalized];
        const proxyUrl = `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(normalized)}`;
        return [proxyUrl, normalized];
      } catch {
        return [normalized];
      }
    };

    const loadTextureFromUrl = (url: string): Promise<PIXI.Texture> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        // สำคัญ: ให้ browser ส่ง CORS credential แบบ anonymous เมื่อลองโหลดตรงจากภายนอก
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => resolve(PIXI.Texture.from(img));
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
      });

    const loadTextureWithFallback = async (rawPath: string): Promise<PIXI.Texture | null> => {
      const candidates = getImageCandidateUrls(rawPath);
      for (const url of candidates) {
        if (!url) continue;
        try {
          return await loadTextureFromUrl(url);
        } catch {
          // try next candidate
        }
      }
      return null;
    };

    // Render Parcels
    parcels.forEach(parcel => {
      const x = parcel.grid_x * GRID_SIZE;
      const y = parcel.grid_y * GRID_SIZE;
      const width = parcel.width * GRID_SIZE;
      const height = parcel.height * GRID_SIZE;
      const isSelected = selectedId === parcel.id;

      const pContainer = new PIXI.Container() as PIXI.Container & { __pulseCleanupList?: Array<() => void> };
      pContainer.__pulseCleanupList = [];
      pContainer.x = x;
      pContainer.y = y;
      
      // Interaction — ไม่เปิดสไลด์เมื่อเพิ่งปล่อยจากการลากแผนที่ (ถือว่าไม่ได้ตั้งใจเลือกร้าน)
      pContainer.eventMode = 'static';
      pContainer.cursor = 'pointer';
      pContainer.on('pointertap', (e) => {
        e.stopPropagation();
        const { mapDragEndedAt } = useStore.getState();
        if (mapDragEndedAt != null && Date.now() - mapDragEndedAt < 200) return;
        selectParcel(parcel.id);
      });

      if (parcel.is_label) {
        // --- ZONE LABEL STYLING ---
        const bg = new PIXI.Graphics();
        bg.setFillStyle({ color: 0x0f172a, alpha: 0.85 });
        bg.setStrokeStyle({ width: 2, color: 0xec4899, alpha: 0.8 });
        bg.rect(0, 0, width, height);
        bg.fill();
        bg.stroke();
        pContainer.addChild(bg);

        // Show image for zone labels too (async load)
        if (parcel.image_url) {
          loadTextureWithFallback(parcel.image_url)
            .then((texture) => {
              if (!texture) throw new Error("No texture loaded");
              if (currentLoadId !== loadIdRef.current || pContainer.destroyed) return;
              const sprite = new PIXI.Sprite(texture);
              sprite.width = width;
              sprite.height = height;
              sprite.alpha = 0.3;
              pContainer.addChild(sprite);
            })
            .catch((err) => console.warn(`Error loading zone image for ${parcel.id}:`, err));
        }

        const text = new PIXI.Text({
            text: parcel.title, 
            style: {
                fontFamily: 'Inter, sans-serif',
                fontSize: 24,
                fontWeight: '900',
                fill: 0xec4899,
                dropShadow: { blur: 4, color: 0x000000, distance: 2, alpha: 0.5 },
                letterSpacing: 2
            }
        });
        text.anchor.set(0.5);
        text.x = width / 2;
        text.y = height / 2;
        pContainer.addChild(text);

        const subText = new PIXI.Text({
            text: 'OFFICIAL DISTRICT',
            style: {
                fontFamily: 'Inter, sans-serif', fontSize: 10, fill: 0xf472b6, fontWeight: 'bold', letterSpacing: 1
            }
        });
        subText.alpha = 0.7;
        subText.anchor.set(0.5);
        subText.x = width / 2;
        subText.y = (height / 2) + 20;
        pContainer.addChild(subText);

      } else {
        // --- NORMAL PARCEL STYLING ---
        const bg = new PIXI.Graphics();
        const fillColor = parcel.color || 0x1e293b;
        const alpha = 1.0;
        
        // Base fill
        bg.setFillStyle({ color: fillColor, alpha });
        bg.rect(0, 0, width, height);
        bg.fill();
        pContainer.addChild(bg);

        // รูปโปรไฟล์ร้าน (โหลดแบบ async ด้วย Assets.load เพื่อให้แสดงบนแผนที่)
        // ไม่ใช้ Graphics เป็น mask — ใน PIXI v8 การใส่ sprite ตรงขนาดช่องพอดี แสดงเต็มช่องได้
        if (parcel.image_url) {
          loadTextureWithFallback(parcel.image_url)
            .then((texture) => {
              if (!texture) throw new Error("No texture loaded");
              if (currentLoadId !== loadIdRef.current || pContainer.destroyed) return;
              const sprite = new PIXI.Sprite(texture);
              sprite.width = width;
              sprite.height = height;
              sprite.roundPixels = true;
              pContainer.addChild(sprite);
            })
            .catch((err) => console.warn(`Error loading shop image for ${parcel.id}:`, err));
        }

        // Selection Border (Pulse)
        if (isSelected) {
          const border = new PIXI.Graphics();
          const drawPulse = () => {
             // Access pulseRef inside the ticker callback wrapper or simple render
             if (border.destroyed) return;
             border.clear();
             const alpha = 0.6 + Math.sin(pulseRef.current) * 0.4;
             border.setFillStyle({ color: 0xF72585, alpha: 0.1 });
             border.setStrokeStyle({ width: 4, color: 0xF72585, alpha });
             border.rect(0, 0, width, height);
             border.fill();
             border.stroke();
          };
          
          // Add local ticker for this selected item
          PIXI.Ticker.shared.add(drawPulse);
          pContainer.__pulseCleanupList?.push(() => PIXI.Ticker.shared.remove(drawPulse));
          pContainer.addChild(border);
        }
      }

      layer.addChild(pContainer);
    });

  }, [parcels, selectedId, selectParcel]);

  return null;
};
