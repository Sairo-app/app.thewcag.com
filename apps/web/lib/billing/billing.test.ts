import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { Subscription } from "dodopayments/resources/subscriptions";
import { deriveEffectiveEntitlements } from "./entitlements";
import { isAllowedDodoHostedUrl, resetDodoClientForTests } from "./dodo";
import { billingConfigured, planForChoice, planForProduct, validateLiveBillingConfiguration } from "./plans";
import { normalizeDodoSubscription, reportRetentionDeleteAt } from "./status";
import { isReportAvailable, reportAvailabilityForSubscription } from "./subscriptions";
import { billingWebhookErrorCode, verifyDodoWebhook, webhookPayloadHash, webhookRemoteObjectId } from "./webhooks";

function subscription(patch: Partial<Subscription> = {}): Subscription {
  return {
    subscription_id: "sub_123",
    product_id: "prod_monthly",
    status: "active",
    cancel_at_next_billing_date: false,
    previous_billing_date: "2026-07-01T00:00:00.000Z",
    next_billing_date: "2026-08-01T00:00:00.000Z",
    customer: { customer_id: "cus_123", email: "auditor@example.com", name: "Auditor" },
    metadata: { thewcag_user_id: "user_123" },
    ...patch,
  } as unknown as Subscription;
}

describe("billing plans and authorization", () => {
  beforeEach(() => {
    vi.stubEnv("DODO_PRO_MONTHLY_PRODUCT_ID", "prod_monthly");
    vi.stubEnv("DODO_PRO_ANNUAL_PRODUCT_ID", "prod_annual");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only configured choices and product IDs", () => {
    expect(planForChoice("pro-monthly")?.productId).toBe("prod_monthly");
    expect(planForChoice("enterprise")).toBeNull();
    expect(planForProduct("prod_annual")?.interval).toBe("year");
    expect(planForProduct("prod_attacker")).toBeNull();
  });

  it("allows only official HTTPS checkout and portal hosts", () => {
    expect(isAllowedDodoHostedUrl("https://checkout.dodopayments.com/session", "checkout")).toBe(true);
    expect(isAllowedDodoHostedUrl("https://test.customer.dodopayments.com/session", "portal")).toBe(true);
    expect(isAllowedDodoHostedUrl("https://checkout.dodopayments.com.evil.test/session", "checkout")).toBe(false);
    expect(isAllowedDodoHostedUrl("https://attacker@checkout.dodopayments.com/session", "checkout")).toBe(false);
    expect(isAllowedDodoHostedUrl("http://checkout.dodopayments.com/session", "checkout")).toBe(false);
  });

  it("requires an active, unexpired subscription before enabling paid services", () => {
    const active = deriveEffectiveEntitlements({
      configured: true,
      subscription: {
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
        graceEndsAt: null,
        dodoCustomerId: "cus_123",
      },
      aiUsed: 4,
      activeReports: 3,
      usedBytes: 100,
      now: new Date("2026-07-22T00:00:00.000Z"),
    });
    expect(active.plan).toBe("pro");
    expect(active.features.managedAi).toMatchObject({ enabled: true, used: 4 });
    expect(active.features.hostedReports.enabled).toBe(true);

    const expired = deriveEffectiveEntitlements({
      configured: true,
      subscription: {
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
        graceEndsAt: null,
        dodoCustomerId: "cus_123",
      },
      aiUsed: 0,
      activeReports: 0,
      usedBytes: 0,
      now: new Date("2026-07-22T00:00:00.000Z"),
    });
    expect(expired.plan).toBe("free");
    expect(expired.features.managedAi.enabled).toBe(false);
  });

  it.each(["pending", "on_hold", "cancelled", "failed", "expired", "revoked"] as const)(
    "does not grant Pro for %s state",
    (status) => {
      const result = deriveEffectiveEntitlements({
        configured: true,
        subscription: {
          status,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
          graceEndsAt: null,
          dodoCustomerId: "cus_123",
        },
        aiUsed: 0,
        activeReports: 0,
        usedBytes: 0,
        now: new Date("2026-07-22T00:00:00.000Z"),
      });
      expect(result.plan).toBe("free");
      expect(result.features.hostedReports.enabled).toBe(false);
    },
  );
});

