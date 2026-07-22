import type { Subscription } from "dodopayments/resources/subscriptions";
import type { BillingInterval, PlanKey } from "./plans";
import { planForProduct } from "./plans";

export type BillingSubscriptionStatus =
  | "pending"
  | "active"
  | "on_hold"
  | "cancelled"
  | "failed"
  | "expired"
  | "revoked";

export interface NormalizedSubscription {
  dodoSubscriptionId: string;
  dodoCustomerId: string;
  productId: string;
  planKey: PlanKey;
  billingInterval: BillingInterval;
  status: BillingSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
}

const DAY = 24 * 60 * 60 * 1_000;

function date(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeDodoSubscription(
  subscription: Subscription,
  occurredAt: Date,
): NormalizedSubscription | null {
  const plan = planForProduct(subscription.product_id);
  if (!plan) return null;
  const currentPeriodStart = date(subscription.previous_billing_date);
  const currentPeriodEnd = date(subscription.next_billing_date) ?? date(subscription.expires_at);
  let graceEndsAt: Date | null = null;
  if (subscription.status === "on_hold") {
    graceEndsAt = new Date(occurredAt.getTime() + 7 * DAY);
  } else if (subscription.status === "cancelled" || subscription.status === "expired") {
    const paidEnd = currentPeriodEnd && currentPeriodEnd.getTime() > occurredAt.getTime()
      ? currentPeriodEnd
      : occurredAt;
    graceEndsAt = new Date(paidEnd.getTime() + 30 * DAY);
  }
  return {
    dodoSubscriptionId: subscription.subscription_id,
    dodoCustomerId: subscription.customer.customer_id,
    productId: subscription.product_id,
    planKey: plan.planKey,
    billingInterval: plan.interval,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_next_billing_date,
    currentPeriodStart,
    currentPeriodEnd,
    graceEndsAt,
  };
}

export function reportRetentionDeleteAt(status: BillingSubscriptionStatus, graceEndsAt: Date | null, now: Date): Date | null {
  if (status === "active" || status === "pending") return null;
  if (status === "revoked") return now;
  const grace = graceEndsAt && graceEndsAt.getTime() > now.getTime() ? graceEndsAt : now;
  return new Date(grace.getTime() + 90 * DAY);
}
