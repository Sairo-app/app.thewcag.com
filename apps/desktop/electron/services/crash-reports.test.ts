import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../src/shared/desktop";
import {
  buildCrashReport,
  CrashReportService,
  fingerprintOf,
  redact,
  sanitizeStack,
  type CrashReportEnvironment,
} from "./crash-reports";

const ENVIRONMENT: CrashReportEnvironment = {
  appVersion: "3.0.8",
  platform: "darwin",
  osRelease: "25.5.0",
  arch: "arm64",
};

function settingsReader(shareCrashReports: boolean) {
  return {
    get: async () => ({ shareCrashReports } as unknown as AppSettings),
  };
}

function memoryStore() {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async <T>(key: string, fallback: T) => (data.has(key) ? (data.get(key) as T) : fallback),
    set: async <T>(key: string, value: T) => {
      data.set(key, value);
    },
  };
}

function okFetch(calls: unknown[]): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ accepted: true }), { status: 202 });
  }) as unknown as typeof fetch;
}

describe("redact", () => {
  it("reduces a POSIX home directory path to a file name", () => {
    expect(redact("at load (/Users/aisha.khan/Projects/audit/store.ts:20:5)")).toBe(
      "at load (store.ts:20:5)",
    );
  });

  it("reduces a Windows user path to a file name", () => {
    expect(redact("C:\\Users\\Aisha\\AppData\\Roaming\\TheWCAG\\store.json")).toBe("store.json");
  });

  it("removes an email address", () => {
    expect(redact("failed for aisha.khan+work@example.com")).toBe("failed for [email]");
  });

  it("keeps a URL origin but drops the path and query", () => {
    expect(redact("GET https://client.example.com/checkout?token=abc failed")).toBe(
      "GET https://client.example.com/[path] failed",
    );
  });

  it("removes token-shaped strings", () => {
    expect(redact("bearer abcdefghij0123456789abcdefghij0123456789")).toBe("bearer [redacted]");
  });

  it("leaves text with nothing sensitive untouched", () => {
    expect(redact("Cannot read properties of undefined")).toBe(
      "Cannot read properties of undefined",
    );
  });
});

describe("sanitizeStack", () => {
  it("keeps only redacted frames and caps their number", () => {
    const stack = [
      "Error: boom",
      ...Array.from({ length: 20 }, (_v, index) => `    at fn${index} (/Users/a/app/file${index}.ts:1:1)`),
    ].join("\n");
    const frames = sanitizeStack(stack);
    expect(frames).toHaveLength(12);
    expect(frames[0]).toBe("at fn0 (file0.ts:1:1)");
    expect(frames.join("\n")).not.toContain("/Users/");
  });

  it("returns nothing for a missing stack", () => {
    expect(sanitizeStack(undefined)).toEqual([]);
  });
});

describe("buildCrashReport", () => {
  it("produces a redacted report with environment details", () => {
    const error = new Error("Failed reading /Users/aisha/store.json");
    error.stack = "Error: x\n    at read (/Users/aisha/app/store.ts:4:2)";
    const report = buildCrashReport("main-uncaught-exception", error, ENVIRONMENT);

    expect(report).not.toBeNull();
    expect(report!.message).toBe("Failed reading store.json");
    expect(report!.frames).toEqual(["at read (store.ts:4:2)"]);
    expect(report!.appVersion).toBe("3.0.8");
    expect(report!.platform).toBe("darwin");
    expect(report!.fingerprint).toMatch(/^[a-f0-9]{32}$/);
  });

  it("rejects an unknown origin", () => {
    expect(
      buildCrashReport("not-an-origin" as never, new Error("boom"), ENVIRONMENT),
    ).toBeNull();
  });

  it("returns nothing when there is no message and no frame", () => {
    const empty = new Error("");
    empty.stack = undefined;
    expect(buildCrashReport("main-uncaught-exception", empty, ENVIRONMENT)).toBeNull();
  });

  it("keeps a report that has frames but no message", () => {
    const error = new Error("");
    error.stack = "Error\n    at run (/Users/a/app/main.ts:9:1)";
    expect(buildCrashReport("main-uncaught-exception", error, ENVIRONMENT)).toMatchObject({
      message: "",
      frames: ["at run (main.ts:9:1)"],
    });
  });

  it("gives the same fingerprint to the same failure", () => {
    expect(fingerprintOf("Error", "boom", ["at a"])).toBe(fingerprintOf("Error", "boom", ["at a"]));
    expect(fingerprintOf("Error", "boom", ["at a"])).not.toBe(
      fingerprintOf("Error", "other", ["at a"]),
    );
  });
});

