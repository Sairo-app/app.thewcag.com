CREATE TABLE IF NOT EXISTS "crash_report" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"frames" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"app_version" text NOT NULL,
	"platform" text NOT NULL,
	"os_release" text NOT NULL,
	"arch" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crash_report_origin_allowed" CHECK (
		"origin" IN ('main-uncaught-exception', 'main-unhandled-rejection', 'renderer-process-gone', 'child-process-gone')
	),
	CONSTRAINT "crash_report_fingerprint_shape" CHECK ("fingerprint" ~ '^[a-f0-9]{32}$')
);

CREATE INDEX IF NOT EXISTS "crash_report_last_seen_idx" ON "crash_report" ("last_seen_at" DESC);
