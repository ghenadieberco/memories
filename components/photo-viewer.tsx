"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  X,
} from "lucide-react";

import { downloadSingle } from "@/lib/download";
import type { MemoryPhoto } from "@/lib/memories";

/*
 * Fullscreen viewer — FR-VIEW-3..9, FR-VIDEO-2, FR-DL-1, style guide §6.
 *
 * Hand-built rather than yet-another-react-lightbox (D18): the requirements
 * need only prev/next/close with no wraparound, and the style guide specifies
 * the look precisely.
 *
 * Rendered as an overlay over the grid rather than a route, so closing returns
 * the user to their exact scroll position for free (FR-VIEW-6).
 *
 * LAYOUT (FR-VIEW-8). The viewer is a column: a control row, then the media
 * filling everything left over, then the counter. The media's height is bounded
 * by `max-height: 100%` against that middle row rather than by a `vh` figure,
 * which is what lets it grow to the full viewport without the counter or the
 * controls ever being pushed off-screen — the failure mode a fixed `86vh` cap
 * produces on a short window.
 *
 * ZOOM (FR-VIEW-9) IS FOR IMAGES ONLY. A <video> renders its own controls, and
 * putting a transform on it means dragging the scrubber moves the video
 * instead. Video gets playback; images get zoom.
 */

