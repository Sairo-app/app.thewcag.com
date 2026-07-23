import { describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../src/shared/desktop";
import { FunnelTelemetryService, parseDesktopTelemetryRequest } from "./funnel-telemetry";

function settings(enabled: boolean): AppSettings {
  return {
    shortcuts: { inspect: "Alt+CommandOrControl+P", capture: "Alt+CommandOrControl+S", lens: "Alt+CommandOrControl+L" },
    checklistShortcuts: { pass: "p", fail: "f", notApplicable: "n", next: "j", previous: "k", expand: "Enter" },
    launchAtLogin: false,
    appearance: "light",
    reduceMotion: false,
    captureHighDpi: true,
    shareAnonymousFunnelTelemetry: enabled,
  };
}

function harness(enabled: boolean) {
  const documents = new Map<string, unknown>();
  const store = {
    async get<T>(key: string, fallback: T): Promise<T> {
      return (documents.has(key) ? documents.get(key) : fallback) as T;
    },
    async set<T>(key: string, value: T): Promise<void> {
      documents.set(key, value);
    },
  };
  const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
    new Response(null, { status: 202 }));
  const service = new FunnelTelemetryService(
    { get: async () => settings(enabled) },
    store,
    "https://app.thewcag.com",
    fetcher as unknown as typeof fetch,
  );
  return { fetcher, service };
}

describe("desktop funnel telemetry", () => {
  it("does nothing while explicit consent is off", async () => {
    const { fetcher, service } = harness(false);
    await expect(service.emit("download_to_first_plan")).resolves.toMatchObject({ reason: "disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("attempts each consented transition once with an event-only payload", async () => {
    const { fetcher, service } = harness(true);
    await expect(service.emit("download_to_first_plan")).resolves.toMatchObject({ accepted: true });
    await expect(service.emit("download_to_first_plan")).resolves.toMatchObject({ reason: "duplicate" });
    await expect(service.emit("first_plan_to_first_deliver")).resolves.toMatchObject({ accepted: true });

    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, init] of fetcher.mock.calls) {
      const payload = JSON.parse(String(init?.body));
      expect(Object.keys(payload)).toEqual(["event"]);
      expect(JSON.stringify(payload)).not.toMatch(/audit|url|screenshot|finding|email|project/i);
    }
  });

  it("does not emit Deliver before the first completed Plan transition", async () => {
    const { fetcher, service } = harness(true);
    await expect(service.emit("first_plan_to_first_deliver")).resolves.toMatchObject({ reason: "prerequisite" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("retries after a transient 503 and records the event after success", async () => {
    const { fetcher, service } = harness(true);
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(service.emit("download_to_first_plan")).resolves.toMatchObject({
      accepted: false,
      reason: "unavailable",
    });
    await expect(service.emit("download_to_first_plan")).resolves.toMatchObject({ accepted: true });
    await expect(service.emit("download_to_first_plan")).resolves.toMatchObject({ reason: "duplicate" });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not retry a terminal 4xx response", async () => {
    const { fetcher, service } = harness(true);
    fetcher.mockResolvedValueOnce(new Response(null, { status: 400 }));

    await expect(service.emit("download_to_first_plan")).resolves.toMatchObject({ reason: "unavailable" });
    await expect(service.emit("download_to_first_plan")).resolves.toMatchObject({ reason: "duplicate" });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown events and any extra renderer field", () => {
    expect(() => parseDesktopTelemetryRequest({ event: "finding_created" })).toThrow("Unsupported telemetry event");
    expect(() => parseDesktopTelemetryRequest({
      event: "download_to_first_plan",
      audit: { project: "Private client", target: "https://private.example" },
    })).toThrow("Invalid telemetry request");
  });
});
