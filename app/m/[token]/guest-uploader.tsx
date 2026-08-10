"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

/*
 * Guest upload control (D21).
 *
 * Rendered ONLY when the owner has switched on contributions for this memory.
 * The server re-checks that on every request — this component's presence grants
 * nothing on its own.
 *
 * The token is already in the URL the guest is looking at, so passing it in the
 * request body reveals nothing they don't have.
 */

const UPLOAD_CONCURRENCY = 2;

type UploadState = { name: string; status: "pending" | "done" | "failed"; error?: string };

export function GuestUploader({ token }: { token: string }) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setUploads(files.map((file) => ({ name: file.name, status: "pending" })));

    const queue = [...files.entries()];
    const worker = async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        const [position, file] = next;

        const body = new FormData();
        body.append("token", token);
        body.append("file", file);

        try {
          const response = await fetch("/api/photos", { method: "POST", body });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error ?? "Upload failed.");
          }
          setUploads((prev) =>
            prev.map((u, i) => (i === position ? { ...u, status: "done" } : u)),
          );
        } catch (error) {
          setUploads((prev) =>
            prev.map((u, i) =>
              i === position
                ? { ...u, status: "failed", error: (error as Error).message }
                : u,
            ),
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker),
    );

    setBusy(false);
    window.location.reload();
  }

  const failed = uploads.filter((u) => u.status === "failed");
  const done = uploads.filter((u) => u.status === "done").length;

  return (
    <div className="glass mb-5 flex flex-wrap items-center gap-3 rounded-2xl p-[22px]">
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-bold text-ink">Add your photos</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Whoever shared this album is letting anyone with the link add to it. No
          account needed.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void uploadFiles(files);
        }}
      />

      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <ImagePlus size={15} aria-hidden="true" />
        )}
        {busy ? `Uploading ${done}/${uploads.length}…` : "Add photos"}
      </button>

      {failed.length > 0 && (
        <p className="form-error w-full" role="alert">
          {failed.length === 1 ? failed[0].error : `${failed.length} photos didn't upload.`}
        </p>
      )}
    </div>
  );
}
