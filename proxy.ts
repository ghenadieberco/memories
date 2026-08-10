import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth/server";

/*
 * Route protection. Next 16 renamed `middleware.ts` to `proxy.ts`.
 *
 * The matcher is an explicit allow-list of the authenticated area rather than
 * the SDK's catch-all example, because two paths in this app MUST stay
 * reachable without a session:
 *   - `/m/[token]`  the public guest album (FR-SHARE-8) — gating it would break
 *                   the entire public-link feature
 *   - `/auth` pages the sign-in and sign-up screens themselves
 *
 * A catch-all matcher that later swallowed `/m/[token]` would be a silent,
 * high-impact regression, so protected routes are named one by one. Add new
 * authenticated sections here as they land.
 *
 * Built on first request rather than at module load, for the same reason as the
 * auth route handler: `next build` must not need secrets.
 */

let handler: ReturnType<ReturnType<typeof getAuth>["middleware"]> | null = null;

export default async function proxy(request: NextRequest) {
  if (!handler) {
    // `(auth)` is a route group, so the sign-in screen lives at /sign-in.
    handler = getAuth().middleware({ loginUrl: "/sign-in" });
  }
  return handler(request);
}

export const config = {
  matcher: ["/memories/:path*", "/shared/:path*", "/settings/:path*"],
};
