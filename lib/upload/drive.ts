import { Readable } from "stream";
import { getDriveConfig } from "./config";
import { google } from "googleapis";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];
const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * หาโฟลเดอร์ตามชื่อใต้ parentId ถ้าไม่มีก็สร้าง
 */
async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  folderName: string
): Promise<string> {
  const escaped = folderName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and name='${escaped}' and mimeType='${FOLDER_MIME}'`;
  const list = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existing = list.data.files?.[0];
  if (existing?.id) return existing.id;
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      parents: [parentId],
      mimeType: FOLDER_MIME,
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = created.data.id;
  if (!id) throw new Error(`สร้างโฟลเดอร์ "${folderName}" ไม่สำเร็จ`);
  return id;
}

/**
 * อัปโหลดไฟล์ไป Google Drive แล้วคืน URL แบบ "Anyone with the link can view"
 * โครงสร้างใน Drive: โฟลเดอร์อัปโหลด / {userId} / {profile|shops|cms} / ไฟล์ — อ้างอิงผู้ใช้เป็นหลัก (ร้านผูกกับ userId)
 */
export async function uploadToDrive(
  buffer: Buffer,
  relativePath: string,
  mimeType: string
): Promise<string> {
  const config = getDriveConfig();
  if (!config) {
    throw new Error(
      "Google Drive ไม่ได้เปิดใช้หรือตั้งค่าไม่ครบ (UPLOAD_USE_GOOGLE_DRIVE, GOOGLE_DRIVE_CREDENTIALS_FILE, GOOGLE_DRIVE_FOLDER_ID)"
    );
  }

  let auth: InstanceType<typeof google.auth.OAuth2> | Awaited<ReturnType<typeof google.auth.GoogleAuth.prototype.getClient>>;
  if (config.credentials.type === "service_account") {
    const authClient = new google.auth.GoogleAuth({
      keyFile: config.credentials.keyFilePath,
      scopes: DRIVE_SCOPES,
    });
    auth = await authClient.getClient();
  } else {
    const oauth2 = new google.auth.OAuth2(
      config.credentials.clientId,
      config.credentials.clientSecret
    );
    oauth2.setCredentials({ refresh_token: config.credentials.refreshToken });
    auth = oauth2;
  }

  const drive = google.drive({ version: "v3", auth });
  let baseId = config.uploadsFolderId || config.folderId || "root";

  if (baseId !== "root") {
    try {
      const meta = await drive.files.get({
        fileId: baseId,
        fields: "id,mimeType",
        supportsAllDrives: true,
      });
      const mime = meta.data.mimeType;
      if (mime !== FOLDER_MIME) {
        throw new Error(
          `GOOGLE_DRIVE_UPLOADS_FOLDER_ID (หรือ GOOGLE_DRIVE_FOLDER_ID) ไม่ใช่โฟลเดอร์ — กรุณาใส่ไอดีโฟลเดอร์ใน Google Drive ที่แชร์ให้ Service Account (client_email ใน credentials.json) หรือใช้ "root" เพื่อเก็บที่ root ของ Drive`
        );
      }
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      const is404 = err?.code === 404 || (typeof err?.message === "string" && err.message.includes("404"));
      if (is404) {
        if (config.credentials.type === "service_account") {
          throw new Error(
            `เข้าไม่ถึงโฟลเดอร์ใน Google Drive (404): ${baseId}. หากใช้ Service Account ต้องใช้โฟลเดอร์ใน Shared Drive หรือโฟลเดอร์ที่แชร์ให้อีเมล service account แล้ว และต้องเรียก API แบบ supportsAllDrives`
          );
        }
        console.warn(
          `[Upload] โฟลเดอร์ใน .env (ไอดี: ${baseId}) เข้าไม่ถึง (404) — ใช้ root ของ Drive แทน`
        );
        baseId = "root";
      } else {
        throw e;
      }
    }
  }

  const parts = relativePath.split("/");
  const filename = parts.pop() || "file";
  const folderType = parts.pop() || "shops";
  const userId = parts.pop() || "unknown";

  const userFolderId = await getOrCreateFolder(drive, baseId, userId);
  const targetFolderId = await getOrCreateFolder(drive, userFolderId, folderType);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [targetFolderId],
    },
    media: {
      mimeType: mimeType || "application/octet-stream",
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink, webContentLink",
    supportsAllDrives: true,
  });

  const fileId = res.data.id;
  if (!fileId) throw new Error("อัปโหลด Drive สำเร็จแต่ไม่มี fileId");

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    supportsAllDrives: true,
  });

  const link = res.data.webContentLink || res.data.webViewLink;
  if (link && typeof link === "string") return link;

  return `https://drive.google.com/file/d/${fileId}/view`;
}
