import { NextResponse, type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth/server";

/*
 * Route protection. Next 16 renamed `middleware.ts` to `proxy.ts`.
 *
 * The matcher is an explicit allow-list of the authenticated area rather than
 * the SDK's catch-all example, because two paths MUST stay reachable without a
 * session:
 *   - `/m/[token]`   the public guest album (FR-SHARE-8)
 *   - the auth pages themselves
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT — why non-GET requests skip the auth middleware entirely.
 *
 * `@neondatabase/auth@0.4.2-beta`'s `auth.middleware()` redirects EVERY non-GET
 * request on a matched path to the login URL, even with a perfectly valid
 * session. Verified with one session cookie:
 *
 *     GET  /memories -> 200        POST /memories -> 307 /sign-in
 *     GET  /settings -> 200        POST /settings -> 307 /sign-in
 *
 * A Next server action is a POST to the current page's URL, so this silently
 * broke every mutation in the authenticated area — create/edit/delete a memory,
 * set a cover, delete a photo, and both settings forms. Nothing reached
 * application code, so there were no logs and no database writes to point at.
 *
 * Skipping the middleware for non-GET does NOT weaken authorization. The plan's
 * model (§2, §6) puts the real gate in the data layer: every action calls
 * `requireProfile()` and goes through `lib/access.ts`, and an unauthenticated
 * action still redirects to sign-in from there. The middleware only ever
 * existed to keep signed-out visitors from *navigating* into the app.
 *
 * Re-test when the SDK updates; if fixed, this special case can go.
 * ---------------------------------------------------------------------------
 */

let handler: ReturnType<ReturnType<typeof getAuth>["middleware"]> | null = null;

export default async function proxy(request: NextRequest) {
  // Navigations only. Server actions (POST) authorise themselves.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  if (!handler) {
    // `(auth)` is a route group, so the sign-in screen lives at /sign-in.
    handler = getAuth().middleware({ loginUrl: "/sign-in" });
  }
  return handler(request);
}

export const config = {
  matcher: [
    "/memories/:path*",
    "/shared/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
