export const GRID_SIZE = 64; // Pixels per 1x1 grid unit
export const GRID_COLOR = 0x334155; // Slate-700
export const GRID_FILL_COLOR = 0x0f172a; // สีทึบภายในตาราง (Slate-900)
export const BACKGROUND_COLOR = 0x020617; // Slate-950 (Black)
export const HIGHLIGHT_COLOR = 0xec4899; // Sakura Pink (pink-500)
export const CHUNK_SIZE = 16;

// Square Grid: 32 x 32 = 1,024 slots
export const WORLD_WIDTH = 32;
export const WORLD_HEIGHT = 32;

// พื้นหลังใหญ่กว่าตาราง 20px ทุกด้าน
export const BACKGROUND_MARGIN = 20;
export const WORLD_TOTAL_SIZE_PX = WORLD_WIDTH * GRID_SIZE;
const WORLD_WITH_MARGIN_PX = WORLD_TOTAL_SIZE_PX + BACKGROUND_MARGIN * 2;

// ระยะห่างจากกรอบ (หน้าจอ) 500px ทุกด้าน
export const FRAME_MARGIN = 500;
const INNER_W = typeof window !== 'undefined' ? Math.max(100, window.innerWidth - FRAME_MARGIN * 2) : 1024;
const INNER_H = typeof window !== 'undefined' ? Math.max(100, window.innerHeight - FRAME_MARGIN * 2) : 768;

// Safe window access
const SCREEN_W = typeof window !== 'undefined' ? window.innerWidth : 1024;
const SCREEN_H = typeof window !== 'undefined' ? window.innerHeight : 768;

// ซูมออกสุด: ไม่ให้ซูมออกจนตารางเล็กเกิน (ขั้นต่ำ 0.45 = ตารางประมาณ 940px)
const MIN_ZOOM_CALC = Math.min(INNER_W, INNER_H) / WORLD_WITH_MARGIN_PX;
export const MIN_ZOOM = Math.max(0.45, Math.min(1, MIN_ZOOM_CALC));
/** มือถือ: ให้ซูมออกได้มากกว่า (เห็นแผนที่เต็มมากขึ้น) */
export const MIN_ZOOM_MOBILE = 0.28;
export function getMinZoom(isMobile: boolean): number {
  return isMobile ? MIN_ZOOM_MOBILE : MIN_ZOOM;
}
export const MAX_ZOOM = 4.0;

// Focus closely on the center
const START_ZOOM = 1.2;

// จุดศูนย์กลางอยู่ภายในกรอบ (ห่างขอบ 500px)
export const INITIAL_VIEWPORT = {
  x: (SCREEN_W / 2) - FRAME_MARGIN - (WORLD_TOTAL_SIZE_PX * START_ZOOM / 2),
  y: (SCREEN_H / 2) - FRAME_MARGIN - (WORLD_TOTAL_SIZE_PX * START_ZOOM / 2),
  zoom: START_ZOOM,
};

// ==================== BACKGROUND SETTINGS ====================
// พื้นหลังแอป (ไม่ยึดกับตาราง) - Full HD / คอม / แท็บเล็ต / โมบาย

export const BACKGROUND_IMAGE = {
  MAIN: '/backgrounds/Bg123.jpg',
  FALLBACK: null,
  ENABLED: true,
  /** ความเข้มทับรูป (0 = เต็มสี, 1 = มืดหมด) - ลดลงให้เห็นรูปพื้นหลัง */
  OVERLAY_OPACITY: 0.25,
  /** ขนาด: cover = เต็มจอครบ (แนะนำ), contain = โชว์ครบไม่ตัด */
  SIZE: 'cover' as 'cover' | 'contain',
};

/** พื้นหลังของตารางเท่านั้น (ไม่ใช่พื้นหลังแอป) — ห้อง 2 ใช้ภาพในตาราง */
export const ROOM_GRID_BACKGROUND: Record<1 | 2, string | null> = {
  1: null,
  2: '/backgrounds/grid/SR3.gif',
};

/** ค่าธรรมเนียม Gas (เหรียญ) สำหรับหน้ารวมการชำระ — ตัวอย่าง */
export const CHECKOUT_GAS_FEE = 10;
