import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import { dbEnv } from "@/lib/env";

/*
 * Neon connection.
 *
 * Uses node-postgres (a real TCP pool) rather than Neon's HTTP driver: Fly runs
 * a long-lived Node server, so a warm pool beats one HTTP round trip per query.
 * Point DATABASE_URL at Neon's *pooled* connection string.
 *
 * Everything here is built on first use, never at module load. `next build`
 * imports this module while collecting page data and must not need secrets —
 * the Docker image is built without them.
 *
 * The pool and client are cached on globalThis so Next's dev-mode module
 * reloading doesn't leak a new pool on every edit.
 */

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __memoriesPool?: Pool;
  __memoriesDb?: Database;
};

function getPool(): Pool {
  if (globalForDb.__memoriesPool) return globalForDb.__memoriesPool;

  const { DATABASE_URL } = dbEnv();
  const isLocal = /localhost|127\.0\.0\.1/.test(DATABASE_URL);

  globalForDb.__memoriesPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  return globalForDb.__memoriesPool;
}

export function getDb(): Database {
  if (globalForDb.__memoriesDb) return globalForDb.__memoriesDb;
  globalForDb.__memoriesDb = drizzle(getPool(), { schema });
  return globalForDb.__memoriesDb;
}

/**
 * Ergonomic handle: `db.select()...` reads better than `getDb().select()...` at
 * several hundred call sites. The proxy exists purely to defer construction to
 * first property access — importing this module stays free of side effects.
 * Methods are bound to the real instance so `this` survives the indirection.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
