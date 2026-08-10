"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { DownloadTooLargeError, downloadMany } from "@/lib/download";
import type { MemoryPhoto } from "@/lib/memories";

/*
 * Download control — FR-DL-2/3/7.
 *
 * Shared by the owner's grid and the public gallery so guests and members get
 * the same behaviour from the same code (FR-DL-5). It needs no permission prop:
 * it can only ever act on the `photos` array it is handed, which the server
 * already scoped to this viewer.
 *
 * Progress is counted in files rather than bytes. Bytes would be a more precise
 * bar and a less honest one — the archive is assembled after the last file
 * arrives, so a byte meter would sit at 100% through the part that has no
 * feedback at all. "18 / 40" keeps moving and never lies about being finished.
 */
export function DownloadButton({
  photos,
  archiveName,
  label,
  variant = "ghost",
}: {
  photos: MemoryPhoto[];
  archiveName: string;
  label: string;
  variant?: "ghost" | "primary";
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy || photos.length === 0) return;
    setBusy(true);
    setDone(0);
    setError(null);

    try {
      await downloadMany(photos, archiveName, (completed) => setDone(completed));
    } catch (cause) {
      // A refusal to start (too big) and a failure mid-way read the same to the
      // user: nothing was saved, and the message says what to do about it.
      setError(
        cause instanceof DownloadTooLargeError
          ? cause.message
          : (cause as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`btn ${variant} sm`}
        onClick={start}
        disabled={busy || photos.length === 0}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <Download size={15} aria-hidden="true" />
        )}
        {busy ? `Preparing ${done}/${photos.length}…` : label}
      </button>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
