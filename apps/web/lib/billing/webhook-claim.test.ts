import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  inserted: [] as Array<{ webhookId: string }>,
  stored: [] as Array<{ status: string; payloadHash: string; createdAt: Date }>,
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: (value: unknown) => {
        boundary.insertValues(value);
        return {
          onConflictDoNothing: () => ({
            returning: async () => boundary.inserted,
          }),
        };
      },
    })),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => boundary.stored,
        }),
      }),
    })),
    update: vi.fn(() => ({
      set: (value: unknown) => {
        boundary.updateSet(value);
        return {
          where: async (condition: unknown) => {
            boundary.updateWhere(condition);
          },
        };
      },
    })),
  },
}));

vi.mock("./dodo", () => ({
  dodoClient: vi.fn(),
  dodoWebhookKey: vi.fn(),
}));
vi.mock("./subscriptions", () => ({ applySubscriptionSnapshot: vi.fn() }));

import { claimWebhook } from "./webhooks";

const EVENT = {
  type: "subscription.active",
  timestamp: "2026-07-22T00:00:00.000Z",
  business_id: "business_test",
  data: { subscription_id: "sub_test" },
};

describe("billing webhook claim idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.inserted = [];
    boundary.stored = [];
  });

  it("claims a previously unseen webhook id", async () => {
    boundary.inserted = [{ webhookId: "msg_new" }];

    await expect(claimWebhook({
      webhookId: "msg_new",
      event: EVENT as never,
      payloadHash: "hash-a",
    })).resolves.toBe("claimed");
    expect(boundary.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      webhookId: "msg_new",
      payloadHash: "hash-a",
      status: "processing",
    }));
  });

  it("returns duplicate for an already processed replay with the same hash", async () => {
    boundary.stored = [{
      status: "processed",
      payloadHash: "hash-a",
      createdAt: new Date(),
    }];

    await expect(claimWebhook({
      webhookId: "msg_replay",
      event: EVENT as never,
      payloadHash: "hash-a",
    })).resolves.toBe("duplicate");
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("rejects an id replayed with a different signed payload", async () => {
    boundary.stored = [{
      status: "processed",
      payloadHash: "hash-original",
      createdAt: new Date(),
    }];

    await expect(claimWebhook({
      webhookId: "msg_replay",
      event: EVENT as never,
      payloadHash: "hash-mutated",
    })).rejects.toThrow("webhook_id_payload_mismatch");
    expect(boundary.updateSet).not.toHaveBeenCalled();
  });

  it("reclaims failed and stale processing events for a safe retry", async () => {
    boundary.stored = [{
      status: "failed",
      payloadHash: "hash-a",
      createdAt: new Date(),
    }];
    await expect(claimWebhook({
      webhookId: "msg_failed",
      event: EVENT as never,
      payloadHash: "hash-a",
    })).resolves.toBe("claimed");
    expect(boundary.updateSet).toHaveBeenLastCalledWith({
      status: "processing",
      errorCode: null,
    });

    vi.clearAllMocks();
    boundary.stored = [{
      status: "processing",
      payloadHash: "hash-a",
      createdAt: new Date(Date.now() - 6 * 60 * 1_000),
    }];
    await expect(claimWebhook({
      webhookId: "msg_stale",
      event: EVENT as never,
      payloadHash: "hash-a",
    })).resolves.toBe("claimed");
    expect(boundary.updateSet).toHaveBeenCalledWith({
      status: "processing",
      errorCode: null,
    });
  });
});
