import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---- Auth.js (Drizzle adapter) standard tables ----
export const users = pgTable(
  "user",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
    // White-label branding: an organization's logo, name, and accent color,
    // applied to every report this user shares. All optional (null = TheWCAG).
    brandName: text("brand_name"),
    brandColor: text("brand_color"),
    brandLogoKey: text("brand_logo_key"),
    brandAssetToken: text("brand_asset_token")
      .notNull()
      .default(sql`'br_' || replace(gen_random_uuid()::text, '-', '')`)
      .unique(),
  },
  (t) => ({
    brandAssetTokenFormat: check(
      "user_brand_asset_token_format",
      sql`${t.brandAssetToken} ~ '^br_[0-9a-f]{32}$'`,
    ),
  }),
);

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (a) => ({ pk: primaryKey({ columns: [a.provider, a.providerAccountId] }) }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);

// ---- Desktop device tokens (app authentication) ----
export const desktopDevices = pgTable(
  "desktop_device",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").unique(),
    claimCodeHash: text("claim_code_hash"),
    claimExpiresAt: timestamp("claim_expires_at"),
    claimedAt: timestamp("claimed_at"),
    deviceName: text("device_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => ({
    userIdx: index("desktop_device_user_idx").on(t.userId),
    claimCodeHashIdx: uniqueIndex("desktop_device_claim_code_hash_unique").on(t.claimCodeHash),
  }),
);

// ---- Shared reports (image blob lives in R2; metadata here) ----
export type ReportIssueSeverity = "blocker" | "major" | "minor";
export type ReportRemediationStatus = "open" | "retest" | "fixed" | "accepted";

export interface ReportIssue {
  /** Missing only on damaged or not-yet-backfilled legacy report data. */
  id?: string;
  n: number;
  sc?: string[];
  label: string;
  severity: ReportIssueSeverity;
  note: string;
  /** Optional for backwards compatibility with reports published before status was shared. */
  status?: ReportRemediationStatus;
}

export interface IdentifiedReportIssue extends ReportIssue {
  id: string;
}

export const reports = pgTable(
  "report",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug: text("slug").notNull().unique(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Accessibility findings"),
    description: text("description"),
    issues: jsonb("issues").$type<ReportIssue[]>().notNull(),
    imageKey: text("image_key").notNull(),
    imageContentType: text("image_content_type").notNull().default("image/png"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    availabilityStatus: text("availability_status").notNull().default("active"),
    graceEndsAt: timestamp("grace_ends_at", { mode: "date" }),
    retentionDeleteAt: timestamp("retention_delete_at", { mode: "date" }),
    disabledAt: timestamp("disabled_at", { mode: "date" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("report_user_idx").on(t.userId),
    availabilityIdx: index("report_availability_idx").on(t.availabilityStatus, t.graceEndsAt),
    retentionIdx: index("report_retention_idx").on(t.availabilityStatus, t.retentionDeleteAt),
  }),
);

// Daily report analytics deduplication. visitorHash is a keyed, report/day-
// scoped digest; raw client addresses are never stored and hashes cannot be
// correlated across reports or days.
export const reportViews = pgTable(
  "report_view",
  {
    reportSlug: text("report_slug").notNull().references(() => reports.slug, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    visitorHash: text("visitor_hash").notNull(),
    viewedOn: date("viewed_on", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.reportSlug, t.visitorHash, t.viewedOn] }),
    viewedOnIdx: index("report_view_viewed_on_idx").on(t.viewedOn),
  }),
);

// Persistent per-IP sign-in reservations. ipHash is keyed and contains no raw
// address; old rows can be pruned after the one-hour enforcement window.
export const authSigninAttempts = pgTable(
  "auth_signin_attempt",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ipHash: text("ip_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    ipCreatedIdx: index("auth_signin_attempt_ip_created_idx").on(t.ipHash, t.createdAt),
    createdIdx: index("auth_signin_attempt_created_idx").on(t.createdAt),
  }),
);

// Aggregate-only, opt-in funnel counters. No identifiers, request metadata,
// timestamps, audit content, URLs, screenshots, findings, or PII are stored.
export const funnelTransitions = pgTable("funnel_transition", {
  event: text("event").primaryKey(),
  count: integer("count").notNull().default(1),
});

// ---- Dodo Payments normalized billing state ----
// Dodo remains the financial source of truth. These tables contain only the
// minimum state required for fast service authorization and webhook recovery.
export const billingCustomers = pgTable("billing_customer", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dodoCustomerId: text("dodo_customer_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const billingSubscriptions = pgTable(
  "billing_subscription",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    dodoSubscriptionId: text("dodo_subscription_id").notNull().unique(),
    dodoCustomerId: text("dodo_customer_id").notNull(),
    productId: text("product_id").notNull(),
    planKey: text("plan_key").notNull(),
    billingInterval: text("billing_interval").notNull(),
    status: text("status").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start", { mode: "date" }),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    graceEndsAt: timestamp("grace_ends_at", { mode: "date" }),
    latestEventAt: timestamp("latest_event_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("billing_subscription_user_idx").on(t.userId, t.updatedAt),
    customerIdx: index("billing_subscription_customer_idx").on(t.dodoCustomerId),
    statusIdx: index("billing_subscription_status_idx").on(t.status, t.updatedAt),
  }),
);

export const billingWebhookEvents = pgTable(
  "billing_webhook_event",
  {
    webhookId: text("webhook_id").primaryKey(),
    eventType: text("event_type").notNull(),
    remoteObjectId: text("remote_object_id"),
    occurredAt: timestamp("occurred_at", { mode: "date" }).notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    processedAt: timestamp("processed_at", { mode: "date" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index("billing_webhook_event_status_idx").on(t.status, t.createdAt) }),
);

export const billingSessionAttempts = pgTable(
  "billing_session_attempt",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    planChoice: text("plan_choice"),
    status: text("status").notNull(),
    remoteSessionId: text("remote_session_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("billing_session_attempt_user_created_idx").on(t.userId, t.kind, t.createdAt),
    createdIdx: index("billing_session_attempt_created_idx").on(t.createdAt),
  }),
);

export const billingTombstones = pgTable(
  "billing_tombstone",
  {
    idHash: text("id_hash").primaryKey(),
    kind: text("kind").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ expiresIdx: index("billing_tombstone_expires_idx").on(t.expiresAt) }),
);

// Append-only global registry. Report deletion never releases a finding ID.
// The ID itself carries no customer or finding content.
export const findingIdentities = pgTable("finding_identity", {
  id: text("id").primaryKey(),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
});

// AI usage metadata deliberately excludes evidence, screenshots, prompts, and
// generated finding content. It exists only for abuse protection, quota
// enforcement, and operational health.
export const aiGenerations = pgTable(
  "ai_generation",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").references(() => desktopDevices.id, { onDelete: "set null" }),
    requestId: text("request_id").notNull().unique(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull(),
    inputBytes: integer("input_bytes").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("ai_generation_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type Report = typeof reports.$inferSelect;
export type ReportView = typeof reportViews.$inferSelect;
export type AuthSigninAttempt = typeof authSigninAttempts.$inferSelect;
export type DesktopDevice = typeof desktopDevices.$inferSelect;
export type AiGeneration = typeof aiGenerations.$inferSelect;
export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
export type BillingWebhookEvent = typeof billingWebhookEvents.$inferSelect;
export type BillingSessionAttempt = typeof billingSessionAttempts.$inferSelect;
export type BillingTombstone = typeof billingTombstones.$inferSelect;
