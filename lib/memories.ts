import { and, asc, desc, eq, sql } from "drizzle-orm";

import { memories, photos } from "@/db/schema";
import { assertCanViewMemory } from "@/lib/access";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage";

/*
 * Memory reads.
 *
 * Every function here either takes a userId and goes through lib/access.ts, or
 * is explicitly the guest path. Nothing queries a memory by id alone.
 */

export type MemoryCard = {
  id: string;
  title: string;
  memoryDate: string;
  photoCount: number;
  /** Already-resolved thumbnail URL, or null to render the placeholder. */
  coverUrl: string | null;
};

export type MemoryPhoto = {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
  /** NULL for an anonymous guest upload via a public link (D21). */
  uploadedBy: string | null;
};

/**
 * FR-MEM-9/10/11 + D11 — resolve which image represents a memory:
 *   photo  -> the chosen photo's thumbnail
 *   custom -> the uploaded cover's thumbnail (never shown in the grid)
 *   auto   -> the most recent photo, else null for the placeholder
 *
 * A chosen cover photo that has since been deleted leaves `cover_photo_id`
 * null (FK is ON DELETE SET NULL), so this falls through to the auto branch —
 * which is exactly the D11 behaviour.
 */
function resolveCover(row: {
  coverSource: string;
  coverThumbnailKey: string | null;
  coverPhotoThumbKey: string | null;
  latestThumbKey: string | null;
}): string | null {
  if (row.coverSource === "custom" && row.coverThumbnailKey) {
    return publicUrl(row.coverThumbnailKey);
  }
  if (row.coverSource === "photo" && row.coverPhotoThumbKey) {
    return publicUrl(row.coverPhotoThumbKey);
  }
  return row.latestThumbKey ? publicUrl(row.latestThumbKey) : null;
}

/** FR-MEM-3/4/8 — the user's own memories, newest first, with count and cover. */
export async function listOwnedMemories(userId: string): Promise<MemoryCard[]> {
  const rows = await db
    .select({
      id: memories.id,
      title: memories.title,
      memoryDate: memories.memoryDate,
      coverSource: memories.coverSource,
      coverThumbnailKey: memories.coverThumbnailKey,
      photoCount: sql<number>`count(${photos.id})::int`,
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
    .from(memories)
    .leftJoin(photos, eq(photos.memoryId, memories.id))
    .where(eq(memories.ownerId, userId))
    .groupBy(memories.id)
    // FR-MEM-4: most recent first; created_at breaks ties so same-date
    // memories (allowed by D3) have a stable order.
    .orderBy(desc(memories.memoryDate), desc(memories.createdAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    memoryDate: row.memoryDate,
    photoCount: row.photoCount,
    coverUrl: resolveCover(row),
  }));
}

/**
 * Photos in a memory, in display order.
 *
 * D19 / FR-PHOTO-7: ordered by capture time, falling back to upload time when a
 * photo carries no EXIF. That keeps a set of photos from one day in the order
 * they were actually taken, regardless of the order they were uploaded in.
 */
export async function listMemoryPhotos(memoryId: string): Promise<MemoryPhoto[]> {
  const rows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.memoryId, memoryId), eq(photos.status, "ready")))
    .orderBy(asc(sql`coalesce(${photos.takenAt}, ${photos.createdAt})`), asc(photos.id));

  return rows.map((photo) => ({
    id: photo.id,
    url: publicUrl(photo.storageKey),
    thumbnailUrl: publicUrl(photo.thumbnailKey),
    width: photo.width,
    height: photo.height,
    uploadedBy: photo.uploadedBy,
  }));
}

/** A memory the user is allowed to open, with its photos (FR-MEM-5). */
export async function getMemoryDetail(userId: string, memoryId: string) {
  const level = await assertCanViewMemory(userId, memoryId);

  const rows = await db
    .select()
    .from(memories)
    .where(eq(memories.id, memoryId))
    .limit(1);

  const memory = rows[0];
  if (!memory) return null;

  return {
    memory,
    photos: await listMemoryPhotos(memoryId),
    accessLevel: level,
    canEdit: level === "owner",
    canAddPhotos: level === "owner" || level === "contributor",
  };
}
