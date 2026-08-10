ALTER TABLE "photos" ALTER COLUMN "uploaded_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "public_can_contribute" boolean DEFAULT false NOT NULL;