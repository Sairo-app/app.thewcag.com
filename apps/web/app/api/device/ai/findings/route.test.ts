import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const boundary = vi.hoisted(() => ({
  verifyDeviceToken: vi.fn(),
  resolveEntitlements: vi.fn(),
  generateAiFinding: vi.fn(),
}));

vi.mock("@/lib/device-auth", () => ({
  verifyDeviceToken: boundary.verifyDeviceToken,
}));
vi.mock("@/lib/billing/entitlements", () => ({
  resolveEntitlements: boundary.resolveEntitlements,
}));
vi.mock("@/lib/ai-finding", () => ({
  DEFAULT_FINDING_MODEL: "mock-model",
  generateAiFinding: boundary.generateAiFinding,
  safetyIdentifier: vi.fn(() => "mock-safety-id"),
}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { POST } from "./route";

function request(token?: string) {
  return new NextRequest("https://app.thewcag.com/api/device/ai/findings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ evidence: { private: "must not reach AI" } }),
  });
}

describe("device AI authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.verifyDeviceToken.mockResolvedValue(null);
  });

  it.each([
    ["missing token", undefined],
    ["wrong-device token", "wrong-device-token"],
    ["revoked token", "revoked-device-token"],
  ])("rejects a %s before resolving entitlements or invoking AI", async (_label, token) => {
    const response = await POST(request(token));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(boundary.resolveEntitlements).not.toHaveBeenCalled();
    expect(boundary.generateAiFinding).not.toHaveBeenCalled();
  });
});
