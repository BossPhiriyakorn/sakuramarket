/**
 * ตรวจสอบอุปกรณ์จาก userAgent — ใช้ร่วมกันใน UIOverlay, GridMap, WorldBackground
 * เพื่อลดการซ้ำของ regex และแก้ที่เดียว
 */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Line/i.test(navigator.userAgent);
}
