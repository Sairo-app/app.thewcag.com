import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import type { ProgramMetrics } from "../program-metrics";
import { ProgramDashboardView } from "./ProgramDashboard";

const METRICS: ProgramMetrics = {
  auditCount: 3,
  archivedAuditCount: 1,
  excludedDemoAudits: 1,
  recurrence: {
    numerator: 1,
    denominator: 2,
    percent: 50,
    notObservedAgain: 1,
    fixedWithoutTimestamp: 0,
    byComponent: [{
      component: "Button",
      numerator: 1,
      denominator: 2,
      percent: 50,
      notObservedAgain: 1,
    }],
  },
  retestTime: {
    medianMilliseconds: 2 * 24 * 60 * 60 * 1_000,
    verifiedTransitions: 2,
    fixedEventsMissingReadyTimestamp: 1,
  },
  regression: {
    numerator: 1,
    denominator: 4,
    percent: 25,
    noPostVerificationUpdate: 3,
  },
  hotspots: [{
    component: "Button",
    findingRecords: 4,
    activeFindings: 2,
    blockerOrMajor: 3,
    auditCount: 2,
    criteria: ["1.4.3", "4.1.2"],
  }],
  coverageContext: {
    componentSamples: 6,
    componentSampleStates: {
      complete: 3,
      "in-progress": 1,
      blocked: 1,
      gap: 1,
      "not-started": 0,
    },
    criterionDecisions: 18,
    untestedCriteria: 24,
    unassignedFindings: 0,
  },
};

describe("program dashboard accessibility guardrails", () => {
  it("pairs every chart with a captioned semantic data table", () => {
    const document = new JSDOM(
      renderToStaticMarkup(ProgramDashboardView({ metrics: METRICS })),
    ).window.document;
    const charts = [...document.querySelectorAll<HTMLElement>("[data-table-equivalent]")];

    expect(charts).toHaveLength(2);
    charts.forEach((chart) => {
      const tableId = chart.dataset.tableEquivalent;
      const table = tableId ? document.getElementById(tableId) : null;
      expect(table?.tagName).toBe("TABLE");
      expect(table?.querySelector("caption")?.textContent).toContain("Table equivalent");
      expect(table?.querySelectorAll('th[scope="col"]').length).toBeGreaterThan(0);
      expect(table?.querySelectorAll('th[scope="row"]').length).toBeGreaterThan(0);
      expect(chart.textContent).toMatch(/\d/);
    });
  });

  it("labels operational boundaries and never renders a score or progress gauge", () => {
    const document = new JSDOM(
      renderToStaticMarkup(ProgramDashboardView({ metrics: METRICS })),
    ).window.document;
    const text = document.body.textContent ?? "";

    expect(text).toContain("Operational trends, not conformance");
    expect(text).toContain("Untested criteria");
    expect(text).toContain("absence is not a pass");
    expect(text).not.toMatch(/\bscore\b/i);
    expect(document.querySelector("progress")).toBeNull();
  });
});
