import { createHash } from "node:crypto";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingWebhookEvents } from "@/lib/schema";
import { dodoClient, dodoWebhookKey } from "./dodo";
import { expectedDodoBusinessId } from "./plans";
import { applySubscriptionSnapshot } from "./subscriptions";

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.active",
  "subscription.renewed",
  "subscription.on_hold",
  "subscription.cancelled",
  "subscription.failed",
  "subscription.expired",
  "subscription.plan_changed",
  "subscription.updated",
  "subscription.update_payment_method",
]);

export function verifyDodoWebhook(rawBody: string, headers: Headers): UnwrapWebhookEvent {
  return dodoClient().webhooks.unwrap(rawBody, {
    headers: Object.fromEntries(headers.entries()),
    key: dodoWebhookKey(),
  });
}

export function webhookPayloadHash(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function webhookRemoteObjectId(event: UnwrapWebhookEvent): string | null {
  const data = event.data as unknown as Record<string, unknown>;
  for (const key of ["subscription_id", "payment_id", "refund_id", "dispute_id"]) {
    if (typeof data[key] === "string") return data[key];
  }
  return null;
}

export async function claimWebhook(input: {
  webhookId: string;
  event: UnwrapWebhookEvent;
  payloadHash: string;
}): Promise<"claimed" | "duplicate"> {
  const occurredAt = new Date(input.event.timestamp);
  if (Number.isNaN(occurredAt.getTime())) throw new Error("invalid_webhook_timestamp");
  const inserted = await db
    .insert(billingWebhookEvents)
    .values({
      webhookId: input.webhookId,
      eventType: input.event.type,
      remoteObjectId: webhookRemoteObjectId(input.event),
      occurredAt,
      payloadHash: input.payloadHash,
      status: "processing",
    })
    .onConflictDoNothing()
    .returning({ webhookId: billingWebhookEvents.webhookId });
  if (inserted.length) return "claimed";

  const [stored] = await db
    .select({ status: billingWebhookEvents.status, payloadHash: billingWebhookEvents.payloadHash, createdAt: billingWebhookEvents.createdAt })
    .from(billingWebhookEvents)
    .where(eq(billingWebhookEvents.webhookId, input.webhookId))
    .limit(1);
  if (!stored || stored.payloadHash !== input.payloadHash) throw new Error("webhook_id_payload_mismatch");
  const staleProcessing = stored.status === "processing" && stored.createdAt.getTime() < Date.now() - 5 * 60 * 1_000;
  if (stored.status !== "failed" && !staleProcessing) return "duplicate";
  await db
    .update(billingWebhookEvents)
    .set({ status: "processing", errorCode: null })
    .where(eq(billingWebhookEvents.webhookId, input.webhookId));
  return "claimed";
}

async function subscriptionForPayment(paymentId: string) {
  const payment = await dodoClient().payments.retrieve(paymentId);
  if (!payment.subscription_id) return null;
  return dodoClient().subscriptions.retrieve(payment.subscription_id);
}

export async function processDodoWebhook(event: UnwrapWebhookEvent): Promise<string> {
  if (event.business_id !== expectedDodoBusinessId()) throw new Error("billing_business_mismatch");
  const occurredAt = new Date(event.timestamp);
  if (Number.isNaN(occurredAt.getTime())) throw new Error("invalid_webhook_timestamp");

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const result = await applySubscriptionSnapshot({
      subscription: event.data as Extract<UnwrapWebhookEvent, { type: "subscription.active" }>["data"],
      occurredAt,
    });
    return result.outcome;
  }

  if (event.type === "payment.succeeded" && event.data.subscription_id) {
    const subscription = await dodoClient().subscriptions.retrieve(event.data.subscription_id);
    const userIdHint = typeof event.data.metadata?.thewcag_user_id === "string"
      ? event.data.metadata.thewcag_user_id
      : null;
    return (await applySubscriptionSnapshot({ subscription, occurredAt, userIdHint })).outcome;
  }

  if (event.type === "refund.succeeded" && !event.data.is_partial) {
    const subscription = await subscriptionForPayment(event.data.payment_id);
    if (!subscription) return "ignored_non_subscription_payment";
    const userIdHint = typeof event.data.metadata?.thewcag_user_id === "string"
      ? event.data.metadata.thewcag_user_id
      : null;
    return (await applySubscriptionSnapshot({ subscription, occurredAt, statusOverride: "revoked", userIdHint })).outcome;
  }

  if (event.type === "dispute.accepted" || event.type === "dispute.lost") {
    const subscription = await subscriptionForPayment(event.data.payment_id);
    if (!subscription) return "ignored_non_subscription_payment";
    return (await applySubscriptionSnapshot({ subscription, occurredAt, statusOverride: "revoked" })).outcome;
  }

  return "ignored_event_type";
}

export async function completeWebhook(webhookId: string): Promise<void> {
  await db
    .update(billingWebhookEvents)
    .set({ status: "processed", errorCode: null, processedAt: new Date() })
    .where(eq(billingWebhookEvents.webhookId, webhookId));
}

export function billingWebhookErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_webhook_error";
  if (/^[a-z][a-z0-9_]{1,80}$/.test(error.message)) return error.message;
  const name = error.name.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "Error";
  return `external_${name}`;
}

export async function failWebhook(webhookId: string, error: unknown): Promise<void> {
  const code = billingWebhookErrorCode(error);
  await db
    .update(billingWebhookEvents)
    .set({ status: "failed", errorCode: code, processedAt: new Date() })
    .where(eq(billingWebhookEvents.webhookId, webhookId));
}
