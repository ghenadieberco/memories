import { NextResponse } from "next/server";
import { z } from "zod";

import { photos } from "@/db/schema";
import {
  AccessDeniedError,
  assertCanContribute,
  getPublicMemoryForContribution,
} from "@/lib/access";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES, UnsupportedImageError, processImage } from "@/lib/image";
import { getSessionUser } from "@/lib/profile";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { photoKey, putObject, randomKeySegment } from "@/lib/storage";

/*
 * Photo upload (FR-PHOTO-1..5, NFR-OPT, plan §2A).
 *
 * TWO ways in:
 *   1. Signed in  — `memoryId`, authorised by assertCanContribute (owner or
 *      contributor).
 *   2. Guest      — `token`, allowed only when the owner has switched on guest
 *      contributions for that memory (D21). Rate-limited, and the resulting row
 *      has `uploaded_by = NULL` because there is no account behind it.
 *
 * ONE FILE PER REQUEST, by design. The client sends them a couple at a time and
 * reports per-file success/failure (FR-PHOTO-5). Batching twenty 25MB files
 * into a single multipart body would mean holding all of them plus their sharp
 * working buffers in a 1GB VM.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// sharp on a large image is not a 10-second operation.
export const maxDuration = 60;

/** Guest uploads per IP per window. Generous for a family, hostile to a script. */
const GUEST_UPLOAD_LIMIT = 12;
const GUEST_WINDOW_MS = 10 * 60 * 1000;

const targetSchema = z
  .object({
    memoryId: z.string().uuid().optional(),
    token: z.string().min(1).optional(),
  })
  .refine((value) => value.memoryId || value.token, {
    message: "Missing memory.",
  });

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "That upload was malformed." }, { status: 400 });
  }

  const parsedTarget = targetSchema.safeParse({
    memoryId: form.get("memoryId") ?? undefined,
    token: form.get("token") ?? undefined,
  });
  if (!parsedTarget.success) {
    return NextResponse.json({ error: "Missing memory." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `${file.name} is over 25 MB.` }, { status: 413 });
  }

  const { memoryId: requestedMemoryId, token } = parsedTarget.data;

  let memoryId: string;
  let uploadedBy: string | null;

  if (token) {
    /*
     * --- GUEST PATH (D21) ---
     * No session is consulted. Authorization is entirely "does this exact token
     * belong to a memory whose owner opted in", and nothing else is trusted
     * from the request.
     */
    const limit = rateLimit(
      `guest-upload:${clientKey(request)}`,
      GUEST_UPLOAD_LIMIT,
      GUEST_WINDOW_MS,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "That's a lot of photos at once. Try again in a few minutes." },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
      );
    }

    const memory = await getPublicMemoryForContribution(token);
    // Wrong token, revoked link, or contributions switched off — same answer.
    if (!memory) {
      return NextResponse.json({ error: "That album isn't accepting photos." }, { status: 404 });
    }

    memoryId = memory.id;
    uploadedBy = null;
  } else {
    // --- SIGNED-IN PATH ---
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    memoryId = requestedMemoryId!;
    uploadedBy = user.id;

    // Owner or contributor only (FR-SHARE-2), checked BEFORE any expensive work.
    try {
      await assertCanContribute(user.id, memoryId);
    } catch (error) {
      if (error instanceof AccessDeniedError) {
        return NextResponse.json({ error: "That memory isn't available." }, { status: 404 });
      }
      throw error;
    }
  }

  let processed;
  try {
    processed = await processImage(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof UnsupportedImageError) {
      return NextResponse.json({ error: error.message }, { status: 415 });
    }
    console.error("[photos] processing failed", error);
    return NextResponse.json(
      { error: `We couldn't process ${file.name}.` },
      { status: 500 },
    );
  }

  // One random segment shared by both variants keeps them adjacent in the
  // bucket while staying unguessable.
  const segment = randomKeySegment();
  const storageKey = photoKey(memoryId, "full", segment);
  const thumbnailKey = photoKey(memoryId, "thumb", segment);

  try {
    await Promise.all([
      putObject(storageKey, processed.optimized, processed.mimeType),
      putObject(thumbnailKey, processed.thumbnail, processed.mimeType),
    ]);
  } catch (error) {
    console.error("[photos] storage upload failed", error);
    return NextResponse.json({ error: `We couldn't store ${file.name}.` }, { status: 502 });
  }

  try {
    const [row] = await db
      .insert(photos)
      .values({
        memoryId,
        uploadedBy,
        storageKey,
        thumbnailKey,
        originalFilename: file.name.slice(0, 255),
        mimeType: processed.mimeType,
        width: processed.width,
        height: processed.height,
        optimizedSizeBytes: processed.optimizedSizeBytes,
        originalSizeBytes: processed.originalSizeBytes,
        takenAt: processed.takenAt,
        status: "ready",
      })
      .returning({ id: photos.id });

    return NextResponse.json({
      id: row.id,
      name: file.name,
      // Useful signal that optimization actually did something (NFR-OPT).
      originalSizeBytes: processed.originalSizeBytes,
      optimizedSizeBytes: processed.optimizedSizeBytes,
    });
  } catch (error) {
    // The objects are already in storage; without a row nothing will ever
    // reference them, so clean up rather than leave paid-for orphans.
    console.error("[photos] insert failed, removing uploaded objects", error);
    const { deleteObjects } = await import("@/lib/storage");
    await deleteObjects([storageKey, thumbnailKey]).catch(() => undefined);
    return NextResponse.json({ error: `We couldn't save ${file.name}.` }, { status: 500 });
  }
}
