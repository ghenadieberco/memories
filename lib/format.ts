/*
 * Display formatting.
 *
 * FR-MEM-2: a memory is labelled `Title - (Formatted Date)`, e.g.
 * `Beach Trip - (14 Jul 2026)`. The date renders in orange as a deliberate
 * accent (style guide §3).
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format a `date` column value (`YYYY-MM-DD`) as `14 Jul 2026`.
 *
 * Parsed from the string parts rather than via `new Date(value)` on purpose:
 * `new Date("2026-07-14")` is midnight **UTC**, so formatting it in a timezone
 * behind UTC renders the previous day. A memory dated the 14th must never show
 * as the 13th because of where the viewer happens to be.
 */
export function formatMemoryDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName} ${year}`;
}

/** Today as `YYYY-MM-DD` in the viewer's own timezone (D2 — date defaults to today). */
export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** "1 photo" / "12 photos" — FR-MEM-8. */
export function photoCountLabel(count: number): string {
  return count === 1 ? "1 photo" : `${count} photos`;
}

/** "1 video" / "3 videos" — FR-VIDEO-4. */
export function videoCountLabel(count: number): string {
  return count === 1 ? "1 video" : `${count} videos`;
}

/**
 * What a memory holds — FR-MEM-8 extended for video (FR-VIDEO-4).
 *
 * "9 photos · 3 videos" when it has both, and just the one that applies when it
 * doesn't. A memory of nothing but video must never be described as photos, and
 * a memory with no video must not gain a "0 videos" that reads as a reproach.
 * An empty memory keeps saying "0 photos", which is what it said before video
 * existed.
 */
export function mediaCountLabel(photoCount: number, videoCount: number): string {
  if (videoCount === 0) return photoCountLabel(photoCount);
  if (photoCount === 0) return videoCountLabel(videoCount);
  return `${photoCountLabel(photoCount)} · ${videoCountLabel(videoCount)}`;
}

/**
 * Bytes as a short human string: "2.4 GB", "812 MB", "0 bytes" (FR-QUOTA-7).
 *
 * Binary units (1024) because that is what the quota is defined in — 20 GB
 * there means 21,474,836,480 bytes, so a meter reading "20 GB" when full is
 * honest.
 *
 * Lives here rather than beside the quota logic it serves because it is needed
 * in the browser (the storage meter inside the header menu) and `storage-quota`
 * reaches for the database on import. A pure formatter is the part that can
 * cross that line; nothing else in this file imports anything either.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} bytes`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  // One decimal below 10 ("2.4 GB"), none above it ("812 MB") — enough
  // precision to watch a quota fill without reading like a disk utility.
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
