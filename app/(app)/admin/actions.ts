"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { appSettings, profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { toFormState, type FormState } from "@/lib/validation";

/*
 * Admin console actions (D22).
 *
 * Every one calls `requireAdmin()` first, which redirects a non-admin to
 * /memories without confirming the console exists.
 *
 * Deliberately NOT exempt from maintenance mode — an admin has to be able to
 * turn it back off.
 */

const setActiveSchema = z.object({
  userId: z.string().min(1),
  active: z.enum(["true", "false"]),
});

const maintenanceSchema = z.object({
  enabled: z.enum(["true", "false"]),
});

/** D22 — deactivate or reactivate an account. */
export async function setUserActiveAction(formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = setActiveSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return toFormState(parsed.error);

  const { userId, active } = parsed.data;
  const activate = active === "true";

  /*
   * An admin deactivating themselves would lock the console — and possibly the
   * last admin out of the app entirely. Refuse rather than let someone discover
   * that the hard way.
   */
  if (!activate && userId === admin.id) {
    return { error: "You can't deactivate your own account." };
  }

  try {
    await db
      .update(profiles)
      .set({ deactivatedAt: activate ? null : new Date(), updatedAt: new Date() })
      .where(eq(profiles.id, userId));
  } catch (error) {
    console.error("[admin] setUserActive failed", error);
    return { error: "We couldn't update that account." };
  }

  revalidatePath("/admin");
  return { notice: activate ? "Account reactivated." : "Account deactivated." };
}

/**
 * D22 — global maintenance mode.
 *
 * Upsert on a fixed 'global' row so the switch works even before any settings
 * row exists.
 */
export async function setMaintenanceModeAction(
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = maintenanceSchema.safeParse({ enabled: formData.get("enabled") });
  if (!parsed.success) return toFormState(parsed.error);

  const enabled = parsed.data.enabled === "true";

  try {
    await db
      .insert(appSettings)
      .values({
        id: "global",
        maintenanceMode: enabled,
        updatedBy: admin.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { maintenanceMode: enabled, updatedBy: admin.id, updatedAt: new Date() },
      });
  } catch (error) {
    console.error("[admin] setMaintenanceMode failed", error);
    return { error: "We couldn't change maintenance mode." };
  }

  // The banner and the write guards read this on every request, so everything
  // has to revalidate.
  revalidatePath("/", "layout");
  return {
    notice: enabled
      ? "Maintenance mode is ON. Everyone but admins is now read-only."
      : "Maintenance mode is OFF.",
  };
}
