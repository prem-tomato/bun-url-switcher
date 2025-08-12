ALTER TABLE "urls" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "urls" ADD COLUMN "deleted_at" timestamp;