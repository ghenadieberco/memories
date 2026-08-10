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
  strict: true,
  verbose: true,
});
