import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const boundary = vi.hoisted(() => ({
  verifyDeviceToken: vi.fn(),
  resolveEntitlements: vi.fn(),
  generateAuditTemplatePrefill: vi.fn(),
}));

vi.mock("@/lib/device-auth", () => ({ verifyDeviceToken: boundary.verifyDeviceToken }));
vi.mock("@/lib/billing/entitlements", () => ({ resolveEntitlements: boundary.resolveEntitlements }));
vi.mock("@/lib/ai-audit-template", () => ({
  DEFAULT_AUDIT_TEMPLATE_MODEL: "mock-model",
  generateAuditTemplatePrefill: boundary.generateAuditTemplatePrefill,
}));
vi.mock("@/lib/ai-finding", () => ({ safetyIdentifier: vi.fn(() => "mock-safety-id") }));
vi.mock("@/lib/db", () => ({ db: {} }));

import { POST } from "./route";

function request(token?: string) {
  return new NextRequest("https://app.thewcag.com/api/device/ai/audit-template-prefill", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ profile: { private: "must not reach AI" }, finding: { title: "Private" } }),
  });
}

describe("device audit-template prefill authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.verifyDeviceToken.mockResolvedValue(null);
  });

  it.each([
    ["missing token", undefined],
    ["wrong-device token", "wrong-device-token"],
    ["revoked token", "revoked-device-token"],
  ])("rejects a %s before reading entitlements or invoking AI", async (_label, token) => {
    const response = await POST(request(token));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(boundary.resolveEntitlements).not.toHaveBeenCalled();
    expect(boundary.generateAuditTemplatePrefill).not.toHaveBeenCalled();
  });
});
