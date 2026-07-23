ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "brand_asset_token" text DEFAULT ('br_' || replace(gen_random_uuid()::text, '-', '')) NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_brand_asset_token_unique" ON "user" USING btree ("brand_asset_token");
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_brand_asset_token_format" CHECK ("brand_asset_token" ~ '^br_[0-9a-f]{32}$');
