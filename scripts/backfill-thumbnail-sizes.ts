import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { eq, isNull } from "drizzle-orm";

import { photos } from "@/db/schema";
import { db } from "@/lib/db";
import { storageEnv } from "@/lib/env";
import { s3 } from "@/lib/storage";

/*
 * One-off backfill for `photos.thumbnail_size_bytes` (FR-QUOTA-3, plan §7c).
 *
 * WHY THIS EXISTS: the quota counts the full-size asset plus its thumbnail,
 * because both are really in the bucket. Every row written before Phase 7
 * recorded only the first — `optimized_size_bytes` never included the
 * thumbnail. Measured on live data that is 198 KB recorded against a 13 KB
 * thumbnail ignored, so an un-backfilled database undercounts by ~6.6%.
 *
 * The column is nullable and the usage query coalesces, so rows this hasn't
 * reached yet undercount rather than break. That makes the script safely
 * re-runnable and safe to interrupt: it only ever looks at rows still null, and
 * writes each one independently.
 *
 * It reads sizes with HEAD rather than downloading anything — Class B requests,
 * fractions of a cent for the whole table.
 *
 *   npx tsx scripts/backfill-thumbnail-sizes.ts
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fine when the secrets are already in the environment
}

async function main() {
  const { S3_BUCKET } = storageEnv();
  const client = s3();

  const pending = await db
    .select({ id: photos.id, thumbnailKey: photos.thumbnailKey })
    .from(photos)
    .where(isNull(photos.thumbnailSizeBytes));

  if (pending.length === 0) {
    console.log("Nothing to backfill — every row already has a thumbnail size.");
    return;
  }

  console.log(`Backfilling ${pending.length} row(s)…`);

  let filled = 0;
  let missing = 0;

  for (const row of pending) {
    let size: number | undefined;

    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: S3_BUCKET, Key: row.thumbnailKey }),
      );
      size = head.ContentLength;
    } catch (error) {
      /*
       * A thumbnail that isn't there is a pre-existing orphan, not a failure of
       * this script. Leave the column null — the row keeps undercounting by one
       * thumbnail, which is the honest outcome for bytes that aren't billed
       * because they don't exist.
       */
      missing += 1;
      console.warn(`  ! ${row.thumbnailKey} — ${(error as Error).name}`);
      continue;
    }

    if (typeof size !== "number") {
      missing += 1;
      continue;
    }

    await db
      .update(photos)
      .set({ thumbnailSizeBytes: size })
      .where(eq(photos.id, row.id));

    filled += 1;
  }

  console.log(`Done. ${filled} filled, ${missing} skipped.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
