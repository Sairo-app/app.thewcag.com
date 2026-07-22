import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const billing = vi.hoisted(() => ({
  claimWebhook: vi.fn(),
  billingWebhookErrorCode: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : "unknown_webhook_error"),
  completeWebhook: vi.fn(),
  failWebhook: vi.fn(),
  processDodoWebhook: vi.fn(),
  verifyDodoWebhook: vi.fn(),
  webhookPayloadHash: vi.fn((body: string) => `hash:${body}`),
}));

vi.mock("@/lib/billing/webhooks", () => billing);

import { POST } from "./route";

const EVENT = {
  type: "subscription.active",
  timestamp: "2026-07-22T00:00:00.000Z",
  business_id: "business_test",
  data: { subscription_id: "sub_test" },
};

function request(body = JSON.stringify(EVENT), webhookId = "msg_test_123") {
  return new NextRequest("https://app.thewcag.com/api/billing/webhooks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": webhookId,
      "webhook-signature": "boundary-signature",
      "webhook-timestamp": "1784678400",
    },
    body,
  });
}

describe("billing webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billing.verifyDodoWebhook.mockReturnValue(EVENT);
    billing.claimWebhook.mockResolvedValue("claimed");
    billing.processDodoWebhook.mockResolvedValue("applied");
    billing.completeWebhook.mockResolvedValue(undefined);
    billing.failWebhook.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an invalid signature before claiming or processing the event", async () => {
    billing.verifyDodoWebhook.mockImplementation(() => {
      throw new Error("signature mismatch");
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_webhook_signature" });
    expect(billing.claimWebhook).not.toHaveBeenCalled();
    expect(billing.processDodoWebhook).not.toHaveBeenCalled();
  });

  it("processes an id once and treats an exact replay as a duplicate", async () => {
    const claims = new Map<string, string>();
    billing.claimWebhook.mockImplementation(async ({ webhookId, payloadHash }) => {
      const storedHash = claims.get(webhookId);
      if (storedHash === payloadHash) return "duplicate";
      if (storedHash) throw new Error("webhook_id_payload_mismatch");
      claims.set(webhookId, payloadHash);
      return "claimed";
    });

    const first = await POST(request());
    const replay = await POST(request());

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ received: true, outcome: "applied" });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(billing.processDodoWebhook).toHaveBeenCalledTimes(1);
    expect(billing.completeWebhook).toHaveBeenCalledTimes(1);
  });

  it("rejects a replay that reuses an id with a different payload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const claims = new Map<string, string>();
    billing.claimWebhook.mockImplementation(async ({ webhookId, payloadHash }) => {
      const storedHash = claims.get(webhookId);
      if (storedHash && storedHash !== payloadHash) {
        throw new Error("webhook_id_payload_mismatch");
      }
      if (storedHash) return "duplicate";
      claims.set(webhookId, payloadHash);
      return "claimed";
    });

    expect((await POST(request())).status).toBe(200);
    const response = await POST(request(`${JSON.stringify(EVENT)} `));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "webhook_processing_failed" });
    expect(billing.processDodoWebhook).toHaveBeenCalledTimes(1);
    expect(billing.failWebhook).toHaveBeenCalledWith(
      "msg_test_123",
      expect.objectContaining({ message: "webhook_id_payload_mismatch" }),
    );
  });

  it("records processing failures without allowing an uncaught rejection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    billing.processDodoWebhook.mockRejectedValue(new Error("billing_business_mismatch"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(billing.failWebhook).toHaveBeenCalledWith(
      "msg_test_123",
      expect.objectContaining({ message: "billing_business_mismatch" }),
    );
    expect(billing.completeWebhook).not.toHaveBeenCalled();
  });

  it("rejects missing and unbounded webhook identifiers", async () => {
    const missing = request();
    missing.headers.delete("webhook-id");

    expect((await POST(missing)).status).toBe(400);
    expect((await POST(request("{}", "x".repeat(201)))).status).toBe(400);
    expect(billing.verifyDodoWebhook).not.toHaveBeenCalled();
  });
});
