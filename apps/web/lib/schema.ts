import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ---- Auth.js (Drizzle adapter) standard tables ----
export const users = pgTable("user", {
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
});

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
    tokenHash: text("token_hash").notNull().unique(),
    deviceName: text("device_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => ({ userIdx: index("desktop_device_user_idx").on(t.userId) }),
);

// ---- Shared reports (image blob lives in R2; metadata here) ----
export interface ReportIssue {
  id: string;
  n: number;
  sc?: string;
  label: string;
  severity: string;
  note: string;
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ userIdx: index("report_user_idx").on(t.userId) }),
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

// silence unused import if boolean not referenced elsewhere
void boolean;

export type Report = typeof reports.$inferSelect;
export type DesktopDevice = typeof desktopDevices.$inferSelect;
export type AiGeneration = typeof aiGenerations.$inferSelect;
