import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, getAdminCookieName, requireAdminPayload, verifyToken } from "@/lib/auth";
import { uploadFile } from "@/lib/upload";
import { convertToWebp } from "@/lib/upload/convertToWebp";

/** ขนาดไฟล์สูงสุดก่อนแปลงเป็น WebP (5GB) — ถ้าเซิร์ฟเวอร์หน่วยความจำจำกัด อาจลดค่าลงใน .env */
const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

/** รองรับรูปภาพทุกรูปแบบทุกแพลตฟอร์ม รวมไฟล์จาก iPhone (HEIC/HEIF) และรูปแบบอื่นๆ */
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/pjpeg",
  "image/jpg",
  "image/png",
  "image/x-png",
  "image/apng",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/bmp",
  "image/x-ms-bmp",
  "image/avif",
  "image/tiff",
  "image/tif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/jp2",
  "image/jpx",
  "image/jpm",
  "image/vnd.ms-photo",
  "image/svg+xml",
] as const;

const ALLOWED_MIME_SET = new Set(
  ALLOWED_MIME_TYPES.map((t) => t.toLowerCase())
);

/** นามสกุลที่อนุญาต — iPhone/Android บางเครื่องส่ง type ว่าง จึงเช็คจากนามสกุลด้วย */
const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp", "gif",
  "heic", "heif", "hif",
  "bmp", "avif", "tiff", "tif", "ico",
  "jp2", "jpx", "jpf", "jpm",
  "apng", "svg",
] as const;

/** โฟลเดอร์ย่อยในแต่ละ user: profile = โปรไฟล์, shops = ร้านค้า/ตั้งค่าร้าน, cms = แอดมิน */
const ALLOWED_FOLDERS = ["profile", "shops", "cms"] as const;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userToken = cookieStore.get(getAuthCookieName())?.value;
    const adminToken = cookieStore.get(getAdminCookieName())?.value;

    const formData = await request.formData();
    const file = formData.get("file");
    const folderRaw = formData.get("folder");
    const folder = (typeof folderRaw === "string" && ALLOWED_FOLDERS.includes(folderRaw as typeof ALLOWED_FOLDERS[number]))
      ? (folderRaw as typeof ALLOWED_FOLDERS[number])
      : "shops";

    /**
     * แยก identity ตาม folder เพื่อป้องกันการปนกันของ session:
     *  - "cms"               → ต้องการ admin token เท่านั้น (ไม่ใช้ user token)
     *  - "shops" / "profile" → ต้องการ user token เท่านั้น (ไม่ใช้ admin token)
     *
     * ก่อนหน้านี้ admin cookie ถูกเช็คก่อน ทำให้เมื่อ developer มีทั้ง admin
     * session และ user session พร้อมกัน การอัปโหลดจาก register-shop จะใช้ identity
     * ของ admin แทน user → ไฟล์ไปผิดโฟลเดอร์
     */
    let userId: string;

    if (folder === "cms") {
      const adminPayload = await requireAdminPayload(adminToken);
      if (!adminPayload?.sub) {
        return NextResponse.json(
          { error: "เฉพาะแอดมินเท่านั้นที่อัปโหลดในโฟลเดอร์ cms ได้" },
          { status: 403 }
        );
      }
      userId = adminPayload.sub;
    } else {
      // "shops" หรือ "profile" — ใช้ user token เท่านั้น ไม่ยุ่งกับ admin cookie
      const userPayload = await verifyToken(userToken ?? "");
      if (!userPayload?.sub) {
        return NextResponse.json(
          { error: "กรุณาเข้าสู่ระบบก่อนอัปโหลด" },
          { status: 401 }
        );
      }
      userId = userPayload.sub;
    }

    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "ไม่มีไฟล์หรือฟิลด์ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase()?.replace(/^\./, "") || "";
    const mimeLower = (file.type || "").toLowerCase();
    const mimeOk = mimeLower && ALLOWED_MIME_SET.has(mimeLower);
    const extOk = ext && (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
    if (!mimeOk && !extOk) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP, GIF, HEIC/HEIF จาก iPhone, BMP, AVIF, TIFF, ICO, SVG, JP2 ฯลฯ)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `ขนาดไฟล์เกิน ${MAX_SIZE / (1024 * 1024 * 1024)}GB` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = (file.type || "image/jpeg").toLowerCase();

    const { buffer: outBuffer, mimeType: outMime, ext: outExt } = await convertToWebp(buffer, mimeType);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${outExt}`;
    const relativePath = `${safeUserId}/${folder}/${filename}`;

    const url = await uploadFile({
      buffer: outBuffer,
      relativePath,
      mimeType: outMime,
    });

    if (typeof url !== "string" || !url.trim()) {
      console.error("[Upload] Drive returned empty URL");
      return NextResponse.json(
        { error: "อัปโหลดไม่สำเร็จ (ไม่ได้รับ URL จาก Drive)" },
        { status: 500 }
      );
    }
    return NextResponse.json({ url: url.trim() });
  } catch (err) {
    console.error("Upload error:", err);
    const message = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
    const isConfigError =
      typeof message === "string" &&
      (message.includes("โฟลเดอร์") || message.includes("Google Drive") || message.includes("GOOGLE_DRIVE"));
    return NextResponse.json(
      { error: message },
      { status: isConfigError ? 400 : 500 }
    );
  }
}
