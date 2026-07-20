import { describe, expect, it } from "vitest";
import { isValidConnectState, normalizeDeviceName } from "./validation";

describe("connect request validation", () => {
  it("accepts the current and Electron 3.0 hexadecimal desktop nonces", () => {
    expect(isValidConnectState("0123456789abcdef0123456789ABCDEF")).toBe(true);
    expect(isValidConnectState("0123456789abcdef".repeat(4))).toBe(true);
    expect(isValidConnectState("0123")).toBe(false);
    expect(isValidConnectState("g".repeat(32))).toBe(false);
    expect(isValidConnectState("a".repeat(48))).toBe(false);
    expect(isValidConnectState("a".repeat(65))).toBe(false);
    expect(isValidConnectState(undefined)).toBe(false);
  });

  it("normalizes device names without allowing control characters or unbounded text", () => {
    expect(normalizeDeviceName("  QA\n Mac\u0000Book  ")).toBe("QA Mac Book");
    expect(normalizeDeviceName("   ")).toBe("Desktop");
    expect(normalizeDeviceName("x".repeat(100))).toHaveLength(80);
  });
});
