"use client";

import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { MemoryPhoto } from "@/lib/memories";

/*
 * Fullscreen viewer — FR-VIEW-3..7, style guide §6 "Thumbnails & viewer".
 *
 * Hand-built rather than yet-another-react-lightbox (D18): the requirements
 * need only prev/next/close with no wraparound, and the style guide specifies
 * the look precisely.
 *
 * Rendered as an overlay over the grid rather than a route, so closing returns
 * the user to their exact scroll position for free (FR-VIEW-6).
 */
export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: MemoryPhoto[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const atFirst = index <= 0;
  const atLast = index >= photos.length - 1;

  // D7 / FR-VIEW-5: stop at the ends, never wrap.
  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index < photos.length - 1) onIndexChange(index + 1);
  }, [index, photos.length, onIndexChange]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [goPrev, goNext, onClose]);

  // NFR-PERF: warm the neighbours so paging feels instant. Creating an Image()
  // is enough to get them into the browser cache.
  useEffect(() => {
    for (const neighbour of [photos[index + 1], photos[index - 1]]) {
      if (neighbour) {
        const preload = new window.Image();
        preload.src = neighbour.url;
      }
    }
  }, [index, photos]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-4"
      style={{ background: "rgba(30,16,54,.72)", backdropFilter: "blur(16px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close viewer"
        className="absolute top-5 right-5 grid size-11 place-items-center rounded-full text-white"
        style={{ background: "rgba(255,255,255,.16)" }}
      >
        <X size={20} aria-hidden="true" />
      </button>

      {/*
        The controls OVERLAY the image rather than sitting beside it.
        Laying them out in a row cost ~110px of horizontal space, so on a phone
        the image at 78vw pushed the "next" control off-screen entirely — the
        viewer looked one-directional. Overlaying is also the conventional
        lightbox pattern, and it keeps the image as large as possible.
      */}
      <div className="relative flex max-w-full items-center justify-center">
        {/* FR-VIEW-7: fit to screen, aspect preserved. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- CDN-direct by design */}
        <img
          src={photo.url}
          alt=""
          className="rounded-lg object-contain"
          style={{
            maxWidth: "min(92vw, 760px)",
            maxHeight: "72vh",
            boxShadow: "0 24px 60px rgba(0,0,0,.4)",
          }}
        />

        <div className="absolute inset-y-0 left-1 flex items-center sm:-left-14">
          <ViewerNav direction="prev" disabled={atFirst} onClick={goPrev} />
        </div>
        <div className="absolute inset-y-0 right-1 flex items-center sm:-right-14">
          <ViewerNav direction="next" disabled={atLast} onClick={goNext} />
        </div>
      </div>

      <p className="font-display text-[15px] font-semibold text-white">
        {index + 1} / {photos.length}
      </p>
    </div>
  );
}

/** Circular translucent control; dims to .28 at the ends (style guide §6). */
function ViewerNav({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous photo" : "Next photo"}
      className="grid size-11 shrink-0 place-items-center rounded-full text-white backdrop-blur-sm transition-opacity"
      style={{
        // Darker than the .16 white used elsewhere: these now sit ON the photo,
        // where a translucent white disc can vanish against a bright image.
        background: "rgba(20,10,36,.55)",
        opacity: disabled ? 0.28 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Icon size={22} aria-hidden="true" />
    </button>
  );
}
