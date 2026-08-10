import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

/*
 * Migration runner. Invoked by `npm run db:migrate`, which fly.toml runs as the
 * release command before every deploy.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — expected on Fly, where secrets are already in the environment
}

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
  // memories.public_token defaults to encode(gen_random_bytes(16),'hex'), which
  // lives in pgcrypto. Must exist before the first migration runs.
  await db.execute(sql`create extension if not exists pgcrypto`);

  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("Migrations applied.");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await pool.end();
}
