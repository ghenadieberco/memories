import { createNeonAuth } from "@neondatabase/auth/next/server";

import { authEnv } from "@/lib/env";

/*
 * Neon Auth (Managed Better Auth) — server instance.
 *
 * Neon Auth owns users, sessions, password hashing, email verification, reset
 * tokens, and lockout (FR-AUTH-3..9). Never hand-roll any of it, and never
 * re-create the `neon_auth` schema it manages.
 *
 * Built lazily for the same reason as lib/db.ts: `next build` runs without
 * secrets, so nothing may read env at module load.
 */

type NeonAuthInstance = ReturnType<typeof createNeonAuth>;

const globalForAuth = globalThis as unknown as {
  __memoriesAuth?: NeonAuthInstance;
};

export function getAuth(): NeonAuthInstance {
  if (globalForAuth.__memoriesAuth) return globalForAuth.__memoriesAuth;

  const env = authEnv();
  globalForAuth.__memoriesAuth = createNeonAuth({
    baseUrl: env.NEON_AUTH_BASE_URL,
    cookies: { secret: env.NEON_AUTH_COOKIE_SECRET },
  });

  return globalForAuth.__memoriesAuth;
}

/**
 * Deferred handle, mirroring `db` in lib/db.ts — property access constructs the
 * instance, so importing this module stays free of side effects.
 */
export const auth = new Proxy({} as NeonAuthInstance, {
  get(_target, property) {
    const instance = getAuth() as unknown as Record<string | symbol, unknown>;
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
