/**
 * `heic-convert` ships no type declarations. Minimal surface for what we use
 * (D17 — the JS fallback for HEIC, which stock sharp cannot decode).
 */
declare module "heic-convert" {
  type ConvertOptions = {
    buffer: Buffer;
    format: "JPEG" | "PNG";
    /** 0..1, JPEG only. */
    quality?: number;
  };

  function convert(options: ConvertOptions): Promise<ArrayBuffer>;

  export = convert;
}
