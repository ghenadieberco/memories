"use server";

import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { memories, memoryShares, profiles } from "@/db/schema";
import { AccessDeniedError, assertOwnsMemory } from "@/lib/access";
import { db } from "@/lib/db";
import { sendShareNotification } from "@/lib/email";
import { requireProfile } from "@/lib/profile";
import { findProfileByEmail } from "@/lib/sharing";
import {
  shareIdSchema,
  shareMemorySchema,
  toFormState,
  updatePermissionSchema,
  memoryIdSchema,
  type FormState,
} from "@/lib/validation";

/*
 * Sharing mutations (FR-SHARE-1..7, 10).
 *
 * Only the owner may share, change a permission, revoke, or touch the public
 * link (FR-SHARE-5). Everything routes through assertOwnsMemory.
 */

function shareError(error: unknown, fallback: string): FormState {
  if (error instanceof AccessDeniedError) {
    return { error: "That memory isn't available." };
  }
  console.error("[sharing]", error);
  return { error: fallback };
}

/**
 * FR-SHARE-1/2/6 — share with someone by email.
 *
 * If they already have an account the membership is created 'accepted' outright
 * (D14) — the email is a notification, not a gate. If they don't, the row holds
 * `invited_email` and stays 'pending' until they sign up (D13).
 */
