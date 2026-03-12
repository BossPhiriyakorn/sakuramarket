import { getDriveImageDisplayUrl } from "@/lib/driveImageUrl";

/**
 * แปลง URL รูปที่เก็บแบบ /public/uploads/... ให้เป็น /uploads/...
 * และแปลงลิงก์ Google Drive ให้เป็นลิงก์ที่แสดงใน <img> ได้
 */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (normalized.startsWith("/public/uploads/")) {
    normalized = "/uploads/" + normalized.slice("/public/uploads/".length);
  } else if (normalized.startsWith("public/uploads/")) {
    normalized = "/uploads/" + normalized.slice("public/uploads/".length);
  } else if (normalized.startsWith("uploads/")) {
    normalized = "/" + normalized;
  }

  return getDriveImageDisplayUrl(normalized);
}
