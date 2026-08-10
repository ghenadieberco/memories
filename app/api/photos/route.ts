import { NextResponse } from "next/server";
import { z } from "zod";

import { photos } from "@/db/schema";
import {
  AccessDeniedError,
  assertCanContribute,
  getPublicMemoryForContribution,
} from "@/lib/access";
import { MaintenanceModeError, assertWritable } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  MAX_UPLOAD_BYTES,
  UnsupportedImageError,
  processImage,
  processPoster,
} from "@/lib/image";
import { getSessionUser } from "@/lib/profile";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { photoKey, putObject, randomKeySegment } from "@/lib/storage";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  sniffVideoFormat,
} from "@/lib/video";

/*
 * Photo and video upload (FR-PHOTO-1..5, FR-VIDEO-1..6, NFR-OPT, plan §2A).
 *
 * TWO ways in:
 *   1. Signed in  — `memoryId`, authorised by assertCanContribute (owner or
 *      contributor).
 *   2. Guest      — `token`, allowed only when the owner has switched on guest
 *      contributions for that memory (D21). Rate-limited, and the resulting row
 *      has `uploaded_by = NULL` because there is no account behind it.
 *
 * TWO kinds of media, decided here by sniffing the bytes:
 *   - image -> the mandatory sharp pipeline (NFR-OPT), original discarded (D5)
 *   - video -> stored as uploaded with a client-supplied poster frame (D23)
 *
 * GUESTS MAY NOT UPLOAD VIDEO (D23). D21 opened exactly one unauthenticated
 * write path and sized it for photos: a 25 MB cap and a per-IP rate limit. The
 * same endpoint accepting 100 MB videos from anonymous callers is a different
 * risk and a different bill, and widening it was never the opt-in the owner
 * agreed to. The check is on the server, not merely absent from the guest UI.
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

/**
 * FR-VIDEO-5 — the only client-asserted field in the whole upload.
 *
 * Absent or unparseable is fine and means "no badge"; it is never a reason to
 * reject a video that is otherwise valid.
 */
