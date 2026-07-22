import type { ReportIssue } from "./schema";

export const A11Y_SCAN_REPORT_SLUG = "A11yScan01";

const ISSUES: ReportIssue[] = [
  {
    id: "WCG-F-20260722-00000-00000-00000-00000-000101",
    n: 1,
    sc: "2.4.7",
    label: "Keyboard focus is obscured by the sticky action bar",
    severity: "blocker",
    status: "open",
    note: "Keep the focused control visible when the action bar is present.",
  },
  {
    id: "WCG-F-20260722-00000-00000-00000-00000-000102",
    n: 2,
    sc: "1.4.3",
    label: "Secondary instructions need stronger contrast",
    severity: "major",
    status: "retest",
    note: "Retest the updated instruction color against the report surface.",
  },
  {
    id: "WCG-F-20260722-00000-00000-00000-00000-000103",
    n: 3,
    sc: "4.1.2",
    label: "Icon-only action needs an accessible name",
    severity: "minor",
    status: "fixed",
    note: "The control now exposes a concise programmatic name.",
  },
];

/** Synthetic report data used only by the built-site accessibility scan. */
export function a11yScanReportFixture(slug: string) {
  if (
    process.env.ACCESSIBILITY_SCAN_FIXTURE !== "1" ||
    slug !== A11Y_SCAN_REPORT_SLUG
  ) return null;
  return {
    title: "Synthetic checkout accessibility review",
    description: "Authored CI fixture with representative severities, statuses, filters, and annotated evidence controls.",
    issues: ISSUES,
    createdAt: new Date("2026-07-22T00:00:00.000Z"),
    availabilityStatus: "active",
    graceEndsAt: null,
    userId: "a11y-scan-fixture-owner",
    brandName: null,
    brandColor: null,
    brandLogoKey: null,
    whiteLabelEnabled: false,
  } as const;
}

export const A11Y_SCAN_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
