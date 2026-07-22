ALTER TABLE "desktop_device" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
--> statement-breakpoint
UPDATE "desktop_device"
SET "expires_at" = "created_at" + interval '90 days'
WHERE "expires_at" IS NULL;
