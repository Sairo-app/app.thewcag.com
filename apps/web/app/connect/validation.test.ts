import { describe, expect, it } from "vitest";
import { isValidConnectState, normalizeDeviceName } from "./validation";

describe("connect request validation", () => {
  it("accepts only the 128-bit hexadecimal desktop nonce", () => {
    expect(isValidConnectState("0123456789abcdef0123456789ABCDEF")).toBe(true);
    expect(isValidConnectState("0123")).toBe(false);
    expect(isValidConnectState("g".repeat(32))).toBe(false);
    expect(isValidConnectState(undefined)).toBe(false);
  });

  it("normalizes device names without allowing control characters or unbounded text", () => {
    expect(normalizeDeviceName("  QA\n Mac\u0000Book  ")).toBe("QA Mac Book");
    expect(normalizeDeviceName("   ")).toBe("Desktop");
    expect(normalizeDeviceName("x".repeat(100))).toHaveLength(80);
  });
});
