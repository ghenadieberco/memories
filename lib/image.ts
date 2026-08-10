import exifr from "exifr";
import sharp, { type OutputInfo } from "sharp";

/*
 * Image pipeline — NFR-OPT / plan §7. Mandatory and not user-configurable
 * (FR-PROF-4): every upload goes through this, there is no bypass.
 *
 * Order matters:
 *   1. detect the real format from magic bytes, not the client's mime type
 *   2. read EXIF `taken_at` from the ORIGINAL buffer, before anything rewrites it
 *   3. HEIC -> JPEG via heic-convert (D17), since stock sharp decodes AVIF but
 *      not HEIC
 *   4. auto-rotate, resize to longest edge ~2048, WebP q80
 *   5. thumbnail at longest edge ~400
 *   6. drop the original (D5)
 *
 * sharp strips metadata by default — we never call .withMetadata() — so GPS and
 * everything else is gone from the stored files (NFR-OPT, NFR-PRIV).
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // D6
const LONGEST_EDGE = 2048;
const THUMB_EDGE = 400;
const WEBP_QUALITY = 80;

export type ProcessedImage = {
  optimized: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  /** EXIF capture time, extracted before metadata was stripped. */
  takenAt: Date | null;
  mimeType: "image/webp";
  optimizedSizeBytes: number;
  originalSizeBytes: number;
};

export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedImageError";
  }
}

/**
 * Identify the format from the file's own bytes.
 *
 * Browsers routinely send `image/heic` as an empty string or
 * `application/octet-stream`, and a client-supplied mime type is not something
 * to trust for a branch that decides how we decode untrusted input.
 */
function sniffFormat(buffer: Buffer): "jpeg" | "png" | "webp" | "heic" | null {
  if (buffer.length < 16) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }

  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  // ISO-BMFF: 4-byte size, then 'ftyp', then a brand. HEIC brands are heic/heix/
  // hevc/hevx/mif1/msf1; mif1 is also used by AVIF, but sharp handles AVIF
  // natively so treating it as HEIC only costs a redundant conversion attempt.
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return "heic";
    }
  }

  return null;
}

/**
 * EXIF capture time (FR-PHOTO-7 sort order, NFR-OPT).
 *
 * Read from the original bytes: HEIC->JPEG conversion drops EXIF entirely, so
 * doing this after conversion would silently lose `taken_at` for every iPhone
 * photo — the exact case the field matters most for.
 */
async function readTakenAt(buffer: Buffer): Promise<Date | null> {
  try {
    const exif = await exifr.parse(buffer, {
      pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"],
    });
    const value = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    return null;
  } catch {
    // A photo with unreadable EXIF is normal, not an error — fall back to
    // upload time at the call site.
    return null;
  }
}

/**
 * Turn a client-captured video poster frame into a stored thumbnail
 * (FR-VIDEO-3).
 *
 * The frame arrives as a canvas export from the uploader's browser, which is
 * also where the only decode of the video happens (D23). Two things follow:
 *
 *   - it is untrusted input like any other upload, so it goes through sharp,
 *     which rejects anything that isn't really an image;
 *   - its pixel dimensions ARE the video's dimensions, so the aspect ratio the
 *     grid and viewer need comes back from here for free rather than from a
 *     number the client could simply assert.
 *
 * Only the ~400px thumbnail is kept. A video has no "optimized full-size
 * image" to pair with it — the video file itself fills that role.
 */
export async function processPoster(input: Buffer): Promise<{
  thumbnail: Buffer;
  width: number;
  height: number;
  mimeType: "image/webp";
}> {
  if (input.length === 0) {
    throw new UnsupportedImageError("We couldn't read that video's first frame.");
  }
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new UnsupportedImageError("That video's preview frame is too large.");
  }

  try {
    const source = sharp(input, { failOn: "none" });
    const { width = 0, height = 0 } = await source.metadata();

    const thumbnail = await source
      .clone()
      .resize({
        width: THUMB_EDGE,
        height: THUMB_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    return { thumbnail, width, height, mimeType: "image/webp" };
  } catch (error) {
    if (error instanceof UnsupportedImageError) throw error;
    throw new UnsupportedImageError("We couldn't read that video's first frame.");
  }
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const originalSizeBytes = input.length;

  if (originalSizeBytes === 0) {
    throw new UnsupportedImageError("That file is empty.");
  }
  if (originalSizeBytes > MAX_UPLOAD_BYTES) {
    throw new UnsupportedImageError("Photos need to be under 25 MB.");
  }

  const format = sniffFormat(input);
  if (!format) {
    throw new UnsupportedImageError(
      "That file isn't a JPEG, PNG, WebP, or HEIC image.",
    );
  }

  const takenAt = await readTakenAt(input);

  let decodable = input;
  if (format === "heic") {
    try {
      const convert = (await import("heic-convert")).default;
      const jpeg = await convert({ buffer: input, format: "JPEG", quality: 0.92 });
      decodable = Buffer.from(jpeg);
    } catch {
      // mif1 also covers AVIF, which sharp reads directly — let sharp try the
      // original before giving up.
      decodable = input;
    }
  }

  const pipeline = sharp(decodable, { failOn: "none" })
    // EXIF orientation must be applied before resizing, or every portrait
    // photo from a phone lands sideways.
    .rotate();

  let optimized: Buffer;
  let info: OutputInfo;
  try {
    const result = await pipeline
      .clone()
      .resize({
        width: LONGEST_EDGE,
        height: LONGEST_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    optimized = result.data;
    info = result.info;
  } catch {
    throw new UnsupportedImageError("We couldn't read that image.");
  }

  const thumbnail = await pipeline
    .clone()
    .resize({
      width: THUMB_EDGE,
      height: THUMB_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return {
    optimized,
    thumbnail,
    width: info.width,
    height: info.height,
    takenAt,
    mimeType: "image/webp",
    optimizedSizeBytes: optimized.length,
    originalSizeBytes,
  };
}
