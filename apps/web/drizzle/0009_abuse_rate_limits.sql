CREATE TABLE IF NOT EXISTS "report_view" (
	"report_slug" text NOT NULL,
	"visitor_hash" text NOT NULL,
	"viewed_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_view_report_slug_visitor_hash_viewed_on_pk" PRIMARY KEY("report_slug", "visitor_hash", "viewed_on"),
	CONSTRAINT "report_view_report_slug_report_slug_fk" FOREIGN KEY ("report_slug") REFERENCES "public"."report"("slug") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_view_viewed_on_idx" ON "report_view" USING btree ("viewed_on");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_signin_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_signin_attempt_ip_created_idx" ON "auth_signin_attempt" USING btree ("ip_hash", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_signin_attempt_created_idx" ON "auth_signin_attempt" USING btree ("created_at");
