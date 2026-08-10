import { downloadZip } from "client-zip";

import { formatMemoryDate } from "@/lib/format";
import type { MemoryPhoto } from "@/lib/memories";

/*
 * Downloading photos and videos — FR-DL-1..7.
 *
 * BROWSER-ONLY, AND THAT IS THE POINT (D24).
 *
 * "Never proxy image bytes through the app" is a non-negotiable, and a zip has
 * to be assembled somewhere. Assembling it here means every byte still travels
 * Tigris -> browser exactly as it does when a photo is displayed; the app serves
 * no bytes, spends no egress, and gains no new route.
 *
 * It also means downloading introduces NO NEW ACCESS PATH. This module never
 * takes an id and never asks the server for anything — it is handed the
 * `MemoryPhoto[]` that the page already rendered, which the scoped access
 * helper (or `getPublicMemory` for a guest) already authorised. If you can't see
 * it, it isn't in the array, so you can't download it.
 *
 * THE ONE THING THIS NEEDS FROM OUTSIDE: the storage bucket must send CORS
 * headers, or `fetch` cannot read the bytes it is allowed to display. Run
 * `npm run storage:cors` once per bucket — see scripts/set-bucket-cors.ts.
 *
 * WHAT IS DOWNLOADED (FR-DL-6): the stored asset. For a photo that is the
 * optimized WebP, because D5 discarded the camera original at upload — there is
 * no other file to hand back, and the copy must never imply there is. For a
 * video it is the file exactly as uploaded, since D23 does not transcode.
 */

/**
 * Ceilings (FR-DL-7). The archive is built in memory before it is saved, so
 * these are the difference between a slow download and a dead browser tab —
 * particularly on a phone, and particularly now that a single item can be a
 * 100 MB video.
 */
export const MAX_DOWNLOAD_ITEMS = 300;
export const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;

export class DownloadTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DownloadTooLargeError";
  }
}

/** Characters that are trouble in a filename on some OS or archive tool. */
const UNSAFE = /[^A-Za-z0-9 ._-]+/g;

function sanitize(value: string, max = 60): string {
  const cleaned = value.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, max).trim();
}

/**
 * The file extension to save an item under.
 *
 * Taken from the stored mime type rather than the uploaded filename: an iPhone
 * HEIC arrives as `IMG_0042.HEIC` but leaves as WebP, and saving that byte
 * stream under `.HEIC` would produce a file the OS refuses to open.
 */
export function extensionFor(photo: MemoryPhoto): string {
  switch (photo.mimeType) {
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    default: {
      const guess = photo.mimeType.split("/")[1]?.replace(UNSAFE, "");
      return guess && guess.length <= 5 ? guess : "bin";
    }
  }
}

/** The uploaded name, stripped of its old extension and made safe. */
function baseNameOf(photo: MemoryPhoto): string {
  if (!photo.originalFilename) return "";
  return sanitize(photo.originalFilename.replace(/\.[A-Za-z0-9]{1,8}$/, ""));
}

/** Name for a single saved item (FR-DL-1). */
export function fileNameFor(photo: MemoryPhoto): string {
  const base = baseNameOf(photo);
  const fallback = photo.mediaType === "video" ? "video" : "photo";
  return `${base || fallback}.${extensionFor(photo)}`;
}

/**
 * Name for an item inside an archive (FR-DL-4).
 *
 * The position prefix is not decoration: it preserves the memory's display
 * order (FR-PHOTO-7) inside a zip, which most extractors then list
 * alphabetically, and it guarantees uniqueness when two phones both uploaded an
 * `IMG_0001`. Zip entries that collide are how an archive silently loses files.
 */
export function entryNameFor(photo: MemoryPhoto, index: number): string {
  const position = String(index + 1).padStart(3, "0");
  const base = baseNameOf(photo);
  return base
    ? `${position} - ${base}.${extensionFor(photo)}`
    : `${position}.${extensionFor(photo)}`;
}

/** `Beach Trip - (14 Jul 2026).zip` — mirrors the FR-MEM-2 label. */
export function archiveNameFor(title: string, memoryDate: string): string {
  const safeTitle = sanitize(title, 80) || "Memory";
  return `${safeTitle} - (${formatMemoryDate(memoryDate)}).zip`;
}

