import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuestUploader } from "./guest-uploader";
import { PublicGallery } from "./public-gallery";
import { Wordmark } from "@/components/wordmark";
import { getPublicMemory } from "@/lib/access";
import { formatMemoryDate, photoCountLabel } from "@/lib/format";
import { listMemoryPhotos } from "@/lib/memories";

/*
 * PUBLIC GUEST ALBUM — FR-SHARE-8/9, plan §2C.
 *
 * This is the ONLY unauthenticated data path in the application.
 *
 * Rules it must keep, permanently:
 *   - server component only; no auth session is consulted
 *   - reads via getPublicMemory(), which selects strictly by public_token AND
 *     public_link_active, and cannot be passed a memory id or a user id
 *   - returns exactly one memory, read-only
 *   - never links to, or reveals the existence of, the owner's other memories
 *   - no privileged credentials reach the browser
 *
 * `proxy.ts` deliberately does not match /m/* — gating this route would break
 * the entire public-link feature.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/m/[token]">): Promise<Metadata> {
  const { token } = await params;
  const memory = await getPublicMemory(token);

  return {
    title: memory ? `${memory.title} · Memories` : "Memories",
    /*
     * A public link is unlisted, not private (NFR-PRIV §5.5). Letting search
     * engines index it would quietly convert "anyone with the link" into
     * "anyone at all", which is not what the owner agreed to.
     */
    robots: { index: false, follow: false },
  };
}

export default async function PublicMemoryPage({
  params,
}: PageProps<"/m/[token]">) {
  const { token } = await params;

  const memory = await getPublicMemory(token);
  // A revoked link and a made-up token are the same answer: nothing here.
  if (!memory) notFound();

  const photos = await listMemoryPhotos(memory.id);

  return (
    <main className="flex-1 px-[22px] py-[26px]">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-5 flex items-center">
          <Wordmark size="nav" />
        </header>

        <div className="glass mb-5 rounded-2xl p-[22px]">
          <h1 className="font-display text-[30px] font-bold text-ink">
            {memory.title}
          </h1>
          <p className="mt-0.5 text-[15px] font-bold text-orange-d">
            ({formatMemoryDate(memory.memoryDate)})
          </p>
          <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">
            {photoCountLabel(photos.length)} · shared album
          </p>
        </div>

        {/*
          D21 — only when the owner opted in. The server re-checks the flag on
          every upload, so rendering this is a convenience, not the gate.
        */}
        {memory.publicCanContribute && <GuestUploader token={token} />}

        <PublicGallery photos={photos} />

        <p className="mt-8 text-center text-[12.5px] text-muted-foreground">
          Shared with you from Memories.
        </p>
      </div>
    </main>
  );
}
