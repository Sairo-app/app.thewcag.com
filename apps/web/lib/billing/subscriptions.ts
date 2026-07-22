import type { Subscription } from "dodopayments/resources/subscriptions";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  billingCustomers,
  billingSubscriptions,
  billingTombstones,
  reports,
  users,
} from "@/lib/schema";
import {
  normalizeDodoSubscription,
  reportRetentionDeleteAt,
  type BillingSubscriptionStatus,
} from "./status";
import { billingRemoteIdHash } from "./identifiers";

export type ReportAvailabilityStatus = "active" | "grace" | "disabled";

export function reportAvailabilityForSubscription(
  status: BillingSubscriptionStatus,
  graceEndsAt: Date | null,
  now: Date,
): ReportAvailabilityStatus {
  if (status === "active") return "active";
  if (status !== "revoked" && graceEndsAt && graceEndsAt.getTime() > now.getTime()) return "grace";
  return "disabled";
}

export function isReportAvailable(
  availabilityStatus: string,
  graceEndsAt: Date | null,
  now = new Date(),
): boolean {
  return availabilityStatus === "active"
    || (availabilityStatus === "grace" && Boolean(graceEndsAt && graceEndsAt.getTime() > now.getTime()));
}

function metadataUserId(subscription: Subscription): string | null {
  const value = subscription.metadata?.thewcag_user_id;
  return typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null;
}

export interface AppliedSubscriptionResult {
  outcome: "applied" | "ignored_out_of_order" | "ignored_product" | "ignored_revoked" | "ignored_deleted_account";
  userId?: string;
  status?: BillingSubscriptionStatus;
}

/**
 * Apply one verified Dodo snapshot. The subscription row is the authorization
 * cache; Dodo remains the financial source of truth. A transaction-scoped lock
 * and latest-event timestamp make duplicate and out-of-order delivery safe.
 */
