import { describe, expect, it } from "vitest";
import { createFindingId, isFindingId } from "@accessibility-build/audit-contracts";
import {
  DEFAULT_REPORT_ISSUE_QUERY,
  filterAndSortReportIssues,
  reportImageAlt,
  reportIssueEmptyState,
} from "./report-view";
import { buildSharedReportMetadata, decodePngBase64, sanitizeReportIssues } from "./reports";
import type { ReportIssue } from "./schema";

const reportIssues: ReportIssue[] = [
  { id: createFindingId(), n: 1, sc: "2.4.7", label: "Focus is hidden", severity: "major", note: "Keep focus visible.", status: "retest" },
  { id: createFindingId(), n: 2, sc: "1.4.10", label: "Layout clips", severity: "minor", note: "Allow content to reflow.", status: "fixed" },
  { id: createFindingId(), n: 3, sc: "1.4.3", label: "Text has low contrast", severity: "blocker", note: "Increase contrast.", status: "open" },
  { id: createFindingId(), n: 4, label: "Unmapped keyboard issue", severity: "major", note: "", status: "accepted" },
];

describe("sanitizeReportIssues", () => {
  it("normalizes untrusted issue fields and assigns stable sequential numbers", () => {
    const id = createFindingId(1_800_000_000_000, new Uint8Array(26));
    const issues = sanitizeReportIssues([
      { id, n: 99, sc: " 1.4.3 ", label: "  Contrast\u0000 issue  ", severity: "BLOCKER", note: " Fix it ", status: "RETEST" },
      { n: -2, sc: "javascript:alert(1)", label: "", severity: "unknown", note: 4 },
      null,
    ]);

    expect(issues).toEqual([
      { id, n: 1, sc: "1.4.3", label: "Contrast  issue", severity: "blocker", note: "Fix it", status: "retest" },
      { id: expect.any(String), n: 2, sc: undefined, label: "Accessibility issue", severity: "major", note: "", status: "open" },
    ]);
    expect(isFindingId(issues[1].id)).toBe(true);
    expect(issues[1].id).not.toBe(id);
  });

  it("repairs duplicate IDs at the publishing boundary", () => {
    const id = createFindingId();
    const issues = sanitizeReportIssues([
      { id, label: "First" },
      { id, label: "Second" },
    ]);
    expect(issues[0].id).toBe(id);
    expect(issues[1].id).not.toBe(id);
    expect(isFindingId(issues[1].id)).toBe(true);
  });

  it("caps issue count and text lengths", () => {
    const issues = sanitizeReportIssues(
      Array.from({ length: 5 }, () => ({ label: "x".repeat(200), note: "y".repeat(1200) })),
      2,
    );
    expect(issues).toHaveLength(2);
    expect(issues[0].label).toHaveLength(120);
    expect(issues[0].note).toHaveLength(1000);
  });
});

describe("public report finding explorer", () => {
  it("filters by severity, WCAG criterion, and remediation status together", () => {
    expect(
      filterAndSortReportIssues(reportIssues, {
        severity: "blocker",
        criterion: "1.4.3",
        status: "open",
        sort: "number",
      }).map((issue) => issue.n),
    ).toEqual([3]);

    expect(
      filterAndSortReportIssues(reportIssues, {
        ...DEFAULT_REPORT_ISSUE_QUERY,
        criterion: "unmapped",
      }).map((issue) => issue.n),
    ).toEqual([4]);
  });

  it("sorts severity by remediation priority and WCAG criteria numerically without mutating input", () => {
    const original = reportIssues.map((issue) => issue.n);
    expect(
      filterAndSortReportIssues(reportIssues, { ...DEFAULT_REPORT_ISSUE_QUERY, sort: "severity" }).map(
        (issue) => issue.n,
      ),
    ).toEqual([3, 1, 4, 2]);
    expect(
      filterAndSortReportIssues(reportIssues, { ...DEFAULT_REPORT_ISSUE_QUERY, sort: "criterion" }).map(
        (issue) => issue.n,
      ),
    ).toEqual([3, 2, 1, 4]);
    expect(reportIssues.map((issue) => issue.n)).toEqual(original);
  });

  it("sorts remediation status with unresolved findings first", () => {
    expect(
      filterAndSortReportIssues(reportIssues, { ...DEFAULT_REPORT_ISSUE_QUERY, sort: "status" }).map(
        (issue) => issue.n,
      ),
    ).toEqual([3, 1, 2, 4]);
  });

  it("distinguishes an empty report from a filter with no matches", () => {
    expect(reportIssueEmptyState(0, 0)).toBe("no-findings");
    expect(reportIssueEmptyState(4, 0)).toBe("no-matches");
    expect(reportIssueEmptyState(4, 1)).toBeNull();
  });

  it("gives the annotated image full finding text instead of a generic alt", () => {
    const alt = reportImageAlt("Checkout", reportIssues.slice(0, 1));
    expect(alt).toContain("Finding 1, major, WCAG 2.4.7, Focus is hidden: Keep focus visible.");
  });
});

describe("shared report metadata guardrails", () => {
  it("keeps reports unlisted and emits matching Open Graph and Twitter previews", () => {
    const metadata = buildSharedReportMetadata({
      slug: "public-report",
      title: "Checkout accessibility review",
      description: "Four published findings.",
      issueCount: 4,
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.openGraph).toMatchObject({
      title: "Checkout accessibility review",
      description: "Four published findings.",
      type: "article",
      images: [{ url: expect.stringMatching(/\/api\/s\/public-report\/image$/), width: 1400 }],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [expect.stringMatching(/\/api\/s\/public-report\/image$/)],
    });
  });
});

describe("decodePngBase64", () => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type: string, data = Buffer.alloc(0)) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([signature, chunk("IHDR", header), chunk("IEND")]);

  it("accepts a structurally complete PNG within the size limit", () => {
    expect(decodePngBase64(png.toString("base64"))).toEqual({ ok: true, buffer: png });
  });

  it("rejects non-PNG, truncated, and oversized payloads", () => {
    expect(decodePngBase64(Buffer.from("not png").toString("base64"))).toEqual({ ok: false, error: "not a PNG image" });
    expect(decodePngBase64(signature.toString("base64"))).toEqual({ ok: false, error: "not a PNG image" });
    expect(decodePngBase64(png.toString("base64"), png.length - 1)).toEqual({
      ok: false,
      error: "image too large",
    });
  });
});
