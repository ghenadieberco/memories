import { ImagePlus, Plus } from "lucide-react";

export const metadata = { title: "Memories" };

/*
 * Phase 1 delivers the empty Memories view — its acceptance criterion is
 * "reach an empty Memories page" after signing in. Phase 2 replaces this with
 * the real memory grid, creation modal, and "Shared with me" tab.
 */
export default function MemoriesPage() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-display text-[30px] font-bold text-ink">
          Memories
        </h1>
        <button type="button" className="btn primary" disabled>
          <Plus size={15} aria-hidden="true" />
          Create memory
        </button>
      </div>

      <div className="glass mt-6 flex flex-col items-center rounded-[26px] px-6 py-12 text-center">
        <ImagePlus size={40} className="text-purple-l" aria-hidden="true" />
        <h2 className="mt-4 font-display text-[19px] font-semibold text-ink">
          No memories yet
        </h2>
        <p className="mt-1.5 max-w-[340px] text-[13px] text-muted-foreground">
          Create your first album and drop in the photos from a day you want to
          keep.
        </p>
        <p className="mt-5 text-[12.5px] font-semibold text-muted-foreground">
          Creating memories arrives in the next phase.
        </p>
      </div>
    </>
  );
}