export async function applySubscriptionSnapshot(input: {
  subscription: Subscription;
  occurredAt: Date;
  statusOverride?: BillingSubscriptionStatus;
  userIdHint?: string | null;
}): Promise<AppliedSubscriptionResult> {
  const normalized = normalizeDodoSubscription(input.subscription, input.occurredAt);
  if (!normalized) return { outcome: "ignored_product" };
  const status = input.statusOverride ?? normalized.status;
  let graceEndsAt = status === "revoked" ? null : normalized.graceEndsAt;

  return db.transaction(async (tx) => {
    const [tombstone] = await tx
      .select({ idHash: billingTombstones.idHash })
      .from(billingTombstones)
      .where(and(
        inArray(billingTombstones.idHash, [
          billingRemoteIdHash(normalized.dodoSubscriptionId),
          billingRemoteIdHash(normalized.dodoCustomerId),
        ]),
        gt(billingTombstones.expiresAt, new Date()),
      ))
      .limit(1);
    if (tombstone) return { outcome: "ignored_deleted_account" as const };
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${normalized.dodoSubscriptionId}))`);
    const [existingSubscription] = await tx
      .select({
        userId: billingSubscriptions.userId,
        latestEventAt: billingSubscriptions.latestEventAt,
        status: billingSubscriptions.status,
        graceEndsAt: billingSubscriptions.graceEndsAt,
      })
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.dodoSubscriptionId, normalized.dodoSubscriptionId))
      .limit(1);
    if (existingSubscription?.latestEventAt.getTime() > input.occurredAt.getTime()) {
      return { outcome: "ignored_out_of_order" as const };
    }
    if (existingSubscription?.status === "revoked" && input.statusOverride !== "revoked") {
      return { outcome: "ignored_revoked" as const, userId: existingSubscription.userId, status: "revoked" as const };
    }
    const sameLifecycleState = existingSubscription?.status === status;
    if (sameLifecycleState && existingSubscription.graceEndsAt && status !== "active") {
      graceEndsAt = existingSubscription.graceEndsAt;
    }

    const [mappedCustomer] = await tx
      .select({ userId: billingCustomers.userId })
      .from(billingCustomers)
      .where(eq(billingCustomers.dodoCustomerId, normalized.dodoCustomerId))
      .limit(1);
    const fromMetadata = metadataUserId(input.subscription);
    const userIdHint = typeof input.userIdHint === "string" && input.userIdHint.length > 0 && input.userIdHint.length <= 200
      ? input.userIdHint
      : null;
    const userId = existingSubscription?.userId ?? mappedCustomer?.userId ?? fromMetadata ?? userIdHint;
    if (!userId) throw new Error("billing_user_unresolved");
    if (fromMetadata && fromMetadata !== userId) throw new Error("billing_user_mismatch");
    if (userIdHint && userIdHint !== userId) throw new Error("billing_user_hint_mismatch");
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`billing-user:${userId}`}))`);

    const [knownUser] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!knownUser) throw new Error("billing_user_not_found");

    const [customerOwnedByOtherUser] = await tx
      .select({ userId: billingCustomers.userId })
      .from(billingCustomers)
      .where(and(
        eq(billingCustomers.dodoCustomerId, normalized.dodoCustomerId),
        sql`${billingCustomers.userId} <> ${userId}`,
      ))
      .limit(1);
    if (customerOwnedByOtherUser) throw new Error("billing_customer_mismatch");

    await tx
      .insert(billingCustomers)
      .values({ userId, dodoCustomerId: normalized.dodoCustomerId, updatedAt: input.occurredAt })
      .onConflictDoUpdate({
        target: billingCustomers.userId,
        set: { dodoCustomerId: normalized.dodoCustomerId, updatedAt: input.occurredAt },
      });

    await tx
      .insert(billingSubscriptions)
      .values({
        userId,
        dodoSubscriptionId: normalized.dodoSubscriptionId,
        dodoCustomerId: normalized.dodoCustomerId,
        productId: normalized.productId,
        planKey: normalized.planKey,
        billingInterval: normalized.billingInterval,
        status,
        cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
        currentPeriodStart: normalized.currentPeriodStart,
        currentPeriodEnd: normalized.currentPeriodEnd,
        graceEndsAt,
        latestEventAt: input.occurredAt,
        updatedAt: input.occurredAt,
      })
      .onConflictDoUpdate({
        target: billingSubscriptions.dodoSubscriptionId,
        set: {
          dodoCustomerId: normalized.dodoCustomerId,
          productId: normalized.productId,
          planKey: normalized.planKey,
          billingInterval: normalized.billingInterval,
          status,
          cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
          currentPeriodStart: normalized.currentPeriodStart,
          currentPeriodEnd: normalized.currentPeriodEnd,
          graceEndsAt,
          latestEventAt: input.occurredAt,
          updatedAt: input.occurredAt,
        },
      });

    const [effectiveSubscription] = await tx
      .select({
        status: billingSubscriptions.status,
        graceEndsAt: billingSubscriptions.graceEndsAt,
        currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      })
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.userId, userId))
      .orderBy(
        sql`CASE
          WHEN ${billingSubscriptions.status} = 'active' AND ${billingSubscriptions.currentPeriodEnd} > ${input.occurredAt} THEN 0
          WHEN ${billingSubscriptions.graceEndsAt} > ${input.occurredAt} THEN 1
          WHEN ${billingSubscriptions.status} = 'pending' THEN 3
          ELSE 2
        END`,
        desc(billingSubscriptions.graceEndsAt),
        desc(billingSubscriptions.updatedAt),
      )
      .limit(1);
    if (!effectiveSubscription || effectiveSubscription.status === "pending") {
      return { outcome: "applied" as const, userId, status };
    }
    const effectiveStatus = effectiveSubscription.status === "active"
      && (!effectiveSubscription.currentPeriodEnd || effectiveSubscription.currentPeriodEnd.getTime() <= input.occurredAt.getTime())
      ? "expired"
      : effectiveSubscription.status as BillingSubscriptionStatus;
    const effectiveGraceEndsAt = effectiveSubscription.graceEndsAt;
    const availabilityStatus = reportAvailabilityForSubscription(effectiveStatus, effectiveGraceEndsAt, input.occurredAt);
    const nextRetentionDeleteAt = reportRetentionDeleteAt(effectiveStatus, effectiveGraceEndsAt, input.occurredAt);
    const retentionDeleteAt = availabilityStatus === "active"
      ? null
      : availabilityStatus === "grace"
        ? nextRetentionDeleteAt
        : effectiveStatus === "revoked"
          ? nextRetentionDeleteAt
        : sql<Date | null>`COALESCE(${reports.retentionDeleteAt}, ${nextRetentionDeleteAt})`;
    await tx
      .update(reports)
      .set({
        availabilityStatus,
        graceEndsAt: availabilityStatus === "grace" ? effectiveGraceEndsAt : null,
        retentionDeleteAt,
        disabledAt: availabilityStatus === "disabled"
          ? sql<Date | null>`COALESCE(${reports.disabledAt}, ${input.occurredAt})`
          : null,
      })
      .where(eq(reports.userId, userId));

    return { outcome: "applied" as const, userId, status };
  });
}

export async function expireElapsedReportGrace(now = new Date()): Promise<number> {
  const result = await db
    .update(reports)
    .set({ availabilityStatus: "disabled", disabledAt: now, graceEndsAt: null })
    .where(and(eq(reports.availabilityStatus, "grace"), lt(reports.graceEndsAt, now)));
  return result.count;
}
