"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";

import { deletePhotoAction, setCoverAction } from "../actions";
import { PhotoTags } from "./photo-tags";
import { PhotoViewer } from "@/components/photo-viewer";
import type { MemoryPhoto } from "@/lib/memories";
import type { PhotoTag } from "@/lib/people";

/*
 * Thumbnail grid + uploader + viewer trigger (FR-VIEW-1/2, FR-PHOTO-1/5/6).
 *
 * Uploads run one file per request against /api/photos so per-file success and
 * failure can be reported (FR-PHOTO-5), and so a 1GB VM never has to hold a
 * whole album at once. Concurrency is capped for the same reason.
 */

const UPLOAD_CONCURRENCY = 2;

type UploadState = { name: string; status: "pending" | "done" | "failed"; error?: string };

export function PhotoGrid({
  memoryId,
  photos,
  canAddPhotos,
  canSetCover,
  currentUserId,
  isOwner,
  tagsByPhoto,
}: {
  memoryId: string;
  photos: MemoryPhoto[];
  canAddPhotos: boolean;
  canSetCover: boolean;
  currentUserId: string;
  isOwner: boolean;
  tagsByPhoto: Record<string, PhotoTag[]>;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /*
   * Server actions returning a FormState can't be used as a bare form action
   * (that signature demands void), and wiring one useActionState per photo is
   * absurd. Calling the action directly inside a transition keeps the returned
   * error visible instead of discarding it.
   */
  function setCover(photoId: string) {
    startTransition(async () => {
      const body = new FormData();
      body.append("memoryId", memoryId);
      body.append("photoId", photoId);
      const result = await setCoverAction(body);
      setActionError(result.error ?? null);
    });
  }

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
        body.append("memoryId", memoryId);
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
    // Server components hold the photo list, so a refresh is what makes the new
    // thumbnails appear.
    window.location.reload();
  }

  const failed = uploads.filter((u) => u.status === "failed");
  const done = uploads.filter((u) => u.status === "done").length;

  return (
    <>
      {canAddPhotos && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
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

          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}

          {failed.length > 0 && (
            <p className="form-error" role="alert">
              {failed.length === 1
                ? failed[0].error
                : `${failed.length} photos didn't upload.`}
            </p>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-2xl px-6 py-12 text-center">
          <ImagePlus size={36} className="text-purple-l" aria-hidden="true" />
          <p className="mt-3 text-[13px] text-muted-foreground">
            {canAddPhotos
              ? "No photos yet. Add the ones worth keeping."
              : "No photos in this memory yet."}
          </p>
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
        >
          {photos.map((photo, index) => (
            <div key={photo.id} className="group relative">
              <button
                type="button"
                onClick={() => setViewerIndex(index)}
                className="block aspect-square w-full overflow-hidden rounded-lg transition-transform duration-150 hover:scale-[1.035]"
                style={{ boxShadow: "0 6px 18px rgba(108,43,217,.14)" }}
                aria-label={`Open photo ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- CDN-direct by design */}
                <img
                  src={photo.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>

              {(tagsByPhoto[photo.id]?.length ?? 0) > 0 && (
                <span
                  className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ background: "rgba(0,0,0,.42)" }}
                  title={tagsByPhoto[photo.id].map((tag) => tag.name).join(", ")}
                >
                  {tagsByPhoto[photo.id].length} tagged
                </span>
              )}

              <div className="pointer-events-none absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {canSetCover && (
                  <button
                    type="button"
                    onClick={() => setCover(photo.id)}
                    title="Use as cover"
                    aria-label="Use as cover"
                    className="pointer-events-auto grid size-7 place-items-center rounded-full text-white"
                    style={{ background: "rgba(0,0,0,.42)" }}
                  >
                    <Star size={13} aria-hidden="true" />
                  </button>
                )}

                {/* D10: owner deletes anything; a contributor only their own. */}
                {(isOwner || photo.uploadedBy === currentUserId) && (
                  <form action={deletePhotoAction} className="pointer-events-auto">
                    <input type="hidden" name="photoId" value={photo.id} />
                    <button
                      type="submit"
                      title="Delete photo"
                      aria-label="Delete photo"
                      className="grid size-7 place-items-center rounded-full text-white"
                      style={{ background: "rgba(0,0,0,.42)" }}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          renderFooter={(photo) => (
            <PhotoTags
              photoId={photo.id}
              tags={tagsByPhoto[photo.id] ?? []}
              currentUserId={currentUserId}
              isOwner={isOwner}
              // Tags live in a server component, so a refresh is what makes an
              // added or removed tag appear.
              onChanged={() => router.refresh()}
            />
          )}
        />
      )}
    </>
  );
}
