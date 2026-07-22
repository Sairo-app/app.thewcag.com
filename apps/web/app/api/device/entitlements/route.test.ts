import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const boundary = vi.hoisted(() => ({
  verifyDeviceToken: vi.fn(),
  resolveEntitlements: vi.fn(),
  userRows: [] as Array<{ email: string }>,
  selectWhere: vi.fn(),
}));

vi.mock("@/lib/device-auth", () => ({
  verifyDeviceToken: boundary.verifyDeviceToken,
}));
vi.mock("@/lib/billing/entitlements", () => ({
  resolveEntitlements: boundary.resolveEntitlements,
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: (condition: unknown) => {
          boundary.selectWhere(condition);
          return { limit: async () => boundary.userRows };
        },
      }),
    })),
  },
}));

import { GET } from "./route";

const ENTITLEMENTS = {
  version: 1 as const,
  plan: "pro" as const,
  subscription: {
    status: "active" as const,
    cancelAtPeriodEnd: false,
    renewsAt: "2026-08-22T00:00:00.000Z",
  },
  features: {
    managedAi: { enabled: true, used: 2, limit: 50 },
    hostedReports: { enabled: true, active: 3, limit: 20 },
    whiteLabelReports: true,
    reportAnalytics: true,
  },
  storage: { usedBytes: 1_024, quotaBytes: 1_048_576 },
  actions: {
    canUpgrade: false,
    canManageBilling: true,
    upgradeUrl: "https://app.thewcag.com/pricing",
    billingUrl: "https://app.thewcag.com/api/billing/portal",
  },
};

function request(token = "device-token", search = "") {
  return new NextRequest(`https://app.thewcag.com/api/device/entitlements${search}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("device entitlements route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.verifyDeviceToken.mockResolvedValue({ userId: "user-owner", deviceId: "device-current" });
    boundary.resolveEntitlements.mockResolvedValue(ENTITLEMENTS);
    boundary.userRows = [{ email: "owner@example.test" }];
    vi.stubEnv("OPENAI_API_KEY", "mock-openai-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated requests before reading users or billing state", async () => {
    boundary.verifyDeviceToken.mockResolvedValue(null);
    const response = await GET(new NextRequest("https://app.thewcag.com/api/device/entitlements"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ signedIn: false });
    expect(boundary.resolveEntitlements).not.toHaveBeenCalled();
    expect(boundary.selectWhere).not.toHaveBeenCalled();
  });

  it("rejects a revoked device token", async () => {
    boundary.verifyDeviceToken.mockResolvedValue(null);

    const response = await GET(request("revoked-device-token"));

    expect(response.status).toBe(401);
    expect(boundary.resolveEntitlements).not.toHaveBeenCalled();
  });

  it("returns entitlements for the token owner, not a client-supplied user", async () => {
    const response = await GET(request("valid-token", "?userId=user-victim"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(boundary.resolveEntitlements).toHaveBeenCalledWith("user-owner");
    expect(body).toMatchObject({
      signedIn: true,
      email: "owner@example.test",
      plan: "pro",
      features: {
        publishReports: true,
        aiFindingDrafts: true,
      },
    });
  });

  it("does not advertise managed AI when its server boundary is unconfigured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await GET(request());

    expect((await response.json()).features.aiFindingDrafts).toBe(false);
  });
});
