"use client";

import { useState } from "react";
import { CheckSquare, Square, X } from "lucide-react";

import { DownloadButton } from "@/components/download-button";
import { PhotoViewer } from "@/components/photo-viewer";
import { VideoBadge } from "@/components/video-badge";
import { archiveNameFor } from "@/lib/download";
import type { MemoryPhoto } from "@/lib/memories";

/*
 * Guest gallery (FR-SHARE-8/9, FR-DL-5, FR-VIDEO-2/4).
 *
 * Grid, viewer, and download. There is deliberately no upload control here, no
 * cover control, and no delete — not hidden, absent. A guest has no session, so
 * there is nothing for such a control to act on and nothing to forge.
 *
 * DOWNLOAD IS ALLOWED FOR GUESTS, by the owner's decision (D24), amending
 * FR-SHARE-9's "view-only". It stays a read: the archive is assembled in the
 * visitor's own browser from the CDN URLs this page already handed them, so
 * download reaches no further than the page itself does. Revoking the link
 * still cuts off everything, since the page stops rendering at all.
 *
 * Select mode exists here only to choose what to download — the same gesture
 * the owner uses, minus the destructive half of its toolbar.
 */
export function PublicGallery({
  photos,
  memoryTitle,
  memoryDate,
}: {
  photos: MemoryPhoto[];
  memoryTitle: string;
  memoryDate: string;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelected(photoId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  if (photos.length === 0) {
    return (
      <div className="glass flex flex-col items-center rounded-2xl px-6 py-12 text-center">
        <p className="text-[13px] text-muted-foreground">
          Nothing has been added to this memory yet.
        </p>
      </div>
    );
  }

  const archiveName = archiveNameFor(memoryTitle, memoryDate);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {selectMode ? (
          <>
            <span className="text-[13px] font-bold text-ink">
              {selected.size} selected
            </span>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() =>
                setSelected(
                  selected.size === photos.length
                    ? new Set()
                    : new Set(photos.map((photo) => photo.id)),
                )
              }
            >
              {selected.size === photos.length ? "Clear all" : "Select all"}
            </button>
            <DownloadButton
              photos={photos.filter((photo) => selected.has(photo.id))}
              archiveName={archiveName}
              label={`Download ${selected.size > 0 ? selected.size : ""}`.trim()}
            />
            <button type="button" className="btn ghost sm" onClick={exitSelectMode}>
              <X size={15} aria-hidden="true" />
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setSelectMode(true)}
            >
              <CheckSquare size={15} aria-hidden="true" />
              Select
            </button>
            <DownloadButton
              photos={photos}
              archiveName={archiveName}
              label="Download all"
            />
          </>
        )}
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
      >
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative">
            <button
              type="button"
              onClick={() =>
                selectMode ? toggleSelected(photo.id) : setViewerIndex(index)
              }
              className="block aspect-square w-full overflow-hidden rounded-lg transition-transform duration-150 hover:scale-[1.035]"
              style={{
                boxShadow: "0 6px 18px rgba(108,43,217,.14)",
                outline: selected.has(photo.id) ? "3px solid var(--purple)" : undefined,
                outlineOffset: selected.has(photo.id) ? "2px" : undefined,
              }}
              aria-label={
                selectMode
                  ? `${selected.has(photo.id) ? "Deselect" : "Select"} ${photo.mediaType} ${index + 1}`
                  : `Open ${photo.mediaType} ${index + 1}`
              }
              aria-pressed={selectMode ? selected.has(photo.id) : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- CDN-direct by design */}
              <img
                src={photo.thumbnailUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <VideoBadge photo={photo} />
            </button>

            {selectMode && (
              <span
                className="pointer-events-none absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-md text-white"
                style={{
                  background: selected.has(photo.id) ? "var(--purple)" : "rgba(0,0,0,.42)",
                }}
                aria-hidden="true"
              >
                {selected.has(photo.id) ? <CheckSquare size={14} /> : <Square size={14} />}
              </span>
            )}
          </div>
        ))}
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
