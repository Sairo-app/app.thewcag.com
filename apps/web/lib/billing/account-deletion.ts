import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingCustomers, billingSubscriptions, billingTombstones, users } from "@/lib/schema";
import { dodoClient } from "./dodo";
import { applySubscriptionSnapshot } from "./subscriptions";
import { billingRemoteIdHash } from "./identifiers";

/** Cancel billable subscriptions before removing the local account record. */
export async function cancelSubscriptionsBeforeAccountDeletion(
  userId: string,
  initiatedBy: "customer" | "merchant" = "customer",
): Promise<void> {
  const subscriptions = await db
    .select({ id: billingSubscriptions.dodoSubscriptionId })
    .from(billingSubscriptions)
    .where(and(
      eq(billingSubscriptions.userId, userId),
      inArray(billingSubscriptions.status, ["pending", "active", "on_hold"]),
    ));

  for (const subscription of subscriptions) {
    const cancelled = await dodoClient().subscriptions.update(subscription.id, {
      status: "cancelled",
      cancel_at_next_billing_date: false,
      cancel_reason: initiatedBy === "customer" ? "cancelled_by_customer" : "cancelled_by_merchant",
      cancellation_comment: "TheWCAG account deletion",
    });
    await applySubscriptionSnapshot({
      subscription: cancelled,
      occurredAt: new Date(),
      statusOverride: "revoked",
    });
  }
}

/** Atomically record late-event tombstones and remove the local user row. */
export async function deleteUserWithBillingTombstones(userId: string): Promise<{ logoKey: string | null } | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`billing-user:${userId}`}))`);
    const [subscriptions, customer] = await Promise.all([
      tx.select({ id: billingSubscriptions.dodoSubscriptionId }).from(billingSubscriptions).where(eq(billingSubscriptions.userId, userId)),
      tx.select({ id: billingCustomers.dodoCustomerId }).from(billingCustomers).where(eq(billingCustomers.userId, userId)).limit(1),
    ]);
    const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1_000);
    const tombstones = [
      ...subscriptions.map((subscription) => ({ idHash: billingRemoteIdHash(subscription.id), kind: "subscription", expiresAt })),
      ...(customer[0] ? [{ idHash: billingRemoteIdHash(customer[0].id), kind: "customer", expiresAt }] : []),
    ];
    if (tombstones.length) {
      await tx
        .insert(billingTombstones)
        .values(tombstones)
        .onConflictDoUpdate({ target: billingTombstones.idHash, set: { expiresAt } });
    }
    const [deleted] = await tx
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ logoKey: users.brandLogoKey });
    return deleted ?? null;
  });
}
