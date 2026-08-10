import { PutBucketCorsCommand } from "@aws-sdk/client-s3";

import { appEnv, storageEnv } from "@/lib/env";
import { s3 } from "@/lib/storage";

/*
 * One-off bucket setup for downloads (FR-DL-5, D24).
 *
 * WHY THIS EXISTS: photos and videos are displayed straight from the storage
 * CDN, and an <img> or <video> tag needs no permission to load a cross-origin
 * file. Reading those same bytes with `fetch` — which is what building a zip in
 * the browser requires — does. Without a CORS rule the browser blocks the read,
 * and download fails while everything else keeps working, which is a confusing
 * failure to debug after the fact.
 *
 * WHAT IT GRANTS: GET and HEAD from this app's own origin. Nothing else. This
 * does not make the bucket more public than it already is — the objects are
 * already world-readable by URL (that is how the CDN serves them, and the
 * "unlisted, not private" model in NFR-PRIV §5.5). It only lets scripts on our
 * own page read a file the browser would happily have rendered anyway.
 *
 * ORIGINS. Extra origins may be passed as arguments, and they matter more than
 * they look: `NEXT_PUBLIC_APP_URL` in a developer's `.env.local` is
 * `http://localhost:3000`, so running this with no arguments authorises
 * development and *not* production. The bucket is shared between the two, and
 * `PutBucketCors` replaces the whole rule set rather than adding to it — so the
 * production origin has to be named every time this is run.
 *
 *   npm run storage:cors -- https://memories.ghenadie-berco.com
 *
 * Run once per bucket, and again whenever an origin changes.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fine when the secrets are already in the environment
}

async function main() {
  const { S3_BUCKET } = storageEnv();
  const appUrl = appEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  const extra = process.argv.slice(2).map((origin) => origin.replace(/\/+$/, ""));
  for (const origin of extra) {
    if (!/^https?:\/\//.test(origin)) {
      console.error(`Not an origin: ${origin} (expected http:// or https://)`);
      process.exit(1);
    }
  }

  /*
   * localhost is included so downloads can be exercised in development. It is a
   * safe entry: an origin allowed to read a URL it must already possess grants
   * nothing to anyone who doesn't have that URL.
   */
  const origins = Array.from(
    new Set([appUrl, ...extra, "http://localhost:3000", "http://127.0.0.1:3000"]),
  );

  await s3().send(
    new PutBucketCorsCommand({
      Bucket: S3_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            // Read-only. Writes to this bucket happen server-side with
            // credentials that never reach a browser.
            AllowedMethods: ["GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["Content-Length", "Content-Type"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  console.log(`CORS set on ${S3_BUCKET} for:`);
  for (const origin of origins) console.log(`  - ${origin}`);
}

main().catch((error) => {
  console.error("Failed to set bucket CORS:", error);
  process.exit(1);
});
