import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

/*
 * Migration runner. Invoked by `npm run db:migrate` locally, and — after being
 * bundled by scripts/bundle-migrate.mjs — as fly.toml's release command.
 *
 * Everything lives inside main() rather than using top-level await: this file
 * runs both through tsx (CommonJS, since package.json has no "type": "module")
 * and as an ESM bundle, and top-level await is illegal in the former.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — expected on Fly, where secrets are already in the environment
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set — cannot migrate.");
    process.exit(1);
  }

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
    max: 1,
  });

  const db = drizzle(pool);

  try {
    // memories.public_token defaults to encode(gen_random_bytes(16),'hex'),
    // which lives in pgcrypto. Must exist before the first migration runs.
    await db.execute(sql`create extension if not exists pgcrypto`);

    await migrate(db, { migrationsFolder: "./db/migrations" });
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
