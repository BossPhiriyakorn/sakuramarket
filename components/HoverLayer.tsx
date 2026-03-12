"use client";

import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store';
import { GRID_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../constants';

interface Props {
  container: PIXI.Container;
}

export const HoverLayer = ({ container }: Props) => {
  const hoveredPos = useStore(state => state.hoveredGridPos);
  const parcels = useStore(state => state.parcels);
  const graphicsRef = useRef<PIXI.Graphics | null>(null);

  useEffect(() => {
    const g = new PIXI.Graphics();
    container.addChild(g);
    graphicsRef.current = g;
    return () => {
      container.removeChild(g);
      g.destroy();
    };
  }, [container]);

  useEffect(() => {
    const g = graphicsRef.current;
    if (!g) return;

    g.clear();
    if (!hoveredPos) return;

    if (hoveredPos.x < 0 || hoveredPos.x >= WORLD_WIDTH || hoveredPos.y < 0 || hoveredPos.y >= WORLD_HEIGHT) return;

    const isOccupied = parcels.some(p => 
      hoveredPos.x >= p.grid_x && 
      hoveredPos.x < p.grid_x + p.width &&
      hoveredPos.y >= p.grid_y && 
      hoveredPos.y < p.grid_y + p.height
    );

    if (isOccupied) return;

    // PixiJS v8 API
    g.setFillStyle({ color: 0xF72585, alpha: 0.2 });
    g.setStrokeStyle({ width: 2, color: 0xF72585, alpha: 0.4 });
    g.rect(hoveredPos.x * GRID_SIZE, hoveredPos.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    g.fill();
    g.stroke();

  }, [hoveredPos, parcels]);

  return null;
};