const videoMetaSchema = z.object({
  durationSeconds: z.coerce
    .number()
    .positive()
    .max(MAX_VIDEO_DURATION_SECONDS)
    .transform(Math.round)
    .optional()
    .catch(undefined),
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
  /*
   * The absolute ceiling, before we know which kind of media this is. The
   * per-type limits (25 MB image / 100 MB video) are applied after sniffing —
   * rejecting a 40 MB video here for breaking the photo cap would be wrong.
   */
  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: `${file.name} is over 100 MB.` }, { status: 413 });
  }

  const { memoryId: requestedMemoryId, token } = parsedTarget.data;
  const isGuest = Boolean(token);

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

    // Guests are never exempt from maintenance mode.
    try {
      await assertWritable(null);
    } catch (error) {
      if (error instanceof MaintenanceModeError) {
        return NextResponse.json(
          { error: "The app is paused for maintenance. Try again shortly." },
          { status: 503 },
        );
      }
      throw error;
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

    try {
      await assertWritable(user.id);
    } catch (error) {
      if (error instanceof MaintenanceModeError) {
        return NextResponse.json(
          { error: "The app is paused for maintenance. Try again shortly." },
          { status: 503 },
        );
      }
      throw error;
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

  const bytes = Buffer.from(await file.arrayBuffer());
  const video = sniffVideoFormat(bytes);

  /*
   * D23 — the guest write path stays photos-only. Checked here on the server,
   * where it is actually enforced; the guest UI simply doesn't offer video.
   */
  if (video && isGuest) {
    return NextResponse.json(
      { error: "This album takes photos from guests, not videos." },
      { status: 403 },
    );
  }
  if (!video && bytes.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `${file.name} is over 25 MB.` }, { status: 413 });
  }

  // One random segment shared by both variants keeps them adjacent in the
  // bucket while staying unguessable.
  const segment = randomKeySegment();

  /** What gets written to storage and to the row, whichever pipeline ran. */
  let stored: {
    objects: Array<{ key: string; body: Buffer; contentType: string }>;
    values: typeof photos.$inferInsert;
    originalSizeBytes: number;
    optimizedSizeBytes: number;
  };

  if (video) {
    // --- VIDEO (FR-VIDEO-1..6, D23): stored as uploaded, no transcode ---
    const poster = form.get("poster");
    if (!(poster instanceof File)) {
      /*
       * The poster is produced by decoding the video in the uploader's browser,
       * so its absence means the browser could not play the file. Storing it
       * would create an item nobody can watch, which is worse than refusing it.
       */
      return NextResponse.json(
        { error: `We couldn't read ${file.name}. Try an MP4 or WebM video.` },
        { status: 415 },
      );
    }

    let processedPoster;
    try {
      processedPoster = await processPoster(Buffer.from(await poster.arrayBuffer()));
    } catch (error) {
      if (error instanceof UnsupportedImageError) {
        return NextResponse.json({ error: error.message }, { status: 415 });
      }
      console.error("[photos] poster processing failed", error);
      return NextResponse.json(
        { error: `We couldn't process ${file.name}.` },
        { status: 500 },
      );
    }

    const { durationSeconds } = videoMetaSchema.parse({
      durationSeconds: form.get("durationSeconds") ?? undefined,
    });

    const storageKey = photoKey(memoryId, "full", segment, video.extension);
    const thumbnailKey = photoKey(memoryId, "thumb", segment);

    stored = {
      objects: [
        { key: storageKey, body: bytes, contentType: video.mimeType },
        {
          key: thumbnailKey,
          body: processedPoster.thumbnail,
          contentType: processedPoster.mimeType,
        },
      ],
      values: {
        memoryId,
        uploadedBy,
        mediaType: "video",
        storageKey,
        thumbnailKey,
        originalFilename: file.name.slice(0, 255),
        mimeType: video.mimeType,
        // The poster's pixel dimensions ARE the video's — see processPoster.
        width: processedPoster.width,
        height: processedPoster.height,
        optimizedSizeBytes: bytes.length,
        originalSizeBytes: bytes.length,
        durationSeconds: durationSeconds ?? null,
        // D23: containers don't carry a reliable capture time. Null sorts the
        // video by upload time through FR-PHOTO-7's coalesce.
        takenAt: null,
        status: "ready",
      },
      originalSizeBytes: bytes.length,
      optimizedSizeBytes: bytes.length,
    };
  } else {
    // --- IMAGE (NFR-OPT): the mandatory pipeline, original discarded (D5) ---
    let processed;
    try {
      processed = await processImage(bytes);
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

    const storageKey = photoKey(memoryId, "full", segment);
    const thumbnailKey = photoKey(memoryId, "thumb", segment);

    stored = {
      objects: [
        { key: storageKey, body: processed.optimized, contentType: processed.mimeType },
        { key: thumbnailKey, body: processed.thumbnail, contentType: processed.mimeType },
      ],
      values: {
        memoryId,
        uploadedBy,
        mediaType: "image",
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
      },
      originalSizeBytes: processed.originalSizeBytes,
      optimizedSizeBytes: processed.optimizedSizeBytes,
    };
  }

  const objectKeys = stored.objects.map((object) => object.key);

  try {
    await Promise.all(
      stored.objects.map((object) =>
        putObject(object.key, object.body, object.contentType),
      ),
    );
  } catch (error) {
    console.error("[photos] storage upload failed", error);
    return NextResponse.json({ error: `We couldn't store ${file.name}.` }, { status: 502 });
  }

  try {
    const [row] = await db
      .insert(photos)
      .values(stored.values)
      .returning({ id: photos.id });

    return NextResponse.json({
      id: row.id,
      name: file.name,
      // Useful signal that optimization actually did something (NFR-OPT).
      originalSizeBytes: stored.originalSizeBytes,
      optimizedSizeBytes: stored.optimizedSizeBytes,
    });
  } catch (error) {
    // The objects are already in storage; without a row nothing will ever
    // reference them, so clean up rather than leave paid-for orphans.
    console.error("[photos] insert failed, removing uploaded objects", error);
    const { deleteObjects } = await import("@/lib/storage");
    await deleteObjects(objectKeys).catch(() => undefined);
    return NextResponse.json({ error: `We couldn't save ${file.name}.` }, { status: 500 });
  }
}
