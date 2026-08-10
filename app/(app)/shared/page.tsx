import { Users } from "lucide-react";

import { MemoryCard } from "@/components/memory-card";
import { MemoryTabs } from "@/components/memory-tabs";
import { requireProfile } from "@/lib/profile";
import { listSharedMemories } from "@/lib/sharing";

export const metadata = { title: "Shared with me · Memories" };
export const dynamic = "force-dynamic";

/** FR-SHARE-3 — memories other people have shared, kept separate from your own. */
export default async function SharedPage() {
  const user = await requireProfile();
  const shared = await listSharedMemories(user.id);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-display text-[30px] font-bold text-ink">
          Shared with me
        </h1>
      </div>

      <div className="mt-4">
        <MemoryTabs active="shared" />
      </div>

      {shared.length === 0 ? (
        <div className="glass mt-6 flex flex-col items-center rounded-2xl px-6 py-12 text-center">
          <Users size={40} className="text-purple-l" aria-hidden="true" />
          <h2 className="mt-4 font-display text-[19px] font-semibold text-ink">
            Nothing shared yet
          </h2>
          <p className="mt-1.5 max-w-[340px] text-[13px] text-muted-foreground">
            When someone shares a memory with you, it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <div
          className="mt-6 grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
        >
          {shared.map((memory) => (
            <div key={memory.id}>
              <MemoryCard memory={memory} />
              <p className="mt-1.5 px-1 text-[12.5px] font-semibold text-muted-foreground">
                Shared by {memory.sharedBy}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
