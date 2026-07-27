import { describe, expect, it } from "vitest";
import { parseCrashReportPayload, redactCrashText } from "./crash-reports";

const VALID = {
  origin: "main-uncaught-exception",
  name: "Error",
  message: "Cannot read properties of undefined",
  frames: ["at read (store.ts:4:2)"],
  fingerprint: "a".repeat(32),
  appVersion: "3.0.8",
  platform: "darwin",
  osRelease: "25.5.0",
  arch: "arm64",
};

describe("redactCrashText", () => {
  it("removes a POSIX path", () => {
    expect(redactCrashText("read /Users/aisha/Projects/store.json")).toBe("read [path]");
  });

  it("removes a Windows path", () => {
    expect(redactCrashText("C:\\Users\\Aisha\\AppData\\store.json")).toBe("[path]");
  });

  it("removes an email address", () => {
    expect(redactCrashText("owner aisha@example.com")).toBe("owner [email]");
  });

  it("keeps a URL origin but drops the path", () => {
    expect(redactCrashText("GET https://client.example.com/checkout?t=1")).toBe(
      "GET https://client.example.com/[path]",
    );
  });

  it("removes token-shaped strings", () => {
    expect(redactCrashText("token abcdefghij0123456789abcdefghij0123456789")).toBe(
      "token [redacted]",
    );
  });
});

describe("parseCrashReportPayload", () => {
  it("accepts a well-formed report", () => {
    expect(parseCrashReportPayload({ ...VALID })).toMatchObject({
      origin: "main-uncaught-exception",
      name: "Error",
      frames: ["at read (store.ts:4:2)"],
    });
  });

  it("re-redacts text a tampered client left unsanitized", () => {
    const parsed = parseCrashReportPayload({
      ...VALID,
      message: "failed for aisha@example.com at /Users/aisha/secret/store.json",
    });
    expect(parsed.message).not.toContain("aisha@example.com");
    expect(parsed.message).not.toContain("/Users/");
    expect(parsed.message).toBe("failed for [email] at [path]");
  });

  it("rejects an unknown origin", () => {
    expect(() => parseCrashReportPayload({ ...VALID, origin: "made-up" })).toThrow();
  });

  it("rejects a malformed fingerprint", () => {
    expect(() => parseCrashReportPayload({ ...VALID, fingerprint: "nope" })).toThrow();
  });

  it("rejects extra fields", () => {
    expect(() =>
      parseCrashReportPayload({ ...VALID, userEmail: "aisha@example.com" }),
    ).toThrow();
  });

  it("rejects a missing field", () => {
    const { arch: _arch, ...rest } = VALID;
    expect(() => parseCrashReportPayload(rest)).toThrow();
  });

  it("rejects more frames than the cap", () => {
    expect(() =>
      parseCrashReportPayload({ ...VALID, frames: Array.from({ length: 13 }, () => "at x (a.ts:1:1)") }),
    ).toThrow();
  });

  it("rejects a report with neither message nor frames", () => {
    expect(() => parseCrashReportPayload({ ...VALID, message: "", frames: [] })).toThrow();
  });

  it("caps an overlong message", () => {
    const parsed = parseCrashReportPayload({ ...VALID, message: "overflow ".repeat(200) });
    expect(parsed.message).toHaveLength(300);
  });

  it("collapses a token-shaped run before the length cap", () => {
    const parsed = parseCrashReportPayload({ ...VALID, message: "x".repeat(1_000) });
    expect(parsed.message).toBe("[redacted]");
  });

  it("rejects a non-object payload", () => {
    expect(() => parseCrashReportPayload(null)).toThrow();
    expect(() => parseCrashReportPayload([VALID])).toThrow();
  });
});
