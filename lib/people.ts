import { and, eq, sql } from "drizzle-orm";

import { memories, memoryShares, persons, photoTags, photos, profiles } from "@/db/schema";
import { db } from "@/lib/db";

/*
 * People tagging (FR-SOC-4/5, A8).
 *
 * "Tagging" means identifying PEOPLE, not free-form keywords. A tag points at a
 * `person` row in the tagger's own people list; when that person is also an app
 * user, `linked_user_id` is set so they can remove a tag of themselves
 * (FR-SOC-5).
 */

export type PhotoTag = {
  id: string;
  personId: string;
  name: string;
  linkedUserId: string | null;
  taggedBy: string;
};

/** All tags for the photos in a memory, grouped by photo id. */
export async function listTagsByPhoto(
  memoryId: string,
): Promise<Record<string, PhotoTag[]>> {
  const rows = await db
    .select({
      id: photoTags.id,
      photoId: photoTags.photoId,
      personId: persons.id,
      name: persons.name,
      linkedUserId: persons.linkedUserId,
      taggedBy: photoTags.taggedBy,
    })
    .from(photoTags)
    .innerJoin(persons, eq(persons.id, photoTags.personId))
    .innerJoin(photos, eq(photos.id, photoTags.photoId))
    .where(eq(photos.memoryId, memoryId));

  const grouped: Record<string, PhotoTag[]> = {};
  for (const row of rows) {
    (grouped[row.photoId] ??= []).push({
      id: row.id,
      personId: row.personId,
      name: row.name,
      linkedUserId: row.linkedUserId,
      taggedBy: row.taggedBy,
    });
  }
  return grouped;
}

/** Distinct people tagged anywhere in a memory — powers the filter (FR-SOC-5). */
export async function listPeopleInMemory(memoryId: string) {
  const rows = await db
    .selectDistinct({ id: persons.id, name: persons.name })
    .from(photoTags)
    .innerJoin(persons, eq(persons.id, photoTags.personId))
    .innerJoin(photos, eq(photos.id, photoTags.photoId))
    .where(eq(photos.memoryId, memoryId))
    .orderBy(persons.name);

  return rows;
}

/**
 * Find or create a person in `ownerId`'s people list.
 *
 * Matched case-insensitively on name so "Sofia" and "sofia" don't become two
 * different people in the same list.
 *
 * If the name matches someone with access to this memory, link the person to
 * that account — that link is what lets them later remove a tag of themselves
 * (FR-SOC-5). Matching on display name is a deliberate simplification: it is a
 * convenience, and being wrong only means the tag stays a plain label.
 */
export async function findOrCreatePerson(
  ownerId: string,
  name: string,
  memoryId: string,
): Promise<string> {
  const existing = await db
    .select({ id: persons.id })
    .from(persons)
    .where(
      and(
        eq(persons.ownerUserId, ownerId),
        sql`lower(${persons.name}) = lower(${name})`,
      ),
    )
    .limit(1);

  if (existing[0]) return existing[0].id;

  // Who can see this memory? Owner plus accepted members.
  const candidates = await db
    .select({ id: profiles.id, displayName: profiles.displayName })
    .from(profiles)
    .where(
      sql`${profiles.id} in (
        select ${memories.ownerId} from ${memories} where ${memories.id} = ${memoryId}
        union
        select ${memoryShares.userId} from ${memoryShares}
        where ${memoryShares.memoryId} = ${memoryId}
          and ${memoryShares.status} = 'accepted'
          and ${memoryShares.userId} is not null
      )`,
    );

  const linked = candidates.find(
    (candidate) => candidate.displayName.toLowerCase() === name.toLowerCase(),
  );

  const [created] = await db
    .insert(persons)
    .values({
      ownerUserId: ownerId,
      name,
      linkedUserId: linked?.id ?? null,
    })
    .returning({ id: persons.id });

  return created.id;
}

/** Photo ids carrying a given person tag, for the in-memory filter. */
export async function photoIdsTaggedWith(
  memoryId: string,
  personId: string,
): Promise<string[]> {
  const rows = await db
    .select({ photoId: photoTags.photoId })
    .from(photoTags)
    .innerJoin(photos, eq(photos.id, photoTags.photoId))
    .where(and(eq(photos.memoryId, memoryId), eq(photoTags.personId, personId)));

  return rows.map((row) => row.photoId);
}
