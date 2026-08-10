import { z } from "zod";

/*
 * Server environment, validated per concern and cached after first use.
 *
 * Deliberately lazy: `next build` runs without secrets present (and must, so CI
 * and Docker image builds work), but any code path that actually touches the
 * database or storage fails loudly and specifically instead of sending
 * `undefined` to a driver.
 *
 * Grouped rather than one flat object so a failure names only what the caller
 * needed — a database error should not list missing S3 keys.
 */

const dbSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const storageSchema = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("auto"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  /** Public/CDN base URL images are served from — never proxied by the app. */
  S3_PUBLIC_URL: z.string().url(),
});

const appSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const authSchema = z.object({
  /** Neon console -> Auth -> Configuration. */
  NEON_AUTH_BASE_URL: z.string().url(),
  /** Self-generated. Neon Auth signs session cookies with HMAC-SHA256. */
  NEON_AUTH_COOKIE_SECRET: z
    .string()
    .min(32, "must be at least 32 characters (openssl rand -base64 32)"),
});

function loader<T extends z.ZodType>(label: string, schema: T) {
  let cached: z.infer<T> | null = null;

  return (): z.infer<T> => {
    if (cached) return cached;

    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues
        .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `Missing ${label} configuration:\n${missing}\n\n` +
          `Copy .env.example to .env.local and fill it in (implementation plan §4).`,
      );
    }

    cached = parsed.data;
    return cached;
  };
}

export const dbEnv = loader("database", dbSchema);
export const storageEnv = loader("object storage", storageSchema);
export const appEnv = loader("app", appSchema);
export const authEnv = loader("Neon Auth", authSchema);