describe("production billing configuration", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.thewcag.com");
    vi.stubEnv("R2_PUBLIC_URL", "");
    vi.stubEnv("DODO_PAYMENTS_API_KEY", "");
    vi.stubEnv("DODO_PAYMENTS_WEBHOOK_KEY", "");
    vi.stubEnv("DODO_PAYMENTS_BUSINESS_ID", "");
    vi.stubEnv("DODO_PRO_MONTHLY_PRODUCT_ID", "");
    vi.stubEnv("DODO_PRO_ANNUAL_PRODUCT_ID", "");
    vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "live_mode");
    vi.stubEnv("BILLING_RECONCILE_SECRET", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("starts with billing not configured when only the environment default is present", () => {
    expect(billingConfigured()).toBe(false);
    expect(() => validateLiveBillingConfiguration()).not.toThrow();
  });

  it("rejects a genuinely partial billing configuration", () => {
    vi.stubEnv("DODO_PAYMENTS_API_KEY", "partial_api_key");
    expect(() => validateLiveBillingConfiguration()).toThrow("Dodo Payments is partially configured");
  });
});

describe("subscription and report lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("DODO_PRO_MONTHLY_PRODUCT_ID", "prod_monthly");
    vi.stubEnv("DODO_PRO_ANNUAL_PRODUCT_ID", "prod_annual");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("normalizes allowlisted Dodo subscription snapshots", () => {
    const result = normalizeDodoSubscription(subscription(), new Date("2026-07-22T00:00:00.000Z"));
    expect(result).toMatchObject({
      dodoSubscriptionId: "sub_123",
      dodoCustomerId: "cus_123",
      billingInterval: "month",
      status: "active",
    });
    expect(normalizeDodoSubscription(subscription({ product_id: "prod_unknown" }), new Date())).toBeNull();
  });

  it("provides bounded grace and retention states", () => {
    const now = new Date("2026-07-22T00:00:00.000Z");
    const onHold = normalizeDodoSubscription(subscription({ status: "on_hold" }), now);
    expect(onHold?.graceEndsAt?.toISOString()).toBe("2026-07-29T00:00:00.000Z");
    expect(reportAvailabilityForSubscription("on_hold", onHold!.graceEndsAt, now)).toBe("grace");
    expect(isReportAvailable("grace", onHold!.graceEndsAt, now)).toBe(true);
    expect(isReportAvailable("grace", onHold!.graceEndsAt, new Date("2026-07-30T00:00:00.000Z"))).toBe(false);
    expect(reportRetentionDeleteAt("revoked", null, now)).toEqual(now);
  });
});

describe("webhook primitives", () => {
  afterEach(() => {
    resetDodoClientForTests();
    vi.unstubAllEnvs();
  });

  it("hashes raw bodies deterministically and extracts remote IDs", () => {
    expect(webhookPayloadHash("payload")).toHaveLength(64);
    expect(webhookPayloadHash("payload")).toBe(webhookPayloadHash("payload"));
    expect(webhookRemoteObjectId({ data: { subscription_id: "sub_123" } } as never)).toBe("sub_123");
    expect(billingWebhookErrorCode(new Error("billing_user_unresolved"))).toBe("billing_user_unresolved");
    expect(billingWebhookErrorCode(new Error("customer email: private@example.com"))).toBe("external_Error");
  });

  it("verifies a Standard Webhooks signature over the exact raw Dodo body", () => {
    const keyBytes = Buffer.from("thewcag-signed-webhook-test-key");
    const secret = `whsec_${keyBytes.toString("base64")}`;
    vi.stubEnv("DODO_PAYMENTS_API_KEY", "test_api_key");
    vi.stubEnv("DODO_PAYMENTS_WEBHOOK_KEY", secret);
    vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "test_mode");
    const webhookId = "msg_test_123";
    const timestamp = Math.floor(Date.now() / 1_000);
    const raw = JSON.stringify({
      business_id: "bus_test",
      timestamp: new Date(timestamp * 1_000).toISOString(),
      type: "subscription.active",
      data: { subscription_id: "sub_test" },
    });
    const signature = createHmac("sha256", keyBytes).update(`${webhookId}.${timestamp}.${raw}`).digest("base64");
    const headers = new Headers({
      "webhook-id": webhookId,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": `v1,${signature}`,
    });
    expect(verifyDodoWebhook(raw, headers).type).toBe("subscription.active");
    expect(() => verifyDodoWebhook(`${raw} `, headers)).toThrow();
  });
});
