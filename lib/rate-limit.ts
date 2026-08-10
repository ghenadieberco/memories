/*
 * Minimal fixed-window rate limiter for the unauthenticated guest upload path
 * (D21).
 *
 * Scope and honesty about it: this is an in-process counter. It resets on
 * deploy and is per-machine, so it would not hold if the app scaled past the
 * single Fly machine it runs on today. It exists to stop casual abuse of an
 * open write endpoint — a forwarded public link pointed at a script — not to
 * withstand a determined attacker. A durable limiter (Postgres or Redis backed)
 * belongs in the Phase 5 hardening pass.
 *
 * Without something here, "anyone with the link can upload" means "anyone with
 * the link can fill the bucket", and storage is billed by the gigabyte.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

/** Drop expired windows so the map can't grow without bound. */
function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * Best-effort client identity. Fly sets Fly-Client-IP; x-forwarded-for is the
 * fallback. Both are attacker-controllable in principle, which is another
 * reason this is a speed bump rather than a security control.
 */
export function clientKey(request: Request): string {
  const headers = request.headers;
  const ip =
    headers.get("fly-client-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return ip;
}
