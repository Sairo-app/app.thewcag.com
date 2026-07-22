import { and, asc, eq, inArray, lt, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingSessionAttempts, billingSubscriptions, billingTombstones, billingWebhookEvents, reports } from "@/lib/schema";
import { deleteImage } from "@/lib/r2";
import { dodoClient } from "./dodo";
import { applySubscriptionSnapshot, expireElapsedReportGrace } from "./subscriptions";

export interface ReconciliationResult {
  subscriptionsChecked: number;
  subscriptionsFailed: number;
  graceExpired: number;
  reportsDeleted: number;
  reportDeletesFailed: number;
  webhookEventsDeleted: number;
  sessionAttemptsDeleted: number;
  tombstonesDeleted: number;
}

export async function reconcileBillingAndRetention(now = new Date()): Promise<ReconciliationResult> {
  const subscriptions = await db
    .select({ id: billingSubscriptions.dodoSubscriptionId })
    .from(billingSubscriptions)
    .where(inArray(billingSubscriptions.status, ["pending", "active", "on_hold", "cancelled", "failed"]))
    .orderBy(asc(billingSubscriptions.updatedAt))
    .limit(100);

  let subscriptionsFailed = 0;
  for (const subscription of subscriptions) {
    try {
      const remote = await dodoClient().subscriptions.retrieve(subscription.id);
      await applySubscriptionSnapshot({ subscription: remote, occurredAt: now });
    } catch (error) {
      subscriptionsFailed += 1;
      console.error("Dodo subscription reconciliation failed", {
        subscriptionId: subscription.id,
        code: error instanceof Error ? error.name : "unknown_reconciliation_error",
      });
    }
  }

  const graceExpired = await expireElapsedReportGrace(now);
  const expiredReports = await db
    .select({ id: reports.id, imageKey: reports.imageKey })
    .from(reports)
    .where(and(
      eq(reports.availabilityStatus, "disabled"),
      lte(reports.retentionDeleteAt, now),
    ))
    .orderBy(asc(reports.retentionDeleteAt))
    .limit(100);
  let reportsDeleted = 0;
  let reportDeletesFailed = 0;
  for (const report of expiredReports) {
    try {
      await deleteImage(report.imageKey);
      await db.delete(reports).where(eq(reports.id, report.id));
      reportsDeleted += 1;
    } catch (error) {
      reportDeletesFailed += 1;
      console.error("Hosted report retention deletion failed", {
        reportId: report.id,
        code: error instanceof Error ? error.name : "unknown_retention_error",
      });
    }
  }

  const [webhookCleanup, sessionCleanup, tombstoneCleanup] = await Promise.all([
    db.delete(billingWebhookEvents).where(and(
      inArray(billingWebhookEvents.status, ["processed", "failed", "processing"]),
      lt(billingWebhookEvents.createdAt, new Date(now.getTime() - 180 * 24 * 60 * 60 * 1_000)),
    )),
    db.delete(billingSessionAttempts).where(lt(billingSessionAttempts.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000))),
    db.delete(billingTombstones).where(lte(billingTombstones.expiresAt, now)),
  ]);

  return {
    subscriptionsChecked: subscriptions.length,
    subscriptionsFailed,
    graceExpired,
    reportsDeleted,
    reportDeletesFailed,
    webhookEventsDeleted: webhookCleanup.count,
    sessionAttemptsDeleted: sessionCleanup.count,
    tombstonesDeleted: tombstoneCleanup.count,
  };
}
