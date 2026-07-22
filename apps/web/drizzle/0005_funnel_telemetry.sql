CREATE TABLE IF NOT EXISTS "funnel_transition" (
	"event" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "funnel_transition_event_allowed" CHECK (
		"event" IN ('guide_to_download', 'download_to_first_plan', 'first_plan_to_first_deliver')
	)
);
