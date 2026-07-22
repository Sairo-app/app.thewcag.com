import { afterEach, describe, expect, it } from "vitest";
import {
  A11Y_SCAN_REPORT_SLUG,
  a11yScanReportFixture,
} from "./a11y-scan-fixture";

const originalFlag = process.env.ACCESSIBILITY_SCAN_FIXTURE;

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.ACCESSIBILITY_SCAN_FIXTURE;
  } else {
    process.env.ACCESSIBILITY_SCAN_FIXTURE = originalFlag;
  }
});

describe("built-site accessibility scan report fixture", () => {
  it("is unavailable unless the explicit scan flag is enabled", () => {
    delete process.env.ACCESSIBILITY_SCAN_FIXTURE;
    expect(a11yScanReportFixture(A11Y_SCAN_REPORT_SLUG)).toBeNull();
  });

  it("serves only the exact synthetic scan slug when enabled", () => {
    process.env.ACCESSIBILITY_SCAN_FIXTURE = "1";
    expect(a11yScanReportFixture(A11Y_SCAN_REPORT_SLUG)?.issues).toHaveLength(3);
    expect(a11yScanReportFixture("customer-report")).toBeNull();
  });
});
