import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./middleware";

describe("nonce content security policy", () => {
  it("allows scripts only through the request nonce in production", () => {
    const policy = buildContentSecurityPolicy("test-nonce", false);
    const scriptDirective = policy.split("; ").find((part) => part.startsWith("script-src"));

    expect(scriptDirective).toContain("'nonce-test-nonce'");
    expect(scriptDirective).toContain("'strict-dynamic'");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(scriptDirective).not.toContain("'unsafe-eval'");
  });

  it("keeps Next development tooling allowances out of production", () => {
    const scriptDirective = buildContentSecurityPolicy("dev-nonce", true)
      .split("; ")
      .find((part) => part.startsWith("script-src"));

    expect(scriptDirective).toContain("'unsafe-inline'");
    expect(scriptDirective).toContain("'unsafe-eval'");
  });
});
