"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { memories, persons, photoTags, photos } from "@/db/schema";
import {
  AccessDeniedError,
  assertCanViewMemory,
  assertCanViewPhoto,
} from "@/lib/access";
import { db } from "@/lib/db";
import { findOrCreatePerson } from "@/lib/people";
import { requireProfile } from "@/lib/profile";
import { tagPhotoSchema, toFormState, untagSchema, type FormState } from "@/lib/validation";

/*
 * People tagging (FR-SOC-4/5).
 *
 * Anyone who can VIEW the memory can tag — tagging is a social act, not an
 * edit. Guests via a public link have no session and never reach these actions
 * (FR-SHARE-9).
 */

function tagError(error: unknown, fallback: string): FormState {
  if (error instanceof AccessDeniedError) {
    return { error: "That photo isn't available." };
  }
  console.error("[tags]", error);
  return { error: fallback };
}

/** FR-SOC-4 — tag a person in a photo, by name. */
export async function tagPhotoAction(formData: FormData): Promise<FormState> {
  const user = await requireProfile();

  const parsed = tagPhotoSchema.safeParse({
    photoId: formData.get("photoId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { photoId, name } = parsed.data;

  let memoryId: string;
  try {
    const access = await assertCanViewPhoto(user.id, photoId);
    memoryId = access.memoryId;

    const personId = await findOrCreatePerson(user.id, name, memoryId);

    // Tagging the same person twice on one photo is a no-op, not an error.
    const already = await db
      .select({ id: photoTags.id })
      .from(photoTags)
      .where(and(eq(photoTags.photoId, photoId), eq(photoTags.personId, personId)))
      .limit(1);

    if (!already[0]) {
      await db.insert(photoTags).values({ photoId, personId, taggedBy: user.id });
    }
  } catch (error) {
    return tagError(error, "We couldn't add that tag.");
  }

  revalidatePath(`/memories/${memoryId}`);
  return { notice: `Tagged ${name}.` };
}

/**
 * FR-SOC-5 — remove a tag.
 *
 * Allowed for: whoever created the tag, the memory owner, or the tagged person
 * themselves when the person is linked to an app user. That last case is the
 * point — someone must always be able to remove a tag of themselves.
 */
export async function untagAction(formData: FormData): Promise<FormState> {
  const user = await requireProfile();

  const parsed = untagSchema.safeParse({ tagId: formData.get("tagId") });
  if (!parsed.success) return toFormState(parsed.error);

  const { tagId } = parsed.data;

  let memoryId: string;
  try {
    const rows = await db
      .select({
        tagId: photoTags.id,
        taggedBy: photoTags.taggedBy,
        linkedUserId: persons.linkedUserId,
        memoryId: photos.memoryId,
        ownerId: memories.ownerId,
      })
      .from(photoTags)
      .innerJoin(photos, eq(photos.id, photoTags.photoId))
      .innerJoin(memories, eq(memories.id, photos.memoryId))
      .leftJoin(persons, eq(persons.id, photoTags.personId))
      .where(eq(photoTags.id, tagId))
      .limit(1);

    const row = rows[0];
    if (!row) throw new AccessDeniedError();

    // Must be able to see the memory at all before anything else matters.
    await assertCanViewMemory(user.id, row.memoryId);

    const mayRemove =
      row.taggedBy === user.id ||
      row.ownerId === user.id ||
      row.linkedUserId === user.id;

    if (!mayRemove) {
      return { error: "Only the person who added that tag can remove it." };
    }

    memoryId = row.memoryId;
    await db.delete(photoTags).where(eq(photoTags.id, tagId));
  } catch (error) {
    return tagError(error, "We couldn't remove that tag.");
  }

  revalidatePath(`/memories/${memoryId}`);
  return { notice: "Tag removed." };
}
