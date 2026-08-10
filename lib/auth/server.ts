import { createNeonAuth } from "@neondatabase/auth/next/server";

import { appEnv, authEnv } from "@/lib/env";

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
 * Call a Neon Auth endpoint directly, bypassing the SDK.
 *
 * Needed because `@neondatabase/auth@0.4.2-beta` declares
 * `emailOtp.resetPassword` at `email-otp/passcode`, which returns 404 — the
 * real endpoint is `email-otp/reset-password`. Every password reset failed with
 * a 404 that surfaced as `user_not_found`, which reads like a bad code.
 *
 * An `Origin` header is required: the server checks it against the project's
 * trusted origins, and a request without one is rejected as MISSING_ORIGIN.
 * NEXT_PUBLIC_APP_URL is exactly the origin the app is served from, and is one
 * of the configured trusted values.
 *
 * Returns the SDK's `{ data, error }` shape so callers and error mapping are
 * identical whether or not they go through this path. Re-check this workaround
 * when the SDK updates.
 */
export async function neonAuthPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: unknown }> {
  const { NEON_AUTH_BASE_URL } = authEnv();
  const origin = appEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  try {
    const response = await fetch(
      `${NEON_AUTH_BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(body),
      },
    );

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { message: text.slice(0, 200) };
    }

    if (!response.ok) {
      const record = (parsed ?? {}) as Record<string, unknown>;
      return {
        data: null,
        error: {
          status: response.status,
          statusText: response.statusText,
          code: record.code ?? "",
          message: record.message ?? response.statusText,
        },
      };
    }

    return { data: parsed as T, error: null };
  } catch (thrown) {
    return {
      data: null,
      error: { code: "NETWORK_ERROR", message: String(thrown) },
    };
  }
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
