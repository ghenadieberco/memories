/*
 * Video intake — FR-VIDEO-1..6, D23.
 *
 * THE SHAPE OF THIS FEATURE, AND WHY:
 *
 * Photos get a mandatory server-side pipeline (NFR-OPT): sharp resizes them,
 * re-encodes them, and the original is discarded (D5). None of that is possible
 * for video without a transcoder, and `sharp` is not one. Rather than add ffmpeg
 * to a single 1GB Fly machine that also serves requests, or take on a
 * transcoding vendor, D23 settles on **store what was uploaded**:
 *
 *   - accept only formats a browser can already play (MP4/H.264, WebM)
 *   - cap the file size hard, so "no transcode" cannot mean "no limit"
 *   - take the poster frame from the BROWSER, which had to decode the file to
 *     produce it — so a video that yields a poster is a video that plays
 *   - keep the bytes exactly as uploaded
 *
 * The last point is a real, deliberate divergence from D5: for video there is no
 * derived version, so the stored file IS the original. NFR-OPT stays an
 * image-only rule. Documented in the requirements rather than left implicit,
 * because "the original is always discarded" is otherwise a load-bearing claim
 * about this app's privacy story.
 *
 * WHAT THIS COSTS: video metadata is not stripped the way EXIF is. A file may
 * carry capture location and device details. FR-VIDEO-6 states that plainly to
 * the uploader instead of implying a guarantee the pipeline cannot make.
 */

/** D23 — well under the photo pipeline's headroom on a 1GB machine. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Four hours. A ceiling that rejects nonsense without rejecting a real event. */
export const MAX_VIDEO_DURATION_SECONDS = 4 * 60 * 60;

export type VideoFormat = {
  mimeType: "video/mp4" | "video/webm";
  extension: "mp4" | "webm";
};

/**
 * MP4 brands that mean "ordinary web-playable MP4".
 *
 * Deliberately does NOT include the HEIC/HEIF brands (`heic`, `heix`, `hevc`,
 * `hevx`, `mif1`, `msf1`) — those share the same ISO-BMFF `ftyp` box but belong
 * to the image pipeline, and an iPhone still photo must never be mistaken for a
 * video it would then fail to play.
 */
const MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "avc1",
  "M4V ",
  "M4VP",
  "mmp4",
  "dash",
  "qt  ", // Apple QuickTime writes .mov with an mp4-compatible H.264 payload
]);

/**
 * Identify a video from its own bytes.
 *
 * Same reasoning as the image sniffer: the browser's `file.type` is a hint from
 * the client and is not something to branch on when deciding how to handle
 * untrusted input. Returns null for anything that isn't a recognised container,
 * which sends the request on to the image pipeline.
 */
export function sniffVideoFormat(buffer: Buffer): VideoFormat | null {
  if (buffer.length < 16) return null;

  // Matroska/WebM: EBML magic. Both share it, and both play in a <video> tag.
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { mimeType: "video/webm", extension: "webm" };
  }

  // ISO-BMFF: 4-byte box size, then 'ftyp', then the major brand.
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (MP4_BRANDS.has(brand)) {
      return { mimeType: "video/mp4", extension: "mp4" };
    }
  }

  return null;
}

/** `0:07`, `3:42`, `1:02:09` — the badge on a video tile (FR-VIDEO-5). */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
