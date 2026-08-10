"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/*
 * Error boundary for the authenticated area.
 *
 * Without this, an unhandled server error renders as a bare "This page couldn't
 * load" with nothing to go on. Next attaches a `digest` to server errors and
 * logs the full stack under the same digest — showing it here is what turns an
 * unreproducible report into a one-line log lookup.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="glass mx-auto mt-10 max-w-[440px] rounded-2xl p-[22px] text-center">
      <AlertTriangle size={32} className="mx-auto text-orange" aria-hidden="true" />
      <h1 className="mt-3 font-display text-[19px] font-semibold text-ink">
        Something broke on our side
      </h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Your memories are safe. Try again, and if it keeps happening send us the
        reference below.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-[12px] text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}

      <button type="button" className="btn primary mt-5" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
