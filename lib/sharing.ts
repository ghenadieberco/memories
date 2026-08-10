import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { memories, memoryShares, photos, profiles } from "@/db/schema";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage";
import type { MemoryCard } from "@/lib/memories";

/*
 * Sharing reads (FR-SHARE-1..6).
 *
 * Membership only counts at status 'accepted' (D14) — the same rule
 * lib/access.ts enforces for authorization. A pending email invite or a revoked
 * membership grants nothing anywhere.
 */

export type ShareMember = {
  id: string;
  userId: string | null;
  displayName: string;
  email: string | null;
  permission: "viewer" | "contributor";
  status: "pending" | "accepted" | "revoked";
};

/** FR-SHARE-3 — memories other people have shared with this user. */
export async function listSharedMemories(userId: string): Promise<
  (MemoryCard & { sharedBy: string })[]
> {
  const rows = await db
    .select({
      id: memories.id,
      title: memories.title,
      memoryDate: memories.memoryDate,
      coverSource: memories.coverSource,
      coverThumbnailKey: memories.coverThumbnailKey,
      sharedBy: profiles.displayName,
      photoCount: sql<number>`(select count(*)::int from photos p where p.memory_id = ${memories.id})`,
      coverPhotoThumbKey: sql<
        string | null
      >`(select p.thumbnail_key from photos p where p.id = ${memories.coverPhotoId})`,
      latestThumbKey: sql<string | null>`(
        select p.thumbnail_key from photos p
        where p.memory_id = ${memories.id}
        order by coalesce(p.taken_at, p.created_at) desc
        limit 1
      )`,
    })
    .from(memoryShares)
    .innerJoin(memories, eq(memories.id, memoryShares.memoryId))
    .innerJoin(profiles, eq(profiles.id, memories.ownerId))
    .where(
      and(
        eq(memoryShares.userId, userId),
        eq(memoryShares.status, "accepted"),
      ),
    )
    .orderBy(desc(memories.memoryDate), desc(memories.createdAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    memoryDate: row.memoryDate,
    photoCount: row.photoCount,
    sharedBy: row.sharedBy,
    coverUrl:
      row.coverSource === "custom" && row.coverThumbnailKey
        ? publicUrl(row.coverThumbnailKey)
        : row.coverSource === "photo" && row.coverPhotoThumbKey
          ? publicUrl(row.coverPhotoThumbKey)
          : row.latestThumbKey
            ? publicUrl(row.latestThumbKey)
            : null,
  }));
}

/** FR-SHARE-4 — who a memory is shared with, for the owner's share panel. */
export async function listMembers(memoryId: string): Promise<ShareMember[]> {
  const rows = await db
    .select({
      id: memoryShares.id,
      userId: memoryShares.userId,
      invitedEmail: memoryShares.invitedEmail,
      permission: memoryShares.permission,
      status: memoryShares.status,
      displayName: profiles.displayName,
    })
    .from(memoryShares)
    .leftJoin(profiles, eq(profiles.id, memoryShares.userId))
    .where(
      and(
        eq(memoryShares.memoryId, memoryId),
        // Revoked rows are history, not membership.
        sql`${memoryShares.status} <> 'revoked'`,
      ),
    )
    .orderBy(memoryShares.createdAt);

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    displayName: row.displayName ?? row.invitedEmail ?? "Invited person",
    email: row.invitedEmail,
    permission: row.permission,
    status: row.status,
  }));
}

/**
 * D13/D14 — claim invites addressed to this email address.
 *
 * Called on first authenticated request. An invite created before the person
 * had an account carries only `invited_email`; once they sign up it becomes a
 * real membership. Matching is case-insensitive because email case is not
 * meaningful and people type their address however they like.
 */
export async function claimPendingInvites(
  userId: string,
  email: string,
): Promise<number> {
  if (!email) return 0;

  const claimed = await db
    .update(memoryShares)
    .set({ userId, status: "accepted", invitedEmail: null })
    .where(
      and(
        isNull(memoryShares.userId),
        eq(memoryShares.status, "pending"),
        sql`lower(${memoryShares.invitedEmail}) = lower(${email})`,
      ),
    )
    .returning({ id: memoryShares.id });

  return claimed.length;
}

/** Look up a registered user by email so a share can target them directly. */
export async function findProfileByEmail(email: string) {
  // profiles has no email column — Neon Auth owns identity — so this reaches
  // across to the auth schema, read-only, by exact lowercased address.
  const result = await db.execute<{ id: string }>(
    // id::text — the auth schema stores it as uuid, everything in this app
    // stores it as text.
    sql`select id::text as id from neon_auth."user" where lower(email) = lower(${email}) limit 1`,
  );
  const rows = result.rows as Array<{ id: string }>;
  return rows[0] ?? null;
}

/** Photos count for a memory, used by the public guest view. */
export async function countPhotos(memoryId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(photos)
    .where(eq(photos.memoryId, memoryId));
  return result[0]?.count ?? 0;
}
