import { ImagePlus } from "lucide-react";

import { CreateMemoryButton } from "./create-memory";
import { MemoryCard } from "@/components/memory-card";
import { listOwnedMemories } from "@/lib/memories";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Memories" };
export const dynamic = "force-dynamic";

/** FR-MEM-3/4/8 — the user's memories, newest first, with cover and count. */
export default async function MemoriesPage() {
  const user = await requireProfile();
  const memories = await listOwnedMemories(user.id);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-display text-[30px] font-bold text-ink">
          Memories
        </h1>
        {memories.length > 0 && <CreateMemoryButton />}
      </div>

      {memories.length === 0 ? (
        <div className="glass mt-6 flex flex-col items-center rounded-[26px] px-6 py-12 text-center">
          <ImagePlus size={40} className="text-purple-l" aria-hidden="true" />
          <h2 className="mt-4 font-display text-[19px] font-semibold text-ink">
            No memories yet
          </h2>
          <p className="mt-1.5 max-w-[340px] text-[13px] text-muted-foreground">
            Create your first album and drop in the photos from a day you want to
            keep.
          </p>
          <div className="mt-5">
            <CreateMemoryButton />
          </div>
        </div>
      ) : (
        // auto-fill/minmax so the grid reflows without fixed columns
        // (style guide §9 Responsive).
        <div
          className="mt-6 grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          }}
        >
          {memories.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
        </div>
      )}
    </>
  );
}
