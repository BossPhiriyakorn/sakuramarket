import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * การตั้งค่าอัปโหลดจาก .env
 * - UPLOAD_USE_GOOGLE_DRIVE: เปิด/ปิดการเก็บไฟล์ใน Google Drive
 * - Credentials อ่านจากไฟล์ JSON ที่ได้จาก Google (Service Account หรือ OAuth)
 * - ใน .env ใส่แค่ path ไฟล์ + ไอดีโฟลเดอร์หลักกับโฟลเดอร์ย่อย
 */

export function isGoogleDriveEnabled(): boolean {
  const v = process.env.UPLOAD_USE_GOOGLE_DRIVE;
  return v === "true" || v === "1";
}

export interface DriveConfigOAuth {
  type: "oauth2";
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface DriveConfigServiceAccount {
  type: "service_account";
  keyFilePath: string;
}

export type DriveCredentials = DriveConfigOAuth | DriveConfigServiceAccount;

export interface DriveConfig {
  credentials: DriveCredentials;
  /** โฟลเดอร์หลักใน Drive (ไอดี) */
  folderId: string;
  /** โฟลเดอร์ย่อยสำหรับอัปโหลด (ไอดี) — ถ้าว่างใช้ folderId */
  uploadsFolderId: string;
}

function loadCredentialsFromFile(filePath: string): DriveCredentials | null {
  const resolved = filePath.startsWith("/") || /^[A-Za-z]:/.test(filePath)
    ? filePath
    : resolve(process.cwd(), filePath);
  let raw: string;
  try {
    raw = readFileSync(resolved, "utf-8");
  } catch {
    return null;
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (data.type === "service_account") {
    return {
      type: "service_account",
      keyFilePath: resolved,
    };
  }
  const clientId = typeof data.client_id === "string" ? data.client_id.trim() : "";
  const clientSecret = typeof data.client_secret === "string" ? data.client_secret.trim() : "";
  const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token.trim() : "";
  if (clientId && clientSecret && refreshToken) {
    return { type: "oauth2", clientId, clientSecret, refreshToken };
  }
  return null;
}

export function getDriveConfig(): DriveConfig | null {
  if (!isGoogleDriveEnabled()) return null;
  const credentialsPath = process.env.GOOGLE_DRIVE_CREDENTIALS_FILE?.trim();
  if (!credentialsPath) return null;
  const credentials = loadCredentialsFromFile(credentialsPath);
  if (!credentials) return null;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || "root";
  const uploadsFolderId = process.env.GOOGLE_DRIVE_UPLOADS_FOLDER_ID?.trim() || folderId;
  return {
    credentials,
    folderId,
    uploadsFolderId,
  };
}
