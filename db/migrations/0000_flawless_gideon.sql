CREATE TABLE IF NOT EXISTS "urls" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"main_url" text NOT NULL,
	"sub_urls" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