describe("CrashReportService", () => {
  it("sends nothing while the setting is off", async () => {
    const calls: unknown[] = [];
    const service = new CrashReportService(
      settingsReader(false),
      memoryStore(),
      ENVIRONMENT,
      "https://app.thewcag.com",
      okFetch(calls),
    );

    await expect(service.report("main-uncaught-exception", new Error("boom"))).resolves.toEqual({
      attempted: false,
      accepted: false,
      reason: "disabled",
    });
    expect(calls).toHaveLength(0);
  });

  it("sends a redacted report once consent is given", async () => {
    const calls: unknown[] = [];
    const service = new CrashReportService(
      settingsReader(true),
      memoryStore(),
      ENVIRONMENT,
      "https://app.thewcag.com",
      okFetch(calls),
    );

    await expect(service.report("main-uncaught-exception", new Error("boom"))).resolves.toEqual({
      attempted: true,
      accepted: true,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ origin: "main-uncaught-exception", name: "Error", message: "boom" });
  });

  it("suppresses the same crash inside the dedupe window and sends it again after", async () => {
    const calls: unknown[] = [];
    let now = 1_000;
    const service = new CrashReportService(
      settingsReader(true),
      memoryStore(),
      ENVIRONMENT,
      "https://app.thewcag.com",
      okFetch(calls),
      () => now,
    );

    // The same error object: the fingerprint covers the stack, so two `new
    // Error("boom")` calls on different lines are legitimately different crashes.
    const failure = new Error("boom");

    await service.report("main-uncaught-exception", failure);
    await expect(service.report("main-uncaught-exception", failure)).resolves.toEqual({
      attempted: false,
      accepted: false,
      reason: "duplicate",
    });
    expect(calls).toHaveLength(1);

    now += 25 * 60 * 60 * 1_000;
    await expect(service.report("main-uncaught-exception", failure)).resolves.toEqual({
      attempted: true,
      accepted: true,
    });
    expect(calls).toHaveLength(2);
  });

  it("treats crashes from different call sites as distinct", async () => {
    const calls: unknown[] = [];
    const service = new CrashReportService(
      settingsReader(true),
      memoryStore(),
      ENVIRONMENT,
      "https://app.thewcag.com",
      okFetch(calls),
    );

    const first = new Error("boom");
    first.stack = "Error: boom\n    at alpha (/app/a.ts:1:1)";
    const second = new Error("boom");
    second.stack = "Error: boom\n    at beta (/app/b.ts:1:1)";

    await service.report("main-uncaught-exception", first);
    await service.report("main-uncaught-exception", second);

    expect(calls).toHaveLength(2);
  });

  it("stops after the per-session cap so a crash loop cannot flood", async () => {
    const calls: unknown[] = [];
    const service = new CrashReportService(
      settingsReader(true),
      memoryStore(),
      ENVIRONMENT,
      "https://app.thewcag.com",
      okFetch(calls),
    );

    for (let index = 0; index < 8; index += 1) {
      await service.report("main-uncaught-exception", new Error(`boom ${index}`));
    }

    expect(calls).toHaveLength(5);
  });

  it("keeps a crash eligible when the server is unavailable", async () => {
    const store = memoryStore();
    const failing = (async () =>
      new Response("", { status: 503 })) as unknown as typeof fetch;
    const service = new CrashReportService(
      settingsReader(true),
      store,
      ENVIRONMENT,
      "https://app.thewcag.com",
      failing,
    );

    await expect(service.report("main-uncaught-exception", new Error("boom"))).resolves.toEqual({
      attempted: true,
      accepted: false,
      reason: "unavailable",
    });
    expect(store.data.get("crash-reports-v1")).toBeUndefined();
  });

  it("never rejects when the network throws", async () => {
    const throwing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const service = new CrashReportService(
      settingsReader(true),
      memoryStore(),
      ENVIRONMENT,
      "https://app.thewcag.com",
      throwing,
    );

    await expect(service.report("main-uncaught-exception", new Error("boom"))).resolves.toEqual({
      attempted: true,
      accepted: false,
      reason: "unavailable",
    });
  });
});
