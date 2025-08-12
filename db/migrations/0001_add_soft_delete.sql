ALTER TABLE "urls" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "urls" ADD COLUMN "deleted_at" timestamp;