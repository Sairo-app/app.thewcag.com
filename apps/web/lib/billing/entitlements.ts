import { and, count, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiGenerations, billingSubscriptions, reports } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";
import {
  billingConfigured,
  hostedReportLimit,
  hostedStorageQuotaBytes,
  managedAiPeriodLimit,
} from "./plans";
import type { BillingSubscriptionStatus } from "./status";

export interface EffectiveEntitlements {
  version: 1;
  plan: "free" | "pro";
  subscription: {
    status: "none" | BillingSubscriptionStatus;
    renewsAt?: string;
    endsAt?: string;
    graceEndsAt?: string;
    cancelAtPeriodEnd: boolean;
  };
  features: {
    managedAi: { enabled: boolean; used: number; limit: number; resetsAt?: string };
    hostedReports: { enabled: boolean; active: number; limit: number };
    whiteLabelReports: boolean;
    reportAnalytics: boolean;
  };
  storage: { usedBytes: number; quotaBytes: number };
  actions: { canUpgrade: boolean; canManageBilling: boolean; upgradeUrl: string; billingUrl?: string };
}

export interface EntitlementInput {
  subscription: {
    status: BillingSubscriptionStatus;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date | null;
    graceEndsAt: Date | null;
    dodoCustomerId: string;
  } | null;
  aiUsed: number;
  activeReports: number;
  usedBytes: number;
  now: Date;
  configured?: boolean;
}

export function deriveEffectiveEntitlements(input: EntitlementInput): EffectiveEntitlements {
  const configured = input.configured ?? billingConfigured();
  const subscription = input.subscription;
  const paidThrough = subscription?.currentPeriodEnd?.getTime() ?? 0;
  const active = Boolean(
    configured
    && subscription?.status === "active"
    && paidThrough > input.now.getTime(),
  );
  const status = subscription?.status ?? "none";
  return {
    version: 1,
    plan: active ? "pro" : "free",
    subscription: {
      status,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      ...(active && !subscription?.cancelAtPeriodEnd && subscription?.currentPeriodEnd
        ? { renewsAt: subscription.currentPeriodEnd.toISOString() }
        : {}),
      ...(subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd
        ? { endsAt: subscription.currentPeriodEnd.toISOString() }
        : {}),
      ...(subscription?.graceEndsAt ? { graceEndsAt: subscription.graceEndsAt.toISOString() } : {}),
    },
    features: {
      managedAi: {
        enabled: active,
        used: input.aiUsed,
        limit: managedAiPeriodLimit(),
        ...(subscription?.currentPeriodEnd ? { resetsAt: subscription.currentPeriodEnd.toISOString() } : {}),
      },
      hostedReports: { enabled: active, active: input.activeReports, limit: hostedReportLimit() },
      whiteLabelReports: active,
      reportAnalytics: active,
    },
    storage: { usedBytes: input.usedBytes, quotaBytes: hostedStorageQuotaBytes() },
    actions: {
      canUpgrade: !active,
      canManageBilling: Boolean(subscription?.dodoCustomerId),
      upgradeUrl: `${SITE_URL}/pricing`,
      ...(subscription?.dodoCustomerId ? { billingUrl: `${SITE_URL}/api/billing/portal` } : {}),
    },
  };
}

export async function resolveEntitlements(userId: string, now = new Date()): Promise<EffectiveEntitlements> {
  const [subscription] = await db
    .select({
      status: billingSubscriptions.status,
      cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd,
      currentPeriodStart: billingSubscriptions.currentPeriodStart,
      currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      graceEndsAt: billingSubscriptions.graceEndsAt,
      dodoCustomerId: billingSubscriptions.dodoCustomerId,
    })
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.userId, userId))
    .orderBy(
      sql`CASE WHEN ${billingSubscriptions.status} = 'active' AND ${billingSubscriptions.currentPeriodEnd} > ${now} THEN 0 ELSE 1 END`,
      sql`CASE WHEN ${billingSubscriptions.status} = 'active' THEN ${billingSubscriptions.currentPeriodEnd} ELSE NULL END DESC`,
      desc(billingSubscriptions.updatedAt),
    )
    .limit(1);

  const periodStart = subscription?.currentPeriodStart ?? new Date(now.getTime() - 31 * 24 * 60 * 60 * 1_000);
  const [[ai], [report], [storage]] = await Promise.all([
    db
      .select({ value: count() })
      .from(aiGenerations)
      .where(and(
        eq(aiGenerations.userId, userId),
        gte(aiGenerations.createdAt, periodStart),
        inArray(aiGenerations.status, ["started", "succeeded"]),
      )),
    db.select({ value: count() }).from(reports).where(and(
      eq(reports.userId, userId),
      inArray(reports.availabilityStatus, ["active", "grace"]),
    )),
    db
      .select({ value: sql<string>`COALESCE(SUM(${reports.sizeBytes}), 0)` })
      .from(reports)
      .where(eq(reports.userId, userId)),
  ]);

  const normalizedStatus = subscription?.status && ["pending", "active", "on_hold", "cancelled", "failed", "expired", "revoked"].includes(subscription.status)
    ? subscription.status as BillingSubscriptionStatus
    : null;
  return deriveEffectiveEntitlements({
    subscription: subscription && normalizedStatus ? {
      status: normalizedStatus,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      graceEndsAt: subscription.graceEndsAt,
      dodoCustomerId: subscription.dodoCustomerId,
    } : null,
    aiUsed: Number(ai?.value ?? 0),
    activeReports: Number(report?.value ?? 0),
    usedBytes: Number(storage?.value ?? 0),
    now,
  });
}

/** Lightweight authorization check for hot public-report paths. */
export async function hasActiveProSubscription(userId: string, now = new Date()): Promise<boolean> {
  if (!billingConfigured()) return false;
  const [subscription] = await db
    .select({ id: billingSubscriptions.id })
    .from(billingSubscriptions)
    .where(and(
      eq(billingSubscriptions.userId, userId),
      eq(billingSubscriptions.status, "active"),
      gt(billingSubscriptions.currentPeriodEnd, now),
    ))
    .orderBy(desc(billingSubscriptions.updatedAt))
    .limit(1);
  return Boolean(subscription);
}

export type PaidFeature = "managedAi" | "hostedReports" | "whiteLabelReports" | "reportAnalytics";

export function hasPaidFeature(entitlements: EffectiveEntitlements, feature: PaidFeature): boolean {
  const value = entitlements.features[feature];
  return typeof value === "boolean" ? value : value.enabled;
}
