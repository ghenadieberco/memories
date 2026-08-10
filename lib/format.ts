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
