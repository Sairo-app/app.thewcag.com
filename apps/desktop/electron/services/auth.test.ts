import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JsonStore } from "./store";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (value: Buffer) => value.toString().replace(/^encrypted:/, ""),
  },
  shell: { openExternal: vi.fn() },
}));

import { AuthService } from "./auth";

const directories: string[] = [];
const STATE = "0123456789abcdef0123456789abcdef";
const CODE = "a".repeat(64);
const TOKEN = "b".repeat(64);

function storeHarness(createdAt = Date.now()) {
  const documents = new Map<string, unknown>([["auth-pending", { state: STATE, createdAt }]]);
  const store = {
    async get<T>(key: string, fallback: T): Promise<T> {
      return (documents.has(key) ? documents.get(key) : fallback) as T;
    },
    async set<T>(key: string, value: T): Promise<void> {
      documents.set(key, value);
    },
    async remove(key: string): Promise<void> {
      documents.delete(key);
    },
  } as unknown as JsonStore;
  return { documents, store };
}

async function harness(createdAt = Date.now(), response = new Response(JSON.stringify({ token: TOKEN }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
})) {
  const directory = await mkdtemp(join(tmpdir(), "thewcag-auth-claim-"));
  directories.push(directory);
  const { documents, store } = storeHarness(createdAt);
  const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => response);
  const service = new AuthService(
    directory,
    store,
    "https://app.thewcag.com",
    fetcher as unknown as typeof fetch,
  );
  return { directory, documents, fetcher, service };
}

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("desktop device claim exchange", () => {
  it("posts the one-time code and saves only the returned bearer token", async () => {
    const { directory, documents, fetcher, service } = await harness();

    await expect(service.handleDeepLink(`thewcag://auth?code=${CODE}&state=${STATE}`)).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://app.thewcag.com/api/device/claim");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ code: CODE });
    await expect(readFile(join(directory, "device-token.bin"), "utf8")).resolves.toBe(`encrypted:${TOKEN}`);
    expect(documents.has("auth-pending")).toBe(false);
  });

  it("rejects an expired local request without sending the code", async () => {
    const { documents, fetcher, service } = await harness(Date.now() - 10 * 60 * 1_000);

    await expect(service.handleDeepLink(`thewcag://auth?code=${CODE}&state=${STATE}`))
      .rejects.toThrow("sign-in request expired");

    expect(fetcher).not.toHaveBeenCalled();
    expect(documents.has("auth-pending")).toBe(false);
  });

  it("surfaces a replayed-code rejection and clears the completed request", async () => {
    const response = new Response(JSON.stringify({
      error: "claim_already_used",
      message: "This sign-in link has already been used.",
    }), { status: 409, headers: { "Content-Type": "application/json" } });
    const { documents, service } = await harness(Date.now(), response);

    await expect(service.handleDeepLink(`thewcag://auth?code=${CODE}&state=${STATE}`))
      .rejects.toThrow("already been used");

    expect(documents.has("auth-pending")).toBe(false);
  });
});

describe("desktop entitlement resilience", () => {
  const entitlements = {
    email: "auditor@example.com",
    plan: "pro",
    features: {
      managedAi: { enabled: true, used: 3, limit: 150 },
      hostedReports: { enabled: true, active: 2, limit: 100 },
      whiteLabelReports: true,
      reportAnalytics: true,
      publishReports: true,
      aiFindingDrafts: true,
    },
    storage: { usedBytes: 1024, quotaBytes: 1024 * 1024 },
    actions: {
      canUpgrade: false,
      canManageBilling: true,
      upgradeUrl: "https://app.thewcag.com/pricing",
    },
    subscription: { status: "active", cancelAtPeriodEnd: false },
  };

  it("uses cached last-known entitlements when a refresh is unavailable", async () => {
    const { directory, documents, fetcher, service } = await harness();
    await writeFile(join(directory, "device-token.bin"), `encrypted:${TOKEN}`);
    fetcher
      .mockResolvedValueOnce(new Response(JSON.stringify(entitlements), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockRejectedValueOnce(new Error("network unavailable"));

    await expect(service.getAccount()).resolves.toMatchObject({
      signedIn: true,
      featuresState: "loaded",
      plan: "pro",
      features: { hostedReports: { enabled: true } },
    });
    expect(documents.has("auth-entitlements-cache")).toBe(true);
    await expect(service.getAccount()).resolves.toMatchObject({
      signedIn: true,
      featuresState: "unavailable",
      plan: "pro",
      features: { hostedReports: { enabled: true } },
    });
  });

  it("reports unavailable entitlements without pretending the account is Free", async () => {
    const { directory, service } = await harness(
      Date.now(),
      new Response("Service unavailable", { status: 503 }),
    );
    await writeFile(join(directory, "device-token.bin"), `encrypted:${TOKEN}`);

    await expect(service.getAccount()).resolves.toEqual({
      signedIn: true,
      featuresState: "unavailable",
    });
  });
});

describe("desktop report publishing", () => {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it("publishes every mapped criterion and applies the same public copy caps", async () => {
    const response = new Response(JSON.stringify({ url: "https://app.thewcag.com/s/published-report" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const { directory, fetcher, service } = await harness(Date.now(), response);
    await writeFile(join(directory, "device-token.bin"), `encrypted:${TOKEN}`);

    await expect(service.publish({
      title: "t".repeat(200),
      description: "Report description",
      issues: [{
        id: "WCG-F-20260722-00000-00000-00000-00000-000001",
        n: 40,
        sc: ["1.4.3", "4.1.2"],
        label: "l".repeat(200),
        severity: "blocker",
        note: "n".repeat(6_000),
        status: "retest",
      }],
      imageBase64: pngSignature.toString("base64"),
    })).resolves.toBe("https://app.thewcag.com/s/published-report");

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.title).toHaveLength(160);
    expect(body.issues).toEqual([expect.objectContaining({
      n: 1,
      sc: ["1.4.3", "4.1.2"],
      severity: "blocker",
      status: "retest",
    })]);
    expect(body.issues[0].label).toHaveLength(160);
    expect(body.issues[0].note).toHaveLength(5_000);
  });

  it("rejects a serialized request over the server cap before making a request", async () => {
    const { directory, fetcher, service } = await harness();
    await writeFile(join(directory, "device-token.bin"), `encrypted:${TOKEN}`);
    const image = Buffer.alloc(4_000_000);
    pngSignature.copy(image);

    await expect(service.publish({
      title: "Large report",
      issues: Array.from({ length: 100 }, (_, index) => ({
        n: index + 1,
        label: `Finding ${index + 1}`,
        note: "n".repeat(5_000),
      })),
      imageBase64: image.toString("base64"),
    })).rejects.toThrow("too large to publish");

    expect(fetcher).not.toHaveBeenCalled();
  });
});
