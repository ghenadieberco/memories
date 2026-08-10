import { Play } from "lucide-react";

import { formatDuration } from "@/lib/video";
import type { MemoryPhoto } from "@/lib/memories";

/*
 * The "this is a video" affordance on a grid tile — FR-VIDEO-4.
 *
 * A video's tile shows its poster frame, which on its own is indistinguishable
 * from a photo. Without this, the only way to find out is to click. The play
 * glyph carries the meaning and the duration confirms it.
 *
 * Purple, per the style guide's rule that purple leads and orange is reserved
 * for dates, the camera glyph, the active toggle, and the contributor pill —
 * a play badge is none of those.
 */
export function VideoBadge({ photo }: { photo: MemoryPhoto }) {
  if (photo.mediaType !== "video") return null;

  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      <span
        className="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white"
        style={{ background: "rgba(122,47,242,.82)" }}
      >
        {/* Nudged right: a triangle's optical centre sits left of its box. */}
        <Play size={16} fill="currentColor" className="ml-0.5" />
      </span>

      {photo.durationSeconds !== null && (
        <span
          className="absolute right-1.5 bottom-1.5 rounded px-1.5 py-0.5 font-display text-[11px] font-semibold text-white tabular-nums"
          style={{ background: "rgba(20,10,36,.72)" }}
        >
          {formatDuration(photo.durationSeconds)}
        </span>
      )}
    </span>
  );
}
