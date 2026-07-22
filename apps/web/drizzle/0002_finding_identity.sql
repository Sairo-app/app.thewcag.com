CREATE TABLE IF NOT EXISTS "finding_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL
);