export async function shareMemoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireProfile();

  const parsed = shareMemorySchema.safeParse({
    memoryId: formData.get("memoryId"),
    email: formData.get("email"),
    permission: formData.get("permission"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { memoryId, email, permission } = parsed.data;

  try {
    await assertOwnsMemory(user.id, memoryId);

    const [memory] = await db
      .select({ title: memories.title })
      .from(memories)
      .where(eq(memories.id, memoryId))
      .limit(1);

    const [me] = await db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    const target = await findProfileByEmail(email);

    if (target && target.id === user.id) {
      return { error: "That memory is already yours." };
    }

    if (target) {
      // Re-sharing with someone previously revoked should restore them rather
      // than fail on the unique index.
      await db
        .insert(memoryShares)
        .values({
          memoryId,
          userId: target.id,
          permission,
          invitedBy: user.id,
          status: "accepted",
        })
        .onConflictDoUpdate({
          target: [memoryShares.memoryId, memoryShares.userId],
          set: { permission, status: "accepted" },
        });
    } else {
      await db
        .insert(memoryShares)
        .values({
          memoryId,
          invitedEmail: email,
          permission,
          invitedBy: user.id,
          status: "pending",
        })
        .onConflictDoNothing();
    }

    // Never let a notification failure fail the share itself.
    await sendShareNotification({
      to: email,
      sharerName: me?.displayName ?? "Someone",
      memoryTitle: memory?.title ?? "a memory",
      permission,
      hasAccount: Boolean(target),
    });
  } catch (error) {
    return shareError(error, "We couldn't share that memory.");
  }

  revalidatePath(`/memories/${memoryId}`);
  return {
    notice: "Invitation sent.",
  };
}

/** FR-SHARE-4 — revoke access. */
export async function revokeShareAction(formData: FormData): Promise<FormState> {
  const user = await requireProfile();

  const parsed = shareIdSchema.safeParse({
    memoryId: formData.get("memoryId"),
    shareId: formData.get("shareId"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { memoryId, shareId } = parsed.data;

  try {
    await assertOwnsMemory(user.id, memoryId);
    // Delete rather than mark revoked: the unique index is partial on
    // non-null user_id, and keeping tombstones would block re-sharing later.
    await db
      .delete(memoryShares)
      .where(
        and(eq(memoryShares.id, shareId), eq(memoryShares.memoryId, memoryId)),
      );
  } catch (error) {
    return shareError(error, "We couldn't revoke that access.");
  }

  revalidatePath(`/memories/${memoryId}`);
  return { notice: "Access revoked." };
}

/** FR-SHARE-2 — switch someone between "can view" and "can add photos". */
export async function updatePermissionAction(formData: FormData): Promise<FormState> {
  const user = await requireProfile();

  const parsed = updatePermissionSchema.safeParse({
    memoryId: formData.get("memoryId"),
    shareId: formData.get("shareId"),
    permission: formData.get("permission"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { memoryId, shareId, permission } = parsed.data;

  try {
    await assertOwnsMemory(user.id, memoryId);
    await db
      .update(memoryShares)
      .set({ permission })
      .where(
        and(eq(memoryShares.id, shareId), eq(memoryShares.memoryId, memoryId)),
      );
  } catch (error) {
    return shareError(error, "We couldn't update that permission.");
  }

  revalidatePath(`/memories/${memoryId}`);
  return { notice: "Permission updated." };
}

/**
 * FR-SHARE-10 — turn the public link off or on.
 *
 * Revoking flips `public_link_active`, which `getPublicMemory` checks on every
 * guest request, so an existing link stops working immediately.
 */
export async function togglePublicLinkAction(formData: FormData): Promise<FormState> {
  const user = await requireProfile();

  const parsed = memoryIdSchema.safeParse({ memoryId: formData.get("memoryId") });
  if (!parsed.success) return toFormState(parsed.error);

  const { memoryId } = parsed.data;
  const active = formData.get("active") === "true";

  try {
    await assertOwnsMemory(user.id, memoryId);
    await db
      .update(memories)
      .set({ publicLinkActive: active, updatedAt: new Date() })
      .where(eq(memories.id, memoryId));
  } catch (error) {
    return shareError(error, "We couldn't update that link.");
  }

  revalidatePath(`/memories/${memoryId}`);
  return { notice: active ? "Public link is on." : "Public link is off." };
}

/**
 * FR-SHARE-10 — regenerate the token.
 *
 * Stronger than switching the link off: anyone holding the old URL loses access
 * permanently, even if the link is turned back on later.
 */
export async function regeneratePublicLinkAction(formData: FormData): Promise<FormState> {
  const user = await requireProfile();

  const parsed = memoryIdSchema.safeParse({ memoryId: formData.get("memoryId") });
  if (!parsed.success) return toFormState(parsed.error);

  const { memoryId } = parsed.data;

  try {
    await assertOwnsMemory(user.id, memoryId);
    // Same 128 bits of entropy as the column default (FR-SHARE-7, NFR-SEC).
    await db
      .update(memories)
      .set({ publicToken: randomBytes(16).toString("hex"), updatedAt: new Date() })
      .where(eq(memories.id, memoryId));
  } catch (error) {
    return shareError(error, "We couldn't regenerate that link.");
  }

  revalidatePath(`/memories/${memoryId}`);
  return { notice: "New link created. The old one no longer works." };
}

/**
 * D21 — allow or stop guests adding photos through the public link.
 *
 * This is the one switch in the app that opens an unauthenticated write path,
 * so it is per-memory, off by default, and owner-only. Turning the public link
 * off disables contributions too, since `getPublicMemoryForContribution`
 * requires both flags.
 */
export async function togglePublicContributeAction(
  formData: FormData,
): Promise<FormState> {
  const user = await requireProfile();

  const parsed = memoryIdSchema.safeParse({ memoryId: formData.get("memoryId") });
  if (!parsed.success) return toFormState(parsed.error);

  const { memoryId } = parsed.data;
  const allow = formData.get("allow") === "true";

  try {
    await assertOwnsMemory(user.id, memoryId);
    await db
      .update(memories)
      .set({ publicCanContribute: allow, updatedAt: new Date() })
      .where(eq(memories.id, memoryId));
  } catch (error) {
    return shareError(error, "We couldn't update that setting.");
  }

  revalidatePath(`/memories/${memoryId}`);
  return {
    notice: allow
      ? "Anyone with the link can now add photos."
      : "Guests can view but not add photos.",
  };
}
