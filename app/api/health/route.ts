import { NextResponse } from "next/server";

import { databaseRoundTrip, storageRoundTrip } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/*
 * GET /api/health          → liveness + database reachability (cheap, safe)
 * GET /api/health?deep=1   → also round-trips a real object through storage
 *
 * The deep probe writes to the production bucket. Remove this route or put it
 * behind auth during Phase 5 hardening.
 */
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";

  const checks = deep
    ? await Promise.all([databaseRoundTrip(), storageRoundTrip()])
    : [await databaseRoundTrip()];

  const ok = checks.every((c) => c.ok);

  return NextResponse.json(
    { ok, checks, at: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
