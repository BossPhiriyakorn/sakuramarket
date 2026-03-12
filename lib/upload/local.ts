import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOAD_BASE = "public/uploads";
const UPLOAD_URL_PREFIX = "uploads";

/**
 * เก็บไฟล์ลง public/uploads และคืน URL สำหรับแสดงในแอป
 * @param buffer เนื้อหาไฟล์
 * @param relativePath path แบบ userId/folder/filename (เช่น user123/shops/1234567-abc.jpg)
 */
export async function uploadToLocal(
  buffer: Buffer,
  relativePath: string
): Promise<string> {
  const dirPath = join(process.cwd(), UPLOAD_BASE, relativePath.split("/").slice(0, -1).join("/"));
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
  const filePath = join(process.cwd(), UPLOAD_BASE, relativePath);
  await writeFile(filePath, buffer);
  return `/${UPLOAD_URL_PREFIX}/${relativePath}`;
}
