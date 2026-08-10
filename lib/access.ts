import { and, eq } from "drizzle-orm";

import { memories, memoryShares, photos } from "@/db/schema";
import { db } from "@/lib/db";

/*
 * THE access helper. Every authenticated read or write of a memory or photo
 * goes through here (CLAUDE.md non-negotiable #1, plan §6).
 *
 * Never query a memory or photo by id alone anywhere else in the app: doing so
 * is how one user ends up seeing another user's photos, and it is the single
 * most likely way this product leaks private data.
 *
 * Guests arriving via a public link are NOT handled here — that path has no
 * user at all and lives in `getPublicMemory` below, which is deliberately the
 * only function in the codebase that reads a memory without a user id.
 */

export type AccessLevel = "none" | "viewer" | "contributor" | "owner";

/** Ranking so callers can compare levels without enumerating cases. */
const RANK: Record<AccessLevel, number> = {
  none: 0,
  viewer: 1,
  contributor: 2,
  owner: 3,
};

export class AccessDeniedError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/**
 * Resolve what `userId` may do with `memoryId`.
 *
 * A share only counts at status 'accepted' (D14) — a pending email invite or a
 * revoked membership grants nothing.
 */
export async function getMemoryAccess(
  userId: string,
  memoryId: string,
): Promise<AccessLevel> {
  const rows = await db
    .select({
      ownerId: memories.ownerId,
      permission: memoryShares.permission,
    })
    .from(memories)
    .leftJoin(
      memoryShares,
      and(
        eq(memoryShares.memoryId, memories.id),
        eq(memoryShares.userId, userId),
        eq(memoryShares.status, "accepted"),
      ),
    )
    .where(eq(memories.id, memoryId))
    .limit(1);

  const row = rows[0];
  if (!row) return "none";
  if (row.ownerId === userId) return "owner";
  if (row.permission === "contributor") return "contributor";
  if (row.permission === "viewer") return "viewer";
  return "none";
}

/**
 * Throw unless `userId` has at least `required` access.
 *
 * The error message is "Not found" for both a missing memory and a forbidden
 * one, on purpose: distinguishing them tells an attacker which memory ids
 * exist (NFR-SEC).
 */
export async function assertMemoryAccess(
  userId: string,
  memoryId: string,
  required: Exclude<AccessLevel, "none">,
): Promise<AccessLevel> {
  const level = await getMemoryAccess(userId, memoryId);
  if (RANK[level] < RANK[required]) throw new AccessDeniedError();
  return level;
}

/** View photos, comment, like (FR-SHARE-2). */
export const assertCanViewMemory = (userId: string, memoryId: string) =>
  assertMemoryAccess(userId, memoryId, "viewer");

/** Add photos (FR-SHARE-2 Contributor). */
export const assertCanContribute = (userId: string, memoryId: string) =>
  assertMemoryAccess(userId, memoryId, "contributor");

/** Edit title/date, delete the memory, manage sharing and the public link (FR-SHARE-5). */
export const assertOwnsMemory = (userId: string, memoryId: string) =>
  assertMemoryAccess(userId, memoryId, "owner");

/**
 * D10: a contributor may delete only photos they uploaded; the memory owner may
 * delete any. Returns the photo row so callers don't re-fetch it (they'd have
 * to bypass this helper to do so, which is exactly what we're preventing).
 */
export async function assertCanDeletePhoto(userId: string, photoId: string) {
  const rows = await db
    .select({
      photo: photos,
      ownerId: memories.ownerId,
    })
    .from(photos)
    .innerJoin(memories, eq(memories.id, photos.memoryId))
    .where(eq(photos.id, photoId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new AccessDeniedError();

  const isOwner = row.ownerId === userId;
  const isUploader = row.photo.uploadedBy === userId;
  if (!isOwner && !isUploader) throw new AccessDeniedError();

  return row.photo;
}

/**
 * The ONLY unauthenticated data path in the app (FR-SHARE-8/9, plan §2C).
 *
 * Selects strictly by public_token AND public_link_active, returns exactly one
 * memory, and never accepts a user id or a memory id. Revoking a link flips
 * `public_link_active`, which takes this to null immediately (FR-SHARE-10).
 *
 * Callers must treat the result as read-only: guests cannot upload, comment,
 * like, tag, or see anything else the owner has.
 */
export async function getPublicMemory(token: string) {
  if (!token) return null;

  const rows = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.publicToken, token), eq(memories.publicLinkActive, true)),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * D21 — the guest WRITE path. The only unauthenticated way to create data.
 *
 * Deliberately a separate function from `getPublicMemory`, not a flag on it.
 * Read access and write access to a public album are different privileges, and
 * a caller has to reach for this one by name to get the write privilege — no
 * boolean argument anyone could pass wrongly.
 *
 * Returns the memory only when ALL THREE hold:
 *   - the token matches
 *   - the link is active (revoking kills contributions too, FR-SHARE-10)
 *   - the owner explicitly opted in to guest contributions
 */
export async function getPublicMemoryForContribution(token: string) {
  if (!token) return null;

  const rows = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.publicToken, token),
        eq(memories.publicLinkActive, true),
        eq(memories.publicCanContribute, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
