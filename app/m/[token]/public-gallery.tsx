"use client";

import { useState } from "react";

import { PhotoViewer } from "@/components/photo-viewer";
import type { MemoryPhoto } from "@/lib/memories";

/*
 * Guest gallery (FR-SHARE-8/9).
 *
 * Grid + viewer only. There is deliberately no upload control, no cover
 * control, no delete, no tagging — not hidden, absent. A guest has no session,
 * so there is nothing for a control to act on and nothing to forge.
 */
export function PublicGallery({ photos }: { photos: MemoryPhoto[] }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="glass flex flex-col items-center rounded-2xl px-6 py-12 text-center">
        <p className="text-[13px] text-muted-foreground">
          There are no photos in this memory yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
      >
        {photos.map((photo, index) => (
          <button
            key={photo.id}
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
