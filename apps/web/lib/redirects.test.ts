import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "./redirects";

describe("safeCallbackPath", () => {
  it("preserves local paths and query strings", () => {
    expect(safeCallbackPath("/connect?state=abc")).toBe("/connect?state=abc");
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(safeCallbackPath("https://evil.example/phish")).toBe("/screenshots");
    expect(safeCallbackPath("//evil.example/phish")).toBe("/screenshots");
  });
});
