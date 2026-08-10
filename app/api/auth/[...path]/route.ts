import { getAuth } from "@/lib/auth/server";

/*
 * Neon Auth proxy. Every browser auth call (sign-up, sign-in, OTP, reset,
 * sign-out) goes through here, which is why the Neon Auth base URL and cookie
 * secret stay server-side.
 *
 * The handlers are built on first request, not at module load. Neon's example
 * writes `export const { GET, POST } = auth.handler()`, which runs immediately
 * on import — and `next build` imports every route while collecting page data,
 * in a Docker stage that deliberately has no secrets. That fails the image
 * build. Deferring keeps the build secret-free (same reasoning as lib/db.ts).
 */
export const runtime = "nodejs";

type Handlers = ReturnType<ReturnType<typeof getAuth>["handler"]>;

/** Derived from the SDK so it can't drift: `{ params: Promise<{ path: string[] }> }`. */
type AuthRouteContext = Parameters<Handlers["GET"]>[1];

let handlers: Handlers | null = null;

function getHandlers(): Handlers {
  if (!handlers) handlers = getAuth().handler();
  return handlers;
}

export async function GET(request: Request, context: AuthRouteContext) {
  return getHandlers().GET(request, context);
}

export async function POST(request: Request, context: AuthRouteContext) {
  return getHandlers().POST(request, context);
}
