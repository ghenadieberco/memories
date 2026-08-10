ALTER TABLE "photos" ADD COLUMN "media_type" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_media_type_check" CHECK ("photos"."media_type" in ('image','video'));