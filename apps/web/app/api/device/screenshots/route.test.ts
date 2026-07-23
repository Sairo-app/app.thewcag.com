import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const boundary = vi.hoisted(() => ({
  verifyDeviceToken: vi.fn(),
  resolveEntitlements: vi.fn(),
  putImage: vi.fn(),
  deleteImageBestEffort: vi.fn(),
  generateSlug: vi.fn(() => "AbCdEf1234"),
  transaction: vi.fn(),
  insertedReport: vi.fn(),
}));

vi.mock("@/lib/device-auth", () => ({
  verifyDeviceToken: boundary.verifyDeviceToken,
}));
vi.mock("@/lib/billing/entitlements", () => ({
  resolveEntitlements: boundary.resolveEntitlements,
}));
vi.mock("@/lib/r2", () => ({
  putImage: boundary.putImage,
  deleteImageBestEffort: boundary.deleteImageBestEffort,
}));
vi.mock("@/lib/reports", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reports")>();
  return { ...actual, generateSlug: boundary.generateSlug };
});
vi.mock("@/lib/db", () => ({
  db: { transaction: boundary.transaction },
}));

import { POST } from "./route";

const ENTITLEMENTS = {
  version: 1 as const,
  plan: "pro" as const,
  subscription: { status: "active" as const, cancelAtPeriodEnd: false },
  features: {
    managedAi: { enabled: true, used: 0, limit: 50 },
    hostedReports: { enabled: true, active: 0, limit: 20 },
    whiteLabelReports: true,
    reportAnalytics: true,
  },
  storage: { usedBytes: 0, quotaBytes: 1024 * 1024 },
  actions: {
    canUpgrade: false,
    canManageBilling: true,
    upgradeUrl: "https://app.thewcag.com/pricing",
    billingUrl: "https://app.thewcag.com/api/billing/portal",
  },
};

function pngBase64(): string {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type: string, data = Buffer.alloc(0)) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IEND")]).toString("base64");
}

function request(token?: string, overrides: Record<string, unknown> = {}) {
  return new NextRequest("https://app.thewcag.com/api/device/screenshots", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      userId: "user-attacker",
      title: "Keyboard focus evidence",
      description: "Auditor-approved public description",
      imageBase64: pngBase64(),
      issues: [{ n: 1, sc: "2.4.7", label: "Focus hidden", severity: "major", note: "Keep focus visible" }],
      ...overrides,
    }),
  });
}

function queryResult(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => promise,
    then: promise.then.bind(promise),
  };
  return chain;
}

function successfulTransactionBoundary() {
  boundary.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    const results = [
      [{ status: "active", end: new Date(Date.now() + 60_000) }],
      [{ total: "0" }],
      [{ value: 0 }],
    ];
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn(() => queryResult(results.shift() ?? [])),
      insert: vi.fn(() => ({
        values: (value: unknown) => {
          boundary.insertedReport(value);
          return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
        },
      })),
    };
    return callback(tx);
  });
}

describe("device report publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.verifyDeviceToken.mockResolvedValue({ userId: "user-owner", deviceId: "device-current" });
    boundary.resolveEntitlements.mockResolvedValue(ENTITLEMENTS);
    boundary.putImage.mockResolvedValue(undefined);
    boundary.deleteImageBestEffort.mockResolvedValue(true);
    successfulTransactionBoundary();
  });

  it.each([
    ["missing", undefined],
    ["wrong-device", "wrong-device-token"],
    ["revoked", "revoked-device-token"],
  ])("rejects a %s token before touching entitlements, Postgres, or R2", async (_label, token) => {
    boundary.verifyDeviceToken.mockResolvedValue(null);

    const response = await POST(request(token));

    expect(response.status).toBe(401);
    expect(boundary.resolveEntitlements).not.toHaveBeenCalled();
    expect(boundary.transaction).not.toHaveBeenCalled();
    expect(boundary.putImage).not.toHaveBeenCalled();
  });

  it("rejects an inactive entitlement before uploading to R2", async () => {
    boundary.resolveEntitlements.mockResolvedValue({
      ...ENTITLEMENTS,
      plan: "free",
      subscription: { status: "revoked", cancelAtPeriodEnd: false },
      features: {
        ...ENTITLEMENTS.features,
        hostedReports: { ...ENTITLEMENTS.features.hostedReports, enabled: false },
      },
    });

    const response = await POST(request("valid-token"));

    expect(response.status).toBe(402);
    expect(boundary.putImage).not.toHaveBeenCalled();
    expect(boundary.transaction).not.toHaveBeenCalled();
  });

  it("publishes for the authenticated token owner with R2 mocked at the boundary", async () => {
    const response = await POST(request("valid-token", {
      title: "t".repeat(200),
      issues: [{
        n: 1,
        sc: ["1.4.3", "4.1.2"],
        label: "Multi-criterion finding",
        severity: "major",
        note: "Keep every mapping",
      }],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      slug: "AbCdEf1234",
      url: "https://app.thewcag.com/s/AbCdEf1234",
    });
    expect(boundary.resolveEntitlements).toHaveBeenCalledWith("user-owner");
    expect(boundary.putImage).toHaveBeenCalledWith(
      "screenshots/AbCdEf1234.png",
      expect.any(Buffer),
      "image/png",
    );
    expect(boundary.insertedReport).toHaveBeenCalledWith(expect.objectContaining({
      slug: "AbCdEf1234",
      userId: "user-owner",
      title: "t".repeat(160),
      issues: [expect.objectContaining({ sc: ["1.4.3", "4.1.2"] })],
      availabilityStatus: "active",
    }));
    expect(boundary.insertedReport).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-attacker" }),
    );
  });
});
