ALTER TABLE "photos" ADD COLUMN "thumbnail_size_bytes" bigint;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "storage_quota_bytes" bigint DEFAULT 21474836480 NOT NULL;