import type { ReportIssue } from "./schema";

/**
 * A permanently available demonstration of the published report format.
 *
 * This is the real report renderer showing an authored example, not a customer
 * audit: the subject is a fictional storefront on `checkout.example`, and the
 * title says so. It exists so the marketing site can show the actual artifact a
 * reviewer receives instead of describing it.
 */
export const SAMPLE_REPORT_SLUG = "sample-checkout-audit";

/** Committed under `public/`, so no database row or object storage is involved. */
export const SAMPLE_REPORT_IMAGE_PATH = "/sample/checkout-audit.png";

const ISSUES: ReportIssue[] = [
  {
    id: "WCG-F-20260728-00000-00000-00000-00000-000201",
    n: 1,
    sc: ["1.4.3"],
    label: "Promotional code hint fails minimum contrast",
    severity: "major",
    status: "open",
    note: "The hint below the promotional code field measures 2.9:1 against the panel. Text under 18.66px needs at least 4.5:1, so the guidance is unreadable for many people in bright conditions or with reduced contrast sensitivity. Darkening the hint to the body colour already in the palette clears the threshold.",
  },
  {
    id: "WCG-F-20260728-00000-00000-00000-00000-000202",
    n: 2,
    sc: ["3.3.2", "4.1.2"],
    label: "Card expiry inputs have no programmatic label",
    severity: "blocker",
    status: "open",
    note: "The month and year selects are introduced by a visual heading only. A screen reader announces them as unlabelled combo boxes, so the field's purpose is unavailable without sight of the layout. Associating each control with its own label, or an aria-label naming month and year, resolves it.",
  },
  {
    id: "WCG-F-20260728-00000-00000-00000-00000-000203",
    n: 3,
    sc: ["2.4.7"],
    label: "Focus indicator is clipped by the sticky summary bar",
    severity: "major",
    status: "retest",
    note: "Tabbing to Place order scrolls the control under the sticky order summary, leaving roughly half the focus ring hidden. Keyboard users lose track of position at the final step of the flow. Scroll padding equal to the bar height keeps the focused control clear; queued for retest after the layout change.",
  },
  {
    id: "WCG-F-20260728-00000-00000-00000-00000-000204",
    n: 4,
    sc: ["1.1.1"],
    label: "Payment provider logos carry no text alternative",
    severity: "minor",
    status: "fixed",
    note: "The accepted-card images had empty alt attributes while conveying which methods are available. They now expose the provider names, and the decorative separator beside them is correctly hidden from assistive technology.",
  },
];

/**
 * Returns the sample when the slug matches, otherwise null so the caller falls
 * through to the published-report lookup. Unlike the CI scan fixture this is not
 * environment gated: the page is part of the public site.
 */
export function sampleReport(slug: string) {
  if (slug !== SAMPLE_REPORT_SLUG) return null;
  return {
    title: "Sample report: checkout accessibility review",
    description:
      "A demonstration of the published report format, produced from an authored review of a fictional storefront. No customer data appears here.",
    issues: ISSUES,
    createdAt: new Date("2026-07-28T00:00:00.000Z"),
    availabilityStatus: "active",
    graceEndsAt: null,
    userId: "sample-report",
    brandName: null,
    brandColor: null,
    brandLogoKey: null,
    brandAssetToken: null,
    whiteLabelEnabled: false,
  } as const;
}
