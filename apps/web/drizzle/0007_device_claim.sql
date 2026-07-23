ALTER TABLE "desktop_device" ALTER COLUMN "token_hash" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "desktop_device" ADD COLUMN IF NOT EXISTS "claim_code_hash" text;
--> statement-breakpoint
ALTER TABLE "desktop_device" ADD COLUMN IF NOT EXISTS "claim_expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "desktop_device" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp;
--> statement-breakpoint
UPDATE "desktop_device"
SET "claimed_at" = "created_at"
WHERE "claimed_at" IS NULL AND "token_hash" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "desktop_device_claim_code_hash_unique"
ON "desktop_device" ("claim_code_hash");
