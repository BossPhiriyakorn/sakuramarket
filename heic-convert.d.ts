declare module "heic-convert" {
  type HeicConvertOptions = {
    buffer: Buffer | ArrayBuffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  function heicConvert(options: HeicConvertOptions): Promise<Buffer | ArrayBuffer | Uint8Array>;

  export default heicConvert;
}
