import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { formatMemoryDate, photoCountLabel } from "@/lib/format";
import type { MemoryCard as MemoryCardData } from "@/lib/memories";

/*
 * Memory card — style guide §6 Cards.
 * Glass, radius 22, 4:3 cover with a translucent count chip, meta strip below
 * with the title in Fredoka and the date in orange (FR-MEM-2).
 *
 * Plain <img>, deliberately not next/image: next/image routes through
 * /_next/image on the app server, which would proxy image bytes through Fly —
 * the exact thing the plan forbids (images must come straight from the
 * Tigris CDN). Our own pipeline already emits right-sized WebP, so there is
 * nothing for an optimizer to do.
 */
export function MemoryCard({ memory }: { memory: MemoryCardData }) {
  return (
    <Link
      href={`/memories/${memory.id}`}
      className="glass group block overflow-hidden rounded-xl transition-all duration-150 hover:-translate-y-1"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-[linear-gradient(135deg,#a06bff,#ff9a5a)]">
        {memory.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN-direct by design; see note above
          <img
            src={memory.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <ImageIcon size={28} className="text-white/70" aria-hidden="true" />
          </div>
        )}

        <span
          className="absolute right-2.5 bottom-2.5 rounded-full px-2.5 py-1 text-[12px] font-bold text-white"
          style={{ background: "rgba(0,0,0,.28)", backdropFilter: "blur(6px)" }}
        >
          {photoCountLabel(memory.photoCount)}
        </span>
      </div>

      <div className="px-3.5 py-3">
        <h3 className="truncate font-display text-[17px] font-semibold text-ink">
          {memory.title}
        </h3>
        <p className="mt-0.5 text-[13px] font-bold text-orange-d">
          ({formatMemoryDate(memory.memoryDate)})
        </p>
      </div>
    </Link>
  );
}
