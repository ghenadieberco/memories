import { desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { appSettings, memories, profiles } from "@/db/schema";
import { db } from "@/lib/db";
import { requireProfile, type SessionUser } from "@/lib/profile";

/*
 * Admin console + global switches (D22).
 *
 * Requirements §2 reserved a `role` field "for future use" and said v1 has no
 * admin role. This is that future use, and it amends §2.
 */

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  emailVerified: boolean;
  deactivatedAt: Date | null;
  memoryCount: number;
  createdAt: Date;
};

export type AdminSession = SessionUser & { role: "admin" };

/**
 * Gate for every admin route and action.
 *
 * Redirects rather than throwing, for the same reason `requireProfile` does: an
 * unhandled throw in a server action renders as an unexplained error page with
 * nothing in the logs.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const user = await requireProfile();

  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  // Non-admins are sent to the app, not told the console exists.
  if (profile?.role !== "admin") redirect("/memories");

  return { ...user, role: "admin" };
}

export async function isAdmin(userId: string): Promise<boolean> {
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return profile?.role === "admin";
}

/**
 * Every account, for the console.
 *
 * Email lives in Neon Auth's schema, not `profiles`, so this joins across to
 * it — read-only.
 */
export async function listUsers(): Promise<AdminUser[]> {
  const result = await db.execute<{
    id: string;
    email: string;
    display_name: string | null;
    role: string | null;
    email_verified: boolean;
    deactivated_at: Date | null;
    memory_count: number;
    created_at: Date;
  }>(sql`
    select
      u.id,
      u.email,
      p.display_name,
      coalesce(p.role, 'user')                       as role,
      u."emailVerified"                              as email_verified,
      p.deactivated_at,
      (select count(*)::int from memories m where m.owner_id = u.id::text) as memory_count,
      u."createdAt"                                  as created_at
    from neon_auth."user" u
    -- neon_auth.user.id is uuid, profiles.id is text (the auth provider owns the
    -- format, so we store it as text). Postgres has no implicit uuid = text, so
    -- the cast is required on every cross-schema join.
    left join profiles p on p.id = u.id::text
    order by u."createdAt" desc
  `);

  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    email: String(row.email ?? ""),
    displayName: String(row.display_name ?? row.email ?? "Someone"),
    role: row.role === "admin" ? "admin" : "user",
    emailVerified: Boolean(row.email_verified),
    deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at as string) : null,
    memoryCount: Number(row.memory_count ?? 0),
    createdAt: new Date(row.created_at as string),
  }));
}

/** Counts for the console header. */
export async function adminStats() {
  const [memoryStats] = await db
    .select({ memories: sql<number>`count(*)::int` })
    .from(memories);

  return { memories: memoryStats?.memories ?? 0 };
}

// ---------------------------------------------------------------------------
// Maintenance mode
// ---------------------------------------------------------------------------

/**
 * Read the global maintenance flag.
 *
 * Fails OPEN: if the settings row can't be read, the app keeps working rather
 * than locking everyone out on a transient database hiccup. A false negative
 * here is a minor inconvenience; a false positive is a self-inflicted outage.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ maintenanceMode: appSettings.maintenanceMode })
      .from(appSettings)
      .where(eq(appSettings.id, "global"))
      .limit(1);
    return row?.maintenanceMode ?? false;
  } catch (error) {
    console.error("[admin] could not read maintenance flag", error);
    return false;
  }
}

export class MaintenanceModeError extends Error {
  constructor() {
    super("The app is in maintenance mode.");
    this.name = "MaintenanceModeError";
  }
}

/**
 * Guard for every mutation while maintenance mode is on.
 *
 * Admins are exempt — otherwise switching maintenance mode ON would remove the
 * ability to switch it back OFF.
 */
export async function assertWritable(userId: string | null): Promise<void> {
  if (!(await isMaintenanceMode())) return;
  if (userId && (await isAdmin(userId))) return;
  throw new MaintenanceModeError();
}

/** Most recent memories, for a bit of context in the console. */
export async function recentMemories(limit = 5) {
  return db
    .select({
      id: memories.id,
      title: memories.title,
      createdAt: memories.createdAt,
    })
    .from(memories)
    .orderBy(desc(memories.createdAt))
    .limit(limit);
}
