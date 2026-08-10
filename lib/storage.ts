import { randomBytes } from "node:crypto";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { storageEnv } from "@/lib/env";

/*
 * Object storage for photos — Tigris by default (S3-compatible), R2 works with
 * the same code and a different endpoint.
 *
 * Image bytes are ALWAYS served to browsers from `publicUrl()` (the storage
 * CDN), never proxied through this app.
 *
 * Object keys carry 128 bits of randomness so a URL cannot be guessed or walked
 * from a neighbouring one. Note what this does and does not buy: a key is
 * unguessable, but it is permanent — anyone who has seen a URL keeps access even
 * after the memory is unshared. That is the same "unlisted, not private" trust
 * model the requirements already accept for public links (NFR-PRIV §5.5).
 */

const globalForS3 = globalThis as unknown as { __memoriesS3?: S3Client };

export function s3(): S3Client {
  if (globalForS3.__memoriesS3) return globalForS3.__memoriesS3;

  const env = storageEnv();
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  globalForS3.__memoriesS3 = client;
  return client;
}

/** 32 hex chars = 128 bits. Same entropy budget as a memory's public token. */
export function randomKeySegment(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Build a storage key for a photo or video asset.
 * Shape: `memories/<memoryId>/<random>-<variant>.<ext>`
 *
 * The extension is explicit because a video's `full` object is an mp4 or webm
 * while its `thumb` (the poster) is still WebP — the two variants of one item no
 * longer share a format (FR-VIDEO-3).
 */
export function photoKey(
  memoryId: string,
  variant: "full" | "thumb",
  segment: string = randomKeySegment(),
  extension = "webp",
): string {
  return `memories/${memoryId}/${segment}-${variant}.${extension}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const env = storageEnv();
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Photos are immutable once written — a new upload gets a new key.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function getObject(key: string): Promise<Buffer> {
  const env = storageEnv();
  const res = await s3().send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
  );
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Delete storage objects. Callers must use this whenever a photo or memory row
 * goes away — orphaned objects are billed forever and the plan's security
 * checklist treats them as a defect.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const env = storageEnv();

  // DeleteObjects caps at 1000 keys per request.
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: env.S3_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
  }
}

/** The browser-facing URL for a stored object. */
export function publicUrl(key: string): string {
  const base = storageEnv().S3_PUBLIC_URL.replace(/\/+$/, "");
  return `${base}/${key}`;
}
