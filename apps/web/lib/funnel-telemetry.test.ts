import { describe, expect, it } from "vitest";
import { FUNNEL_TRANSITION_EVENTS, parseFunnelTelemetryPayload } from "./funnel-telemetry";

describe("content-free funnel telemetry payloads", () => {
  it("accepts only the three anonymous transition events", () => {
    for (const event of FUNNEL_TRANSITION_EVENTS) {
      expect(parseFunnelTelemetryPayload({ event })).toEqual({ event });
    }
    expect(() => parseFunnelTelemetryPayload({ event: "finding_created" })).toThrow("Invalid telemetry payload");
  });

  it.each([
    ["audit content", { audit: { project: "Private client", scope: "Checkout" } }],
    ["URL under test", { url: "https://private.example.test/checkout" }],
    ["screenshot", { screenshot: "data:image/png;base64,private" }],
    ["finding", { finding: { title: "Private accessibility barrier" } }],
    ["email", { email: "auditor@example.com" }],
    ["anonymous identifier", { installationId: "not-accepted" }],
  ])("rejects a valid event with a non-allowlisted %s field", (_label, extra) => {
    expect(() => parseFunnelTelemetryPayload({ event: "download_to_first_plan", ...extra })).toThrow(
      "Invalid telemetry payload",
    );
  });

  it("rejects missing, nested, array, and multi-event payloads", () => {
    expect(() => parseFunnelTelemetryPayload({})).toThrow("Invalid telemetry payload");
    expect(() => parseFunnelTelemetryPayload({ event: { name: "guide_to_download" } })).toThrow(
      "Invalid telemetry payload",
    );
    expect(() => parseFunnelTelemetryPayload([{ event: "guide_to_download" }])).toThrow("Invalid telemetry payload");
    expect(() => parseFunnelTelemetryPayload({ event: "guide_to_download", events: [] })).toThrow(
      "Invalid telemetry payload",
    );
  });
});
