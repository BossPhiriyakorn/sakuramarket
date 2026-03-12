export type UploadFolder = "profile" | "shops" | "cms";

type UploadApiResponse = {
  url?: string;
  error?: string;
};

/**
 * เรียก /api/upload แบบปลอดภัย:
 * - parse response ผ่าน text -> JSON (กันกรณีเซิร์ฟเวอร์ตอบ HTML)
 * - คืน URL ที่ใช้งานได้หรือ throw ข้อความที่อ่านง่าย
 */
export async function uploadImageFile(file: File, folder: UploadFolder): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: form,
    credentials: "include",
  });

  const text = await res.text();
  let payload: UploadApiResponse = {};

  if (text) {
    try {
      payload = JSON.parse(text) as UploadApiResponse;
    } catch {
      throw new Error(
        res.ok
          ? "อัปโหลดไม่สำเร็จ (เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ)"
          : `อัปโหลดไม่สำเร็จ — เซิร์ฟเวอร์อาจ error หรือไม่มี API /api/upload (HTTP ${res.status})`
      );
    }
  }

  if (!res.ok) {
    const apiError = typeof payload.error === "string" ? payload.error.trim() : "";
    throw new Error(apiError || `อัปโหลดไม่สำเร็จ (HTTP ${res.status})`);
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!url) {
    throw new Error("อัปโหลดสำเร็จแต่ไม่ได้รับ URL ไฟล์");
  }
  return url;
}
