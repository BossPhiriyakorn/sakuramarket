/**
 * แปลงรูปเป็น WebP ก่อนอัปโหลด — ยกเว้น GIF (เก็บเป็น GIF เหมือนเดิม)
 * รองรับทุกรูปแบบรวม HEIC/HEIF จาก iPhone
 *
 * หมายเหตุ:
 * บาง runtime (เช่น linux-arm64 บางเครื่อง) อาจโหลด sharp ไม่ได้
 * กรณีนี้จะ fallback เก็บไฟล์ต้นฉบับแทน เพื่อไม่ให้ API /api/upload ล่มทั้งเส้น
 */

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

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/heic-sequence": "heic",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "image/avif": "avif",
  "image/tiff": "tiff",
  "image/tif": "tif",
  "image/svg+xml": "svg",
};

function toNodeBuffer(value: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  return Buffer.from(value);
}

function inferExt(mimeType: string): string {
  const mime = (mimeType || "").toLowerCase();
  return EXT_BY_MIME[mime] || "bin";
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
  let sourceMime = mime || "application/octet-stream";

  if (HEIC_MIMES.has(mime)) {
    try {
      const heicConvert = (await import("heic-convert")).default;
      const jpegResult = await heicConvert({
        buffer: buffer,
        format: "JPEG",
        quality: 0.9,
      });
      inputBuffer = toNodeBuffer(jpegResult as Buffer | ArrayBuffer | Uint8Array);
      sourceMime = "image/jpeg";
    } catch (error) {
      console.warn("[upload] HEIC conversion failed, using original file:", error);
      return { buffer, mimeType: sourceMime, ext: inferExt(sourceMime) };
    }
  }

  try {
    const sharpModule = await import("sharp");
    const sharpFactory = (sharpModule.default ?? sharpModule) as unknown as (
      input: Buffer,
      options?: { failOnError?: boolean }
    ) => { webp: (options?: { quality?: number }) => { toBuffer: () => Promise<Buffer> } };

    const webpBuffer = await sharpFactory(inputBuffer, { failOnError: false })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    return {
      buffer: webpBuffer,
      mimeType: "image/webp",
      ext: "webp",
    };
  } catch (error) {
    console.warn("[upload] sharp unavailable, using original file:", error);
    return {
      buffer: inputBuffer,
      mimeType: sourceMime,
      ext: inferExt(sourceMime),
    };
  }
}
