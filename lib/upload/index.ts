import { isGoogleDriveEnabled } from "./config";
import { uploadToDrive } from "./drive";

export { isGoogleDriveEnabled, getDriveConfig } from "./config";
export type { DriveConfig } from "./config";

export interface UploadOptions {
  buffer: Buffer;
  relativePath: string;
  mimeType: string;
}

/**
 * อัปโหลดไฟล์ไป Google Drive เท่านั้น — ไม่เก็บในโปรเจค (local)
 * ต้องตั้งค่า UPLOAD_USE_GOOGLE_DRIVE=true และค่า Drive ครบใน .env
 */
export async function uploadFile(options: UploadOptions): Promise<string> {
  const { buffer, relativePath, mimeType } = options;
  if (!isGoogleDriveEnabled()) {
    throw new Error(
      "ต้องเปิดใช้ Google Drive สำหรับอัปโหลด (UPLOAD_USE_GOOGLE_DRIVE=true และตั้งค่า Drive ครบใน .env)"
    );
  }
  return uploadToDrive(buffer, relativePath, mimeType);
}
