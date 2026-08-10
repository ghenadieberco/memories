import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { profiles } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";

/*
 * `profiles` is the app's half of a user: Neon Auth owns identity and
 * credentials, this table owns display name and app settings, keyed by the Neon
 * Auth user id.
 *
 * There is no "on user created" hook to rely on, so the row is created lazily
 * on first authenticated request (plan §8, Phase 1).
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

/** The signed-in user, or null. Never throws on an absent session. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { data } = await auth.getSession();
  const user = data?.user;

  if (!user?.id) return null;

  return {
    id: String(user.id),
    email: String(user.email ?? ""),
    name: String(user.name ?? ""),
    emailVerified: Boolean(user.emailVerified),
  };
}

/**
 * Return the signed-in user, creating their `profiles` row if this is the first
 * time we've seen them. Call this from the authenticated layout so every
 * downstream query can assume the row exists.
 */
export async function requireProfile(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    /*
     * Redirect rather than throw. The previous version threw a bare Error,
     * which in a server action is an unhandled exception — the browser shows
     * "This page couldn't load" and nothing is logged, which is indistinguishable
     * from a real bug. Sending an unauthenticated caller to sign-in is both the
     * correct behaviour and a legible one.
     */
    redirect("/sign-in");
  }

  await db
    .insert(profiles)
    .values({
      id: user.id,
      displayName: user.name || user.email.split("@")[0] || "Someone",
    })
    // Concurrent first requests (e.g. two tabs) must not race into a duplicate
    // key error — the row existing is exactly the desired outcome.
    .onConflictDoNothing({ target: profiles.id });

  return user;
}

/** Keep profiles.display_name in step with the Neon Auth user record. */
export async function syncProfileName(name: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  await db
    .update(profiles)
    .set({ displayName: name, updatedAt: new Date() })
    .where(eq(profiles.id, user.id));
}
