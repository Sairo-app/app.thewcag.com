import { describe, expect, it } from "vitest";
import {
  isAxeSignalTriaged,
  validateAxeTriageAllowlist,
  type AxeTriageAllowlist,
} from "./triage";

const ENTRY = {
  ruleId: "color-contrast",
  routes: ["/pricing"],
  profiles: ["desktop" as const],
  targets: ['[".pricing-note"]'],
  reason: "Known third-party treatment awaiting a reviewed token update.",
  owner: "Web platform",
  issue: "https://github.com/Sairo-app/app.thewcag.com/issues/123",
  expiresOn: "2026-12-31",
};

describe("axe signal triage allowlist", () => {
  it("matches only an exact rule, route, profile, and target", () => {
    const allowlist: AxeTriageAllowlist = {
      version: 1,
      notice: "Automated accessibility signals, not a conformance claim.",
      entries: [ENTRY],
    };
    expect(isAxeSignalTriaged({
      ruleId: "color-contrast",
      route: "/pricing",
      profile: "desktop",
      target: '[".pricing-note"]',
    }, allowlist)).toBe(true);
    expect(isAxeSignalTriaged({
      ruleId: "color-contrast",
      route: "/pricing",
      profile: "mobile-320",
      target: '[".pricing-note"]',
    }, allowlist)).toBe(false);
  });

  it("rejects expired or unaccountable triage entries", () => {
    expect(() => validateAxeTriageAllowlist({
      version: 1,
      notice: "Automated accessibility signals, not a conformance claim.",
      entries: [{ ...ENTRY, expiresOn: "2026-01-01" }],
    }, new Date("2026-07-22T00:00:00.000Z"))).toThrow("expired");
    expect(() => validateAxeTriageAllowlist({
      version: 1,
      notice: "Automated accessibility signals, not a conformance claim.",
      entries: [{ ...ENTRY, issue: "", owner: "" }],
    })).toThrow("incomplete or invalid");
  });
});
