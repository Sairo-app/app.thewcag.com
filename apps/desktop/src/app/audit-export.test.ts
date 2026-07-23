import { describe, expect, it } from "vitest";
import axe from "axe-core";
import { JSDOM } from "jsdom";
import { createFindingId } from "@accessibility-build/audit-contracts";
import type { AuditProject, CaptureEntry, Finding } from "../shared/desktop";
import {
  REPORT_CONTRAST_RATIOS,
  buildAuditHtml,
  buildAuditMarkdown,
} from "./audit-export";
import { createAuditProject } from "./audits";
import { WCAG_CRITERIA } from "./data/wcag";

describe("complete audit export", () => {
  it("includes plan, findings, retest state, and checklist coverage", () => {
    const audit: AuditProject = {
      ...createAuditProject("Checkout audit"),
      target: "https://example.com/checkout",
      goal: "Release decision",
      scope: "Checkout flow",
      sample: "Cart and payment errors",
      environment: "Chrome and Windows",
      assistiveTechnology: "NVDA",
      auditor: "Audit team",
    };
    const finding: Finding = {
      id: "WCG-F-20260722-00000-00000-00000-00000-000006",
      key: "finding-1",
      reference: "F-014",
      title: "Button has no accessible name",
      wcag: "4.1.2",
      severity: "major",
      status: "retest",
      note: "Ticket A-12",
      location: "Payment dialog",
      actualResult: "The control is announced only as button.",
      expectedResult: "The control exposes its purpose.",
      retestNote: "Fix is ready in the release candidate.",
      duplicateOf: "F-003",
      comparisonNote: "The release candidate exposes the control name in NVDA.",
      occurrences: [
        {
          id: "occurrence-1",
          location: "Saved payment dialog",
          note: "Same shared icon button",
          createdAt: 1,
        },
      ],
      createdAt: 1,
    };
    const output = buildAuditMarkdown({
      audit,
      findings: [finding],
      captures: [],
      sampleItems: [],
      testRuns: [],
      checklist: {
        "4.1.2": { result: "fail", note: "Screen reader test", findingKey: finding.key },
      },
      generatedAt: new Date("2026-07-21T00:00:00.000Z"),
    });
    expect(output).toContain("## Evaluation plan");
    expect(output).toContain("ready for retest");
    expect(output).toContain("Payment dialog");
    expect(output).toContain("F-014");
    expect(output).toContain(finding.id);
    expect(output).toContain(`F-014 · ${finding.id}`);
    expect(output).toContain("Duplicated from: F-003");
    expect(output).toContain("Saved payment dialog");
    expect(output).toContain("release candidate exposes the control name");
    expect(output).toContain("| 4.1.2 | A | Name, Role, Value | fail | Yes |");
    expect(output).toContain("do not establish WCAG conformance");
  });

  it("only counts and exports criteria applicable to a Level A target", () => {
    const audit = {
      ...createAuditProject("Level A audit"),
      standard: "WCAG 2.2 A" as const,
    };
    const levelACount = WCAG_CRITERIA.filter(
      (criterion) => criterion.level === "A",
    ).length;
    const firstLevelAA = WCAG_CRITERIA.find(
      (criterion) => criterion.level === "AA",
    );
    const output = buildAuditMarkdown({
      audit,
      findings: [],
      captures: [],
      sampleItems: [],
      testRuns: [],
      checklist: {},
      generatedAt: new Date("2026-07-21T00:00:00.000Z"),
    });
    expect(output).toContain(`0 of ${levelACount} applicable criteria recorded`);
    expect(output).not.toContain(`| ${firstLevelAA?.sc} | AA |`);
  });

  it("exports every finding-owned capture and labels orphaned captures as unassigned", () => {
    const captures: CaptureEntry[] = [
      { id: "cap-a", title: "Keyboard focus before", createdAt: 1, modifiedAt: 1, issues: 1, width: 800, height: 500, assetUrl: "capture://a", thumbnailUrl: null },
      { id: "cap-b", title: "Keyboard focus after", createdAt: 2, modifiedAt: 2, issues: 0, width: 800, height: 500, assetUrl: "capture://b", thumbnailUrl: null },
      { id: "cap-orphan", title: "Legacy unassigned image", createdAt: 3, modifiedAt: 3, issues: 0, width: 640, height: 400, assetUrl: "capture://orphan", thumbnailUrl: null },
    ];
    const finding: Finding = {
      id: createFindingId(),
      key: "finding-evidence",
      reference: "F-021",
      title: "Focus indicator is not visible",
      wcag: "2.4.7",
      severity: "major",
      status: "open",
      note: "",
      evidenceCaptureIds: ["cap-a", "cap-b"],
      captureId: "cap-a",
      createdAt: 1,
    };
    const input = {
      audit: createAuditProject("Evidence traceability"),
      findings: [finding],
      captures,
      checklist: {},
      sampleItems: [],
      testRuns: [],
      generatedAt: new Date("2026-07-21T00:00:00.000Z"),
    };
    const markdown = buildAuditMarkdown(input);
    expect(markdown).toContain("Evidence captures: Keyboard focus before, Keyboard focus after");
    expect(markdown).toContain("| Legacy unassigned image | Unassigned capture |");
    expect(markdown).toContain("Finding evidence: 1 of 1 findings linked");

    const document = new JSDOM(buildAuditHtml(input)).window.document;
    const evidenceInventory = [...document.querySelectorAll("h2")]
      .find((heading) => heading.textContent === "Evidence inventory")
      ?.nextElementSibling;
    expect(evidenceInventory?.textContent).toContain("F-021");
    expect(evidenceInventory?.textContent).toContain(finding.id);
    expect(evidenceInventory?.textContent).toContain("Unassigned capture");
    expect(document.querySelector(".finding")?.textContent).toContain("Keyboard focus before, Keyboard focus after");
    expect(document.querySelector(".finding-number")?.textContent).toContain(
      `F-021 · ${finding.id}`,
    );
  });

  it("creates an escaped, printable HTML report with sample and conclusion", () => {
    const audit = {
      ...createAuditProject("Client <script>alert(1)</script>"),
      executiveSummary: "Critical purchase paths were evaluated.",
      limitations: "No known limitations.",
      conclusion: "does-not-meet-target" as const,
      completedAt: "2026-07-21",
    };
    const output = buildAuditHtml({
      audit,
      findings: [],
      captures: [],
      checklist: {},
      sampleItems: [
        {
          id: "sample-1",
          kind: "flow",
          label: "Checkout",
          location: "/checkout",
          status: "complete",
          notes: "Keyboard and screen reader",
          createdAt: 1,
          modifiedAt: 1,
        },
      ],
      testRuns: [],
      generatedAt: new Date("2026-07-21T00:00:00.000Z"),
    });
    expect(output).toContain("<!doctype html>");
    expect(output).toContain("Does not meet WCAG 2.2 AA");
    expect(output).toContain("Checkout");
    expect(output).toContain("Client &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(output).not.toContain("<script>alert(1)</script>");
    expect(output).toContain("@media print");
  });

  it("marks a meets-target conclusion as contradictory when required audit context is missing", () => {
    const audit = {
      ...createAuditProject("Incomplete audit"),
      conclusion: "meets-target" as const,
    };
    const input = {
      audit,
      findings: [],
      captures: [],
      checklist: {},
      sampleItems: [],
      testRuns: [],
      generatedAt: new Date("2026-07-21T00:00:00.000Z"),
    };
    expect(buildAuditMarkdown(input)).toContain(
      "readiness requirements are not currently satisfied",
    );
    expect(buildAuditHtml(input)).toContain(
      "readiness requirements are not currently satisfied",
    );
  });

  it("labels an unreviewed browser intake instead of presenting it as an auditor decision", () => {
    const finding: Finding = {
      id: createFindingId(),
      key: "browser-intake",
      reference: "F-001",
      title: "Checkout button needs review",
      wcag: "4.1.2",
      severity: "major",
      status: "open",
      reviewState: "pending",
      note: "Captured in the browser extension.",
      createdAt: 1,
    };
    const input = {
      audit: createAuditProject("Browser intake review"),
      findings: [finding],
      captures: [],
      checklist: {},
      sampleItems: [],
      testRuns: [],
      generatedAt: new Date("2026-07-21T00:00:00.000Z"),
    };

    expect(buildAuditMarkdown(input)).toContain("Auditor review: Required");
    expect(buildAuditHtml(input)).toContain("Needs auditor review");
  });

  it("uses sequential headings and scoped table headers in the accessible report", () => {
    const audit = createAuditProject("Accessible report structure");
    const output = buildAuditHtml({
      audit,
      findings: [],
      captures: [],
      checklist: {},
      sampleItems: [],
      testRuns: [],
      generatedAt: new Date("2026-07-21T00:00:00.000Z"),
    });
    const document = new JSDOM(output).window.document;
    const headingLevels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .map((item) => Number(item.tagName.slice(1)));
    expect(headingLevels[0]).toBe(1);
    headingLevels.slice(1).forEach((level, index) => {
      expect(level).toBeLessThanOrEqual(headingLevels[index] + 1);
    });
    const tables = [...document.querySelectorAll("table")];
    expect(tables.length).toBeGreaterThanOrEqual(3);
    tables.forEach((table) => {
      const columnHeaders = [...table.querySelectorAll("thead th")];
      expect(columnHeaders.length).toBeGreaterThan(0);
      columnHeaders.forEach((header) => expect(header.getAttribute("scope")).toBe("col"));
      table.querySelectorAll("tbody tr").forEach((row) => {
        const isEmptyState = Boolean(row.querySelector("td[colspan]"));
        expect(isEmptyState || Boolean(row.querySelector('th[scope="row"]'))).toBe(true);
      });
    });
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("Accessibility audit report - Accessible report structure");
    expect(document.querySelector('meta[name="author"]')).not.toBeNull();
  });

  it("never generates an ACR conformance verdict from checklist or automated results", () => {
    const audit = createAuditProject("Human-authored ACR");
    const output = buildAuditHtml({
      audit,
      findings: [],
      captures: [],
      checklist: {
        "1.1.1": { result: "pass", note: "Automated image rule returned no failures." },
        "1.4.3": { result: "fail", note: "Contrast measurement was below the threshold." },
      },
      sampleItems: [],
      testRuns: [],
      generatedAt: new Date("2026-07-21T00:00:00.000Z"),
    });
    const document = new JSDOM(output).window.document;
    const acr = document.querySelector("#acr-title")?.closest("section");
    expect(acr?.textContent).toContain("Auditor response required");
    expect(acr?.textContent).not.toMatch(/\bSupports\b|Partially supports|Does not support/);
    expect(acr?.textContent).toContain("0 of");
  });

  it("passes an automated axe check with zero violations", async () => {
    const output = buildAuditHtml({
      audit: createAuditProject("Axe-checked audit report"),
      findings: [],
      captures: [],
      checklist: {},
      sampleItems: [],
      testRuns: [],
      generatedAt: new Date("2026-07-21T00:00:00.000Z"),
    });
    const dom = new JSDOM(output, {
      runScripts: "outside-only",
      url: "https://report.thewcag.test/",
    });
    dom.window.eval(axe.source);
    const results = await (dom.window as typeof dom.window & {
      axe: typeof axe;
    }).axe.run(dom.window.document);
    expect(results.violations).toEqual([]);
    Object.values(REPORT_CONTRAST_RATIOS).forEach((ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
