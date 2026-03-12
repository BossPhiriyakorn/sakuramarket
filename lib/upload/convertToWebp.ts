/**
 * แปลงรูปเป็น WebP ก่อนอัปโหลด — ยกเว้น GIF (เก็บเป็น GIF เหมือนเดิม)
 * รองรับทุกรูปแบบรวม HEIC/HEIF จาก iPhone
 */

import sharp from "sharp";

const GIF_MIMES = new Set(["image/gif"]);
const HEIC_MIMES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
]);

export type ConvertResult = {
  buffer: Buffer;
  mimeType: string;
  ext: string;
};

const WEBP_QUALITY = 82;

function toNodeBuffer(value: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  return Buffer.from(value);
}

/**
 * แปลง buffer รูปเป็น WebP (หรือคงเป็น GIF ถ้าเป็น GIF)
 */
export async function convertToWebp(
  buffer: Buffer,
  mimeType: string
): Promise<ConvertResult> {
  const mime = (mimeType || "").toLowerCase();

  if (GIF_MIMES.has(mime)) {
    return { buffer, mimeType: "image/gif", ext: "gif" };
  }

  let inputBuffer = buffer;

  if (HEIC_MIMES.has(mime)) {
    const heicConvert = (await import("heic-convert")).default;
    const jpegResult = await heicConvert({
      buffer: buffer,
      format: "JPEG",
      quality: 0.9,
    });
    inputBuffer = toNodeBuffer(jpegResult as Buffer | ArrayBuffer | Uint8Array);
  }

  const webpBuffer = await sharp(inputBuffer, { failOnError: false })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return {
    buffer: webpBuffer,
    mimeType: "image/webp",
    ext: "webp",
  };
}
