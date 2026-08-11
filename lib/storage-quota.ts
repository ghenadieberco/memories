import { and, eq, sql } from "drizzle-orm";

import { DEFAULT_STORAGE_QUOTA_BYTES, memories, photos, profiles } from "@/db/schema";
import { db } from "@/lib/db";

/*
 * Per-user storage quota (FR-QUOTA-*, D26; plan §7c).
 *
 * THE RULE: a quota is charged to the MEMORY OWNER, never the uploader.
 *
 * That is the whole design, and it is not the obvious reading of "20 GB per
 * user". It is the right one because two paths let somebody else spend an
 * owner's storage: a contributor (FR-SHARE-3), and a guest on a public link
 * (D21/D25). Guest rows have `uploaded_by = NULL` — there is no user to charge
 * — so an uploader-charged quota would leave the single unauthenticated write
 * path as the only one with no ceiling at all. It also matches how the bill
 * arrives: Tigris invoices for bytes in the bucket, and the owner is the one
 * who chose to open the link.
 *
 * THE OTHER RULE: usage is derived on read, never counted. There is no
 * `bytes_used` column, because every delete path — photo, bulk, whole memory,
 * failed-upload cleanup, a manual fix in psql — would have to remember to
 * decrement it, and one of them eventually wouldn't.
 */

export { DEFAULT_STORAGE_QUOTA_BYTES };

/** Fraction of the quota at which the meter starts warning (FR-QUOTA-8). */
export const QUOTA_WARNING_RATIO = 0.8;

export type StorageUsage = {
  usedBytes: number;
  quotaBytes: number;
  /** Never negative: a user over an lowered quota has 0 left, not -3 GB. */
  remainingBytes: number;
  /** 0–1, clamped. Guards against a 0-byte quota dividing by zero. */
  ratio: number;
  isNearFull: boolean;
  isFull: boolean;
};

/**
 * What a user's owned memories currently occupy, and what they are allowed.
 *
 * Counts `optimized_size_bytes + thumbnail_size_bytes` because both objects are
 * really in the bucket (FR-QUOTA-3) — the thumbnail is a measured 6.6% on top,
 * small but not nothing. `original_size_bytes` is deliberately absent — D5
 * discards the original, so charging for it would bill for bytes that no longer
 * exist.
 *
 * Only `status = 'ready'` rows count: an `uploading` or `failed` row has no
 * settled bytes to charge for.
 */
export async function getStorageUsage(userId: string): Promise<StorageUsage> {
  const [usageRow, profileRow] = await Promise.all([
    db
      .select({
        used: sql<string>`coalesce(sum(
          coalesce(${photos.optimizedSizeBytes}, 0)
          + coalesce(${photos.thumbnailSizeBytes}, 0)
        ), 0)`,
      })
      .from(photos)
      .innerJoin(memories, eq(memories.id, photos.memoryId))
      .where(and(eq(memories.ownerId, userId), eq(photos.status, "ready"))),
    db
      .select({ quota: profiles.storageQuotaBytes })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1),
  ]);

  // `sum()` of a bigint comes back as a string from pg — it can exceed the
  // safe-integer range in principle. At quota scale it never does, but parse it
  // explicitly rather than letting a string reach the arithmetic below.
  const usedBytes = Number(usageRow[0]?.used ?? 0);
  const quotaBytes = profileRow[0]?.quota ?? DEFAULT_STORAGE_QUOTA_BYTES;

  return summarize(usedBytes, quotaBytes);
}

function summarize(usedBytes: number, quotaBytes: number): StorageUsage {
  const remainingBytes = Math.max(0, quotaBytes - usedBytes);
  const ratio = quotaBytes > 0 ? Math.min(1, usedBytes / quotaBytes) : 1;

  return {
    usedBytes,
    quotaBytes,
    remainingBytes,
    ratio,
    isNearFull: ratio >= QUOTA_WARNING_RATIO,
    isFull: usedBytes >= quotaBytes,
  };
}

/**
 * Thrown when an upload would take the memory's owner over quota.
 *
 * Carries the figures so the authenticated path can name the remaining space
 * (FR-QUOTA-4) — but the guest path must NOT use them (FR-QUOTA-6): a guest can
 * neither see nor fix the owner's storage, and the owner's usage is not a
 * stranger's business. `guestMessage` is the safe one.
 */
export class StorageQuotaExceededError extends Error {
  readonly usage: StorageUsage;
  readonly incomingBytes: number;

  constructor(usage: StorageUsage, incomingBytes: number) {
    super(
      `This upload needs ${formatBytes(incomingBytes)} but only ` +
        `${formatBytes(usage.remainingBytes)} of your ` +
        `${formatBytes(usage.quotaBytes)} is free. Delete something, or upload fewer files.`,
    );
    this.name = "StorageQuotaExceededError";
    this.usage = usage;
    this.incomingBytes = incomingBytes;
  }

  /** Discloses nothing about the owner's account (FR-QUOTA-6). */
  get guestMessage(): string {
    return "This memory can't accept more uploads right now — it's out of storage space. Let the owner know.";
  }
}

/**
 * The owner a memory's storage is charged to (FR-QUOTA-2).
 *
 * Selects a memory by id alone, which the access rules otherwise forbid — so
 * call it ONLY after the caller has been authorised (`assertCanContribute`, or
 * `getPublicMemoryForContribution` on the guest path). It returns an id and
 * nothing else, so it cannot leak memory contents even if that were ignored.
 */
export async function getMemoryOwnerId(memoryId: string): Promise<string | null> {
  const rows = await db
    .select({ ownerId: memories.ownerId })
    .from(memories)
    .where(eq(memories.id, memoryId))
    .limit(1);

  return rows[0]?.ownerId ?? null;
}

/**
 * Throw if `incomingBytes` would push this usage past the quota (FR-QUOTA-4).
 *
 * Pure, and separate from the query, so the upload route can read usage once
 * and check it twice: cheaply up-front (is the owner already full? then don't
 * spend sharp on an image we're going to refuse) and again with the real stored
 * size once processing has produced it — both still BEFORE the storage PUT, so
 * a refused upload never leaves bytes in the bucket.
 *
 * ⚠️ Deliberately racy. Two concurrent uploads can both read usage below the
 * line and both pass, overshooting by at most one file (25 MB, or 100 MB for
 * video) against a 20 GB quota. The fix would be locking the owner's entire
 * photo set for the duration of an upload, which costs far more than the ~0.5%
 * it recovers. Do not add a lock here.
 */
export function checkQuota(usage: StorageUsage, incomingBytes: number): void {
  if (usage.usedBytes + incomingBytes > usage.quotaBytes) {
    throw new StorageQuotaExceededError(usage, incomingBytes);
  }
}

/**
 * Read-then-check in one call, for write paths that already know their size.
 *
 * The upload route uses `getStorageUsage` + `checkQuota` instead because it
 * needs the two-stage check above; anything simpler should use this.
 */
export async function assertQuota(
  ownerId: string,
  incomingBytes: number,
): Promise<StorageUsage> {
  const usage = await getStorageUsage(ownerId);
  checkQuota(usage, incomingBytes);
  return usage;
}

/**
 * Bytes as a short human string: "2.4 GB", "812 MB", "0 bytes".
 *
 * Binary units (1024) because that is what the quota is defined in — 20 GB here
 * means 21,474,836,480 bytes, so a meter reading "20 GB" when full is honest.
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
