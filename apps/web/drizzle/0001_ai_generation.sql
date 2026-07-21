CREATE TABLE IF NOT EXISTS "ai_generation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text,
	"request_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"input_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_generation_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_device_id_desktop_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."desktop_device"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_generation_user_created_idx" ON "ai_generation" USING btree ("user_id", "created_at");
