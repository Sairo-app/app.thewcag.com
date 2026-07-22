import postgres from "postgres";

// Schema embedded so it is always present in the standalone bundle (no
// filesystem/module-resolution assumptions). Idempotent and safe every boot.
const INIT_SQL = `
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "desktop_device" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"device_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "desktop_device_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'Accessibility findings' NOT NULL,
	"description" text,
	"issues" jsonb NOT NULL,
	"image_key" text NOT NULL,
	"image_content_type" text DEFAULT 'image/png' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finding_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "report" ADD COLUMN IF NOT EXISTS "size_bytes" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "desktop_device" ADD CONSTRAINT "desktop_device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "report" ADD CONSTRAINT "report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_device_id_desktop_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."desktop_device"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "desktop_device_user_idx" ON "desktop_device" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_user_idx" ON "report" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_generation_user_created_idx" ON "ai_generation" ("user_id", "created_at");
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "brand_name" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "brand_color" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "brand_logo_key" text;
--> statement-breakpoint
ALTER TABLE "desktop_device" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
--> statement-breakpoint
UPDATE "desktop_device" SET "expires_at" = "created_at" + interval '90 days' WHERE "expires_at" IS NULL;
--> statement-breakpoint
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
`;

let ran = false;

/** Apply the schema once per process on server startup. */
export async function runMigrations(): Promise<void> {
  if (ran || !process.env.DATABASE_URL) return;
  ran = true;
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    for (const stmt of INIT_SQL.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }
    console.log("[migrate] schema ready");
  } catch (e) {
    ran = false;
    const message = e instanceof Error ? e.message || e.name : String(e);
    console.error("[migrate] failed:", message);
    // A production server with an unusable schema is not healthy: auth,
    // reports, and device connections would fail later with less actionable
    // errors. Development stays available for static UI work while the local
    // database is offline.
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Database migration failed: ${message}`, { cause: e });
    }
  } finally {
    await sql.end();
  }
}
