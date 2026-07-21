import { describe, expect, it } from "vitest";
import { WCAG_CRITERIA } from "./wcag";
import { CRITERION_GUIDANCE, understandingUrl } from "./criterion-guidance";

describe("criterion guidance", () => {
  it("covers every supported WCAG 2.2 A and AA criterion", () => {
    expect(Object.keys(CRITERION_GUIDANCE)).toHaveLength(WCAG_CRITERIA.length);
    for (const criterion of WCAG_CRITERIA) {
      const guidance = CRITERION_GUIDANCE[criterion.sc];
      expect(guidance?.verify.length).toBeGreaterThan(30);
      expect(guidance?.test.length).toBeGreaterThan(30);
      expect(guidance?.pass.length).toBeGreaterThan(30);
    }
  });

  it("builds official W3C Understanding links", () => {
    expect(understandingUrl("Target Size (Minimum)")).toBe(
      "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html",
    );
    expect(understandingUrl("Name, Role, Value")).toContain("name-role-value.html");
  });
});
