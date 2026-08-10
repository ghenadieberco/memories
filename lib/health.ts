import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  deleteObjects,
  publicUrl,
  putObject,
  randomKeySegment,
} from "@/lib/storage";

/*
 * Phase 0 acceptance checks (implementation plan §8):
 *   "a row round-trips to Neon; a test object round-trips to Tigris/R2 via the
 *    public URL."
 *
 * These exist to prove the deployment pipeline end to end before there is an
 * app to break. Delete them, or put them behind auth, during Phase 5 hardening
 * — `storageRoundTrip` writes to the real bucket.
 */

export type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

export async function databaseRoundTrip(): Promise<CheckResult> {
  try {
    const started = Date.now();
    const result = await db.execute<{ n: number }>(sql`select 1 as n`);
    const rows = result.rows as Array<{ n: number }>;
    if (rows[0]?.n !== 1) {
      return { name: "Neon", ok: false, detail: "unexpected query result" };
    }

    // Confirm migrations actually ran, not just that a connection opened.
    const tables = await db.execute<{ count: string }>(sql`
      select count(*)::text as count
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'profiles','memories','photos','memory_shares',
          'comments','likes','persons','photo_tags'
        )
    `);
    const found = Number((tables.rows as Array<{ count: string }>)[0]?.count ?? 0);
    const ms = Date.now() - started;

    if (found < 8) {
      return {
        name: "Neon",
        ok: false,
        detail: `connected in ${ms}ms, but only ${found}/8 tables exist — run npm run db:migrate`,
      };
    }
    return { name: "Neon", ok: true, detail: `8/8 tables, ${ms}ms round trip` };
  } catch (error) {
    return {
      name: "Neon",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function storageRoundTrip(): Promise<CheckResult> {
  const key = `_healthcheck/${randomKeySegment()}.txt`;
  const payload = `memories health check ${new Date().toISOString()}`;

  try {
    const started = Date.now();
    await putObject(key, Buffer.from(payload, "utf8"), "text/plain");

    // Fetch through the PUBLIC url, not the S3 API — that is what browsers will
    // use for image bytes, and it is the half most likely to be misconfigured.
    const url = publicUrl(key);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return {
        name: "Tigris",
        ok: false,
        detail: `uploaded, but public URL returned ${res.status}. Is the bucket public and S3_PUBLIC_URL correct?`,
      };
    }

    const body = await res.text();
    const ms = Date.now() - started;
    if (body.trim() !== payload) {
      return { name: "Tigris", ok: false, detail: "public URL served stale or wrong content" };
    }

    return { name: "Tigris", ok: true, detail: `wrote + read via public URL, ${ms}ms` };
  } catch (error) {
    return {
      name: "Tigris",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await deleteObjects([key]).catch(() => {
      /* best effort — a stray health-check object is harmless */
    });
  }
}
