/**
 * แปลง URL รูป Google Drive เป็น thumbnail เพื่อให้แสดงใน <img> ได้เสถียร
 * เพราะลิงก์ webView/webContent บางรูปแบบไม่ใช่ direct image URL
 */
function extractDriveFileId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // รองรับเคสที่ URL ไม่สมบูรณ์/มีอักขระพิเศษ
  let parsed: URL | null = null;
  try {
    parsed = new URL(trimmed);
  } catch {
    parsed = null;
  }

  if (parsed) {
    const host = parsed.hostname.toLowerCase();
    const isDriveHost =
      host === "drive.google.com" ||
      host === "docs.google.com" ||
      host === "drive.usercontent.google.com";

    if (isDriveHost) {
      const idFromQuery = parsed.searchParams.get("id");
      if (idFromQuery) return idFromQuery;

      const m = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      if (m?.[1]) return m[1];
    }
  }

  const fallback =
    trimmed.match(/drive\.google\.com\/.*?[?&]id=([^&]+)/) ||
    trimmed.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/) ||
    trimmed.match(/drive\.google\.com\/file\/d\/([^/?]+)/) ||
    trimmed.match(/drive\.usercontent\.google\.com\/.*?[?&]id=([^&]+)/);

  return fallback?.[1] ?? null;
}

export function getDriveImageDisplayUrl(
  url: string | null | undefined,
  size = 1200
): string {
  if (!url?.trim()) return "";
  const fileId = extractDriveFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}