/**
 * Refuse a selection that is too big to assemble, BEFORE fetching anything
 * (FR-DL-7).
 *
 * `sizeBytes` is null only for rows written before it was recorded; those are
 * counted at zero rather than blocking the download, so an old memory stays
 * downloadable and the ceiling stays approximate rather than absent.
 */
export function assertWithinLimits(photos: MemoryPhoto[]): void {
  if (photos.length > MAX_DOWNLOAD_ITEMS) {
    throw new DownloadTooLargeError(
      `That's over ${MAX_DOWNLOAD_ITEMS} items. Select fewer and download them in batches.`,
    );
  }

  const total = photos.reduce((sum, photo) => sum + (photo.sizeBytes ?? 0), 0);
  if (total > MAX_DOWNLOAD_BYTES) {
    const gb = (total / 1024 / 1024 / 1024).toFixed(1);
    throw new DownloadTooLargeError(
      `That's about ${gb} GB. Select fewer and download them in batches.`,
    );
  }
}

/** Hand a finished blob to the browser's downloader and clean up after it. */
function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the save in some browsers; one turn of the
  // event loop is enough for the download to have taken its own reference.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * A fetch that does not trust the browser's HTTP cache, and whose failure says
 * something useful.
 *
 * THE RETRY IS A FIX, NOT PADDING. The bucket varies its response by `Origin` —
 * a CORS request is answered with `Access-Control-Allow-Origin`, a plain one is
 * not — but it does not send `Vary: Origin`, and objects are stored
 * `immutable, max-age=1y`. The HTTP cache is not keyed on request mode, so the
 * moment an <img> displays a photo the browser stores a copy carrying no CORS
 * header, and every later `fetch` of that URL is handed that copy and fails the
 * CORS check. Displaying worked and downloading did not — and because the entry
 * is immutable, it stayed broken for a year. The viewer's Download button hit
 * this every single time: it sits next to an <img> showing that exact URL.
 *
 * `cache: "reload"` skips the cache and goes to the network, where the response
 * does carry the header, and it rewrites the poisoned entry on the way through
 * so the plain first attempt starts working again afterwards.
 *
 * If both attempts fail the cause is a real one — CORS genuinely unset on the
 * bucket (`npm run storage:cors`), a missing object, or no network — so the
 * console gets the reason and the user gets a sentence they can act on.
 */
async function fetchAsset(url: string): Promise<Response> {
  let cause: unknown;

  for (const init of [undefined, { cache: "reload" } as const]) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      cause ??= new Error(`HTTP ${response.status} ${response.statusText}`);
    } catch (error) {
      cause ??= error;
    }
  }

  console.error(
    `[download] could not fetch ${url} — if this is a CORS failure, check the ` +
      "bucket's rules with `npm run storage:cors`.",
    cause,
  );
  throw new Error("We couldn't reach those files. Try again in a moment.");
}

/** FR-DL-1 — save one photo or video, as stored, no archive. */
export async function downloadSingle(photo: MemoryPhoto): Promise<void> {
  const response = await fetchAsset(photo.url);
  save(await response.blob(), fileNameFor(photo));
}

/**
 * FR-DL-2/3 — save several items, or a whole memory, as one `.zip`.
 *
 * Items are fetched one at a time rather than all at once: a memory can be
 * hundreds of files, and firing hundreds of parallel requests is how a browser
 * starts dropping them. Sequential also makes `onProgress` mean something.
 *
 * Entries are streamed into the archive as they arrive. `client-zip` stores
 * without compressing, which is the right trade here anyway: WebP, MP4 and WebM
 * are already compressed, so deflating them would spend real CPU to save
 * approximately nothing.
 */
export async function downloadMany(
  photos: MemoryPhoto[],
  archiveName: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  assertWithinLimits(photos);

  if (photos.length === 0) return;
  if (photos.length === 1) {
    onProgress?.(0, 1);
    await downloadSingle(photos[0]);
    onProgress?.(1, 1);
    return;
  }

  const total = photos.length;
  onProgress?.(0, total);

  async function* entries() {
    for (const [index, photo] of photos.entries()) {
      const response = await fetchAsset(photo.url);
      yield { name: entryNameFor(photo, index), input: response };
      onProgress?.(index + 1, total);
    }
  }

  const blob = await downloadZip(entries()).blob();
  save(blob, archiveName);
}
