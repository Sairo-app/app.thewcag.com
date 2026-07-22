CREATE TABLE IF NOT EXISTS "billing_customer" (
	"user_id" text PRIMARY KEY NOT NULL,
	"dodo_customer_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customer_dodo_customer_id_unique" UNIQUE("dodo_customer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dodo_subscription_id" text NOT NULL,
	"dodo_customer_id" text NOT NULL,
	"product_id" text NOT NULL,
	"plan_key" text NOT NULL,
	"billing_interval" text NOT NULL,
	"status" text NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"grace_ends_at" timestamp,
	"latest_event_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscription_dodo_subscription_id_unique" UNIQUE("dodo_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_webhook_event" (
	"webhook_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"remote_object_id" text,
	"occurred_at" timestamp NOT NULL,
	"payload_hash" text NOT NULL,
	"status" text NOT NULL,
	"error_code" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_session_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"plan_choice" text,
	"status" text NOT NULL,
	"remote_session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_tombstone" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report" ADD COLUMN IF NOT EXISTS "availability_status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "report" ADD COLUMN IF NOT EXISTS "grace_ends_at" timestamp;
--> statement-breakpoint
ALTER TABLE "report" ADD COLUMN IF NOT EXISTS "retention_delete_at" timestamp;
--> statement-breakpoint
ALTER TABLE "report" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_migration" (
	"migration_key" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM "app_migration" WHERE "migration_key" = 'saas_report_backfill_v1') THEN
		UPDATE "report"
		SET "availability_status" = 'grace',
			"grace_ends_at" = now() + interval '30 days',
			"retention_delete_at" = now() + interval '120 days'
		WHERE "availability_status" = 'active' AND "retention_delete_at" IS NULL;
		INSERT INTO "app_migration" ("migration_key") VALUES ('saas_report_backfill_v1');
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_customer" ADD CONSTRAINT "billing_customer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "billing_session_attempt" ADD CONSTRAINT "billing_session_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_subscription_user_idx" ON "billing_subscription" ("user_id", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_subscription_customer_idx" ON "billing_subscription" ("dodo_customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_subscription_status_idx" ON "billing_subscription" ("status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_webhook_event_status_idx" ON "billing_webhook_event" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_session_attempt_user_created_idx" ON "billing_session_attempt" ("user_id", "kind", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_session_attempt_created_idx" ON "billing_session_attempt" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_tombstone_expires_idx" ON "billing_tombstone" ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_availability_idx" ON "report" ("availability_status", "grace_ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_retention_idx" ON "report" ("availability_status", "retention_delete_at");
