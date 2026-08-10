import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MemoryActions } from "./memory-actions";
import { PhotoGrid } from "./photo-grid";
import { SharePanel } from "./share-panel";
import { AccessDeniedError } from "@/lib/access";
import { appEnv } from "@/lib/env";
import { formatMemoryDate, photoCountLabel } from "@/lib/format";
import { getMemoryDetail } from "@/lib/memories";
import { requireProfile } from "@/lib/profile";
import { listMembers } from "@/lib/sharing";

export const dynamic = "force-dynamic";

/** FR-MEM-5 — open a memory and see its photos. */
export default async function MemoryDetailPage({
  params,
}: PageProps<"/memories/[id]">) {
  const { id } = await params;
  const user = await requireProfile();

  let detail;
  try {
    detail = await getMemoryDetail(user.id, id);
  } catch (error) {
    // Access denied and "doesn't exist" are the same outward answer, so a
    // stranger can't probe which memory ids are real (NFR-SEC).
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }
  if (!detail) notFound();

  const { memory, photos, canEdit, canAddPhotos } = detail;

  // FR-SHARE-4/7: the owner sees members and the public link; everyone else
  // sees neither, and never learns the token.
  const members = canEdit ? await listMembers(memory.id) : [];
  const publicUrl = `${appEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/m/${memory.publicToken}`;

  return (
    <>
      <Link
        href="/memories"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-purple"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        All memories
      </Link>

      <div className="glass mb-5 flex flex-wrap items-center gap-3 rounded-2xl p-[22px]">
        <div className="min-w-0 flex-1">
          {/* FR-MEM-2: Title - (Formatted Date), date in orange. */}
          <h1 className="truncate font-display text-[30px] font-bold text-ink">
            {memory.title}
          </h1>
          <p className="mt-0.5 text-[15px] font-bold text-orange-d">
            ({formatMemoryDate(memory.memoryDate)})
          </p>
          <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
            {photoCountLabel(photos.length)}
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <SharePanel
              memoryId={memory.id}
              members={members}
              publicUrl={publicUrl}
              publicLinkActive={memory.publicLinkActive}
            />
            <MemoryActions
              memoryId={memory.id}
              title={memory.title}
              memoryDate={memory.memoryDate}
              hasCustomCover={memory.coverSource !== "auto"}
            />
          </div>
        )}
      </div>

      <PhotoGrid
        memoryId={memory.id}
        photos={photos}
        canAddPhotos={canAddPhotos}
        canSetCover={canEdit}
        currentUserId={user.id}
        isOwner={canEdit}
      />
    </>
  );
}
