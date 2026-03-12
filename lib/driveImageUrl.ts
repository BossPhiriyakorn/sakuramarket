/**
 * แปลง URL รูปให้ใช้แสดงผลได้เสถียร:
 * - รองรับ URL Google Drive ได้หลายรูปแบบ
 * - ส่งผ่าน /api/proxy-image สำหรับโฮสต์ Google เพื่อลดปัญหา hotlink/CORS
 */
const GOOGLE_IMAGE_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "lh3.googleusercontent.com",
  "www.googleapis.com",
];

function normalizeLocalUploadPath(raw: string): string {
  if (raw.startsWith("/public/uploads/")) return "/uploads/" + raw.slice("/public/uploads/".length);
  if (raw.startsWith("public/uploads/")) return "/uploads/" + raw.slice("public/uploads/".length);
  if (raw.startsWith("uploads/")) return "/" + raw;
  return raw;
}

function isGoogleImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return GOOGLE_IMAGE_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

function extractDriveFileId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL | null = null;
  try {
    parsed = new URL(trimmed);
  } catch {
    parsed = null;
  }

  if (parsed) {
    const idFromQuery = parsed.searchParams.get("id");
    if (idFromQuery) return idFromQuery;

    const pathMatchers = [
      /\/file\/d\/([^/]+)/,
      /\/d\/([^/]+)/,
      /\/drive\/v3\/files\/([^/]+)/,
    ];
    for (const matcher of pathMatchers) {
      const m = parsed.pathname.match(matcher);
      if (m?.[1]) return m[1];
    }
  }

  const fallback =
    trimmed.match(/[?&]id=([^&]+)/) ||
    trimmed.match(/\/file\/d\/([^/?]+)/) ||
    trimmed.match(/\/d\/([^/?]+)/) ||
    trimmed.match(/\/drive\/v3\/files\/([^/?]+)/);

  return fallback?.[1] ?? null;
}

function toProxyUrl(url: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

export function getDriveImageDisplayUrl(
  url: string | null | undefined,
  _size = 1600
): string {
  if (!url?.trim()) return "";

  const normalized = normalizeLocalUploadPath(url.trim());
  if (normalized.startsWith("/")) return normalized;
  if (normalized.startsWith("data:") || normalized.startsWith("blob:")) return normalized;

  let parsed: URL | null = null;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  const host = parsed.hostname.toLowerCase();
  const driveId = extractDriveFileId(normalized);

  // URL แบบ Drive ต้องมี file id ถ้าไม่มีหรือดูเหมือน URL ตัด (เช่น .../uc?i) ไม่ใช้
  const looksLikeTruncatedDrive =
    isGoogleImageHost(host) &&
    !driveId &&
    (normalized.includes("/uc?i") || (normalized.includes("/uc?export") && !normalized.includes("id=")));
  if (looksLikeTruncatedDrive) return "";

  // canonical ลิงก์สำหรับไฟล์ Drive ที่เป็น public
  const directDriveUrl = driveId
    ? `https://drive.google.com/uc?export=view&id=${driveId}`
    : normalized;

  if (isGoogleImageHost(host) || driveId) {
    return toProxyUrl(directDriveUrl);
  }

  return normalized;
}