/** Zoom bounds. 1 is fit-to-screen — never smaller, so there is always a floor. */
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.4;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

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

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * True for the duration of a pan or pinch.
   *
   * Only exists to switch the CSS transition off while a gesture is in
   * progress — an eased transform lags a finger badly. Set once per gesture
   * rather than per move, so it costs two renders, not one per pointer event.
   */
  const [gesturing, setGesturing] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement>(null);
  /** Live pointers, so two of them can be read as a pinch. */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistanceRef = useRef<number | null>(null);
  /** Distinguishes a drag from a click, so panning never closes the viewer. */
  const draggedRef = useRef(false);

  const photo = photos[index];
  const isVideo = photo?.mediaType === "video";
  const canZoom = Boolean(photo) && !isVideo;

  // D7 / FR-VIEW-5: stop at the ends, never wrap.
  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index < photos.length - 1) onIndexChange(index + 1);
  }, [index, photos.length, onIndexChange]);

  /**
   * Keep the image's edges from being dragged inside the frame.
   *
   * Measured from `offsetWidth`, which is the laid-out size and is unaffected by
   * the CSS transform — reading a `getBoundingClientRect` here would feed the
   * current scale back into its own limit and drift on every move.
   */
  const clampOffset = useCallback(
    (next: { x: number; y: number }, atScale: number) => {
      const media = mediaRef.current;
      const stage = stageRef.current;
      if (!media || !stage) return next;

      const slackX = Math.max(0, (media.offsetWidth * atScale - stage.clientWidth) / 2);
      const slackY = Math.max(
        0,
        (media.offsetHeight * atScale - stage.clientHeight) / 2,
      );

      return {
        x: clamp(next.x, -slackX, slackX),
        y: clamp(next.y, -slackY, slackY),
      };
    },
    [],
  );

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  /**
   * Zoom about a fixed point.
   *
   * `anchor` is measured from the centre of the stage. Holding the point under
   * the cursor still means the offset has to move with the scale, otherwise
   * zooming always creeps toward the middle of the picture.
   */
  const zoomAbout = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      setScale((previous) => {
        const next = clamp(previous * factor, MIN_SCALE, MAX_SCALE);
        if (next === previous) return previous;

        if (next === MIN_SCALE) {
          setOffset({ x: 0, y: 0 });
          return next;
        }

        setOffset((current) => {
          const point = anchor ?? { x: 0, y: 0 };
          const ratio = next / previous;
          return clampOffset(
            {
              x: point.x - (point.x - current.x) * ratio,
              y: point.y - (point.y - current.y) * ratio,
            },
            next,
          );
        });

        return next;
      });
    },
    [clampOffset],
  );

  /*
   * A new photo starts fit-to-screen; carrying zoom across is disorienting.
   *
   * Remembered by id rather than by index, because the two come apart: deleting
   * an item out from under an open viewer puts a different photo at the same
   * index, and an index-keyed check would hand it the previous one's zoom.
   *
   * Adjusted during render rather than in an effect: React re-renders before
   * painting, so the next photo is never briefly shown at the previous one's
   * zoom — which is exactly the flash an effect would produce here.
   */
  const [renderedId, setRenderedId] = useState(photo?.id);
  if (renderedId !== photo?.id) {
    setRenderedId(photo?.id);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setError(null);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      /*
       * A focused <video> owns the arrow keys for seeking and the space bar for
       * play/pause. Stealing them to change photo mid-playback is the wrong
       * answer, so navigation keys are ignored while the video has focus.
       */
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "VIDEO") return;

      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();

      if (!canZoom) return;
      if (event.key === "+" || event.key === "=") zoomAbout(ZOOM_STEP);
      if (event.key === "-" || event.key === "_") zoomAbout(1 / ZOOM_STEP);
      if (event.key === "0") resetZoom();
    };
    window.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [goPrev, goNext, onClose, canZoom, zoomAbout, resetZoom]);

  /*
   * NFR-PERF: warm the neighbours so paging feels instant. Only images — a
   * video neighbour is up to 100 MB (D23), and prefetching that to save a
   * moment of buffering is a bad trade on a phone's data plan.
   */
  useEffect(() => {
    for (const neighbour of [photos[index + 1], photos[index - 1]]) {
      if (neighbour && neighbour.mediaType === "image") {
        const preload = new window.Image();
        preload.src = neighbour.url;
      }
    }
  }, [index, photos]);

  /*
   * Wheel zoom. Registered natively because React's onWheel is passive, and a
   * passive listener cannot preventDefault — without which the browser zooms
   * the whole page on a trackpad pinch instead.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !canZoom) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      zoomAbout(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      });
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [canZoom, zoomAbout]);

  async function download() {
    if (!photo) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadSingle(photo);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  function onPointerDown(event: React.PointerEvent) {
    if (!canZoom) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    draggedRef.current = false;
    setGesturing(true);
    if (pointersRef.current.size === 1 && scale > MIN_SCALE) {
      (event.target as Element).setPointerCapture?.(event.pointerId);
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!canZoom) return;
    const pointers = pointersRef.current;
    const previous = pointers.get(event.pointerId);
    if (!previous) return;

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Two fingers: pinch. Scale by how much the gap changed since the last move.
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const last = pinchDistanceRef.current;
      pinchDistanceRef.current = distance;

      if (last && last > 0) {
        const stage = stageRef.current;
        const rect = stage?.getBoundingClientRect();
        zoomAbout(
          distance / last,
          rect
            ? {
                x: (a.x + b.x) / 2 - rect.left - rect.width / 2,
                y: (a.y + b.y) / 2 - rect.top - rect.height / 2,
              }
            : undefined,
        );
      }
      draggedRef.current = true;
      return;
    }

    // One finger or the mouse: pan, but only when there is something to pan to.
    if (pointers.size === 1 && scale > MIN_SCALE) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (dx || dy) draggedRef.current = true;
      setOffset((current) =>
        clampOffset({ x: current.x + dx, y: current.y + dy }, scale),
      );
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchDistanceRef.current = null;
    if (pointersRef.current.size === 0) setGesturing(false);
  }

  /** Click the backdrop to close — but a pan that ends on it is not a click. */
  function onBackdropClick(event: React.MouseEvent) {
    if (event.target !== event.currentTarget) return;
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onClose();
  }

  if (!photo) return null;

  const zoomed = scale > MIN_SCALE;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col gap-2 p-3 sm:p-4"
      style={{ background: "rgba(30,16,54,.72)", backdropFilter: "blur(16px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${isVideo ? "Video" : "Photo"} ${index + 1} of ${photos.length}`}
      onClick={onBackdropClick}
    >
      {/* Control row. Sits in the column rather than floating over the media, so
          a full-height image can never end up underneath it. */}
      <div className="flex shrink-0 items-center justify-end gap-2">
        <ViewerButton
          onClick={download}
          disabled={downloading}
          label={isVideo ? "Download video" : "Download photo"}
        >
          {downloading ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Download size={18} aria-hidden="true" />
          )}
        </ViewerButton>

        <ViewerButton onClick={onClose} label="Close viewer">
          <X size={20} aria-hidden="true" />
        </ViewerButton>
      </div>

      <div
        ref={stageRef}
        className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden"
        onClick={onBackdropClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // NOTE: double-click-to-zoom deliberately lives on the <img>, not here.
        // The prev/next arrows are children of this stage, so a dblclick on them
        // bubbles up — paging quickly by double-clicking an arrow used to land
        // on the next photo at 200%, since the zoom ran after the index change
        // had already reset the scale to fit.
        // Without this the browser's own pan/zoom gestures win on touch and the
        // pointer events never arrive.
        style={{ touchAction: canZoom ? "none" : "auto" }}
      >
        {isVideo ? (
          /* FR-VIDEO-2 — plays in place, with the poster frame as its still.
             Keyed by id so navigating away unmounts the element and stops
             playback rather than leaving audio running behind the next photo. */
          <video
            key={photo.id}
            src={photo.url}
            poster={photo.thumbnailUrl}
            controls
            playsInline
            preload="metadata"
            className="rounded-lg"
            style={{
              maxWidth: "min(96vw, 1600px)",
              maxHeight: "100%",
              boxShadow: "0 24px 60px rgba(0,0,0,.4)",
            }}
          />
        ) : (
          /* FR-VIEW-7/8: fit to screen, aspect preserved, and never upscaled at
             rest — an <img> bounded only by max-* stops at its natural size. */
          /* eslint-disable-next-line @next/next/no-img-element -- CDN-direct by design */
          <img
            ref={mediaRef}
            src={photo.url}
            alt=""
            draggable={false}
            onDoubleClick={() => (zoomed ? resetZoom() : zoomAbout(2))}
            className="rounded-lg object-contain select-none"
            style={{
              maxWidth: "min(96vw, 1600px)",
              maxHeight: "100%",
              boxShadow: "0 24px 60px rgba(0,0,0,.4)",
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              // Only animate discrete zoom steps; animating a drag lags behind
              // the finger.
              transition: gesturing ? "none" : "transform .15s ease-out",
              cursor: zoomed ? "grab" : "default",
            }}
          />
        )}

        <div className="absolute inset-y-0 left-0 flex items-center">
          <ViewerNav direction="prev" disabled={atFirst} onClick={goPrev} />
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center">
          <ViewerNav direction="next" disabled={atLast} onClick={goNext} />
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2">
        {error && (
          <p className="text-[13px] font-semibold text-white" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          {/* FR-VIEW-9 — hidden for video, which owns its own control bar. */}
          {canZoom && (
            <div
              className="flex items-center gap-1 rounded-full p-1"
              style={{ background: "rgba(20,10,36,.55)" }}
            >
              <ZoomButton
                onClick={() => zoomAbout(1 / ZOOM_STEP)}
                disabled={scale <= MIN_SCALE}
                label="Zoom out"
              >
                <Minus size={16} aria-hidden="true" />
              </ZoomButton>

              <button
                type="button"
                onClick={resetZoom}
                disabled={!zoomed}
                aria-label="Fit to screen"
                className="flex h-8 min-w-15.5 items-center justify-center gap-1 rounded-full px-2 font-display text-[13px] font-semibold text-white disabled:opacity-60"
                style={{ cursor: zoomed ? "pointer" : "default" }}
              >
                {zoomed ? (
                  <>
                    <Maximize2 size={13} aria-hidden="true" />
                    {Math.round(scale * 100)}%
                  </>
                ) : (
                  "Fit"
                )}
              </button>

              <ZoomButton
                onClick={() => zoomAbout(ZOOM_STEP)}
                disabled={scale >= MAX_SCALE}
                label="Zoom in"
              >
                <Plus size={16} aria-hidden="true" />
              </ZoomButton>
            </div>
          )}

          <p className="font-display text-[15px] font-semibold text-white">
            {index + 1} / {photos.length}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Round translucent control in the top row (style guide §6). */
function ViewerButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-11 place-items-center rounded-full text-white disabled:opacity-60"
      style={{ background: "rgba(255,255,255,.16)" }}
    >
      {children}
    </button>
  );
}

function ZoomButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-full text-white transition-opacity"
      style={{
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
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
