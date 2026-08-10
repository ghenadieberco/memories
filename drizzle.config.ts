import { defineConfig } from "drizzle-kit";

// Load .env.local for local `db:generate` / `db:studio` runs. In production the
// environment is already populated by Fly secrets, so a missing file is fine.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — expected in CI and on Fly
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Only ever manage `public`. Neon Auth owns the `neon_auth` schema; without
  // this, a future generate/push could propose dropping its tables.
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
