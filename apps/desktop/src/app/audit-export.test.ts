import { describe, expect, it } from "vitest";
import type { AuditProject, Finding } from "../shared/desktop";
import { buildAuditHtml, buildAuditMarkdown } from "./audit-export";
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
});
