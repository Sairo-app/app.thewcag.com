import { describe, expect, it } from "vitest";
import type {
  AuditProject,
  AuditSampleItem,
  Finding,
} from "../shared/desktop";
import {
  calculateProgramMetrics,
  type ProgramAuditInput,
} from "./program-metrics";

const DAY = 24 * 60 * 60 * 1_000;

function audit(id: string, createdAt: number, standard: AuditProject["standard"] = "WCAG 2.2 AA"): AuditProject {
  return {
    id,
    project: id,
    target: "Local owned target",
    goal: "Track remediation quality",
    scope: "Owned component library",
    sample: "Representative components",
    excludedScope: "",
    environment: "Local test environment",
    assistiveTechnology: "Keyboard and screen reader",
    methodology: "Manual testing",
    executiveSummary: "",
    limitations: "",
    conclusion: "in-progress",
    completedAt: "",
    standard,
    auditor: "Auditor",
    startedAt: "2026-01-01",
    updatedAt: createdAt,
    createdAt,
  };
}

function component(id: string, label: string): AuditSampleItem {
  return {
    id,
    kind: "component",
    label,
    location: `Component library / ${label}`,
    status: "complete",
    notes: "Manually tested",
    createdAt: 0,
    modifiedAt: 0,
  };
}

function finding(
  key: string,
  patch: Partial<Finding> = {},
): Finding {
  return {
    key,
    title: key,
    wcag: "1.4.3",
    severity: "major",
    status: "open",
    note: "Confirmed manually",
    createdAt: 0,
    ...patch,
  };
}

function input(
  project: AuditProject,
  sampleItems: AuditSampleItem[] = [],
  findings: Finding[] = [],
  checklist: ProgramAuditInput["checklist"] = {},
): ProgramAuditInput {
  return {
    audit: project,
    sampleItems,
    findings,
    checklist,
    testRuns: [],
    captures: [],
  };
}

describe("program-level audit metrics", () => {
  it("calculates recurrence from component–criterion failures created after verified fixes", () => {
    const original = input(
      audit("aud-original1", 0),
      [component("button", "Primary button"), component("field", "Text field")],
      [
        finding("button-fixed", {
          sampleItemId: "button",
          status: "fixed",
          createdAt: 0,
          statusHistory: [
            { status: "retest", changedAt: DAY },
            { status: "fixed", changedAt: 2 * DAY },
          ],
        }),
        finding("field-fixed", {
          sampleItemId: "field",
          wcag: "3.3.2",
          status: "fixed",
          createdAt: 0,
          statusHistory: [
            { status: "retest", changedAt: DAY },
            { status: "fixed", changedAt: 3 * DAY },
          ],
        }),
      ],
    );
    const reassessment = input(
      audit("aud-release22", 10 * DAY),
      [component("button-v2", "  PRIMARY   BUTTON ")],
      [finding("button-returned", { sampleItemId: "button-v2", createdAt: 11 * DAY })],
    );

    const metrics = calculateProgramMetrics([original, reassessment]);

    expect(metrics.recurrence).toMatchObject({
      numerator: 1,
      denominator: 2,
      percent: 50,
      notObservedAgain: 1,
    });
    expect(metrics.recurrence.byComponent[0]).toMatchObject({
      component: "Primary button",
      numerator: 1,
      denominator: 1,
    });
  });

  it("uses the hand-computed median of explicit ready-for-retest to verified transitions", () => {
    const metrics = calculateProgramMetrics([
      input(audit("aud-timing12", 0), [], [
        finding("two-days", {
          status: "fixed",
          statusHistory: [
            { status: "retest", changedAt: DAY },
            { status: "fixed", changedAt: 3 * DAY },
          ],
        }),
        finding("four-days", {
          status: "fixed",
          statusHistory: [
            { status: "retest", changedAt: 2 * DAY },
            { status: "fixed", changedAt: 6 * DAY },
          ],
        }),
        finding("legacy-without-ready", {
          status: "fixed",
          retestedAt: 7 * DAY,
        }),
      ]),
    ]);

    expect(metrics.retestTime.medianMilliseconds).toBe(3 * DAY);
    expect(metrics.retestTime.verifiedTransitions).toBe(2);
    expect(metrics.retestTime.fixedEventsMissingReadyTimestamp).toBe(1);
  });

  it("counts a regression only when a verified finding is explicitly reopened", () => {
    const metrics = calculateProgramMetrics([
      input(audit("aud-regress12", 0), [], [
        finding("reopened", {
          status: "open",
          statusHistory: [
            { status: "retest", changedAt: DAY },
            { status: "fixed", changedAt: 2 * DAY },
            { status: "open", changedAt: 4 * DAY },
          ],
        }),
        finding("stayed-fixed", {
          status: "fixed",
          statusHistory: [
            { status: "retest", changedAt: DAY },
            { status: "fixed", changedAt: 3 * DAY },
          ],
        }),
        finding("never-fixed"),
      ]),
    ]);

    expect(metrics.regression).toEqual({
      numerator: 1,
      denominator: 2,
      percent: 50,
      noPostVerificationUpdate: 1,
    });
  });

  it("ranks component hotspots from confirmed finding records across audits", () => {
    const first = input(
      audit("aud-hotspot11", 0),
      [component("button", "Button"), component("modal", "Modal")],
      [
        finding("button-open", { sampleItemId: "button" }),
        finding("button-fixed", { sampleItemId: "button", severity: "minor", status: "fixed" }),
        finding("modal-accepted", { sampleItemId: "modal", severity: "blocker", status: "accepted", wcag: "2.1.2" }),
      ],
    );
    const second = input(
      audit("aud-hotspot22", 10 * DAY),
      [component("button-2", "Button")],
      [finding("button-retest", { sampleItemId: "button-2", status: "retest", wcag: "4.1.2" })],
    );

    const metrics = calculateProgramMetrics([first, second]);

    expect(metrics.hotspots[0]).toEqual({
      component: "Button",
      findingRecords: 3,
      activeFindings: 2,
      blockerOrMajor: 2,
      auditCount: 2,
      criteria: ["1.4.3", "4.1.2"],
    });
    expect(metrics.hotspots[1]).toMatchObject({ component: "Modal", findingRecords: 1 });
  });

  it("exposes untested criteria as raw counts and has no conformance-style metric key", () => {
    const owned = input(
      audit("aud-guardrail", 0, "WCAG 2.2 A"),
      [component("button", "Button")],
      [finding("button", { sampleItemId: "button" })],
      { "1.1.1": { result: "pass", note: "Manual decision" } },
    );
    const demo = input({ ...audit("aud-demo0001", 0), demo: true });
    const metrics = calculateProgramMetrics([owned, demo]);
    const metricKeys: string[] = [];
    const collectKeys = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      Object.entries(value).forEach(([key, child]) => {
        metricKeys.push(key);
        collectKeys(child);
      });
    };
    collectKeys(metrics);

    expect(metrics.auditCount).toBe(1);
    expect(metrics.excludedDemoAudits).toBe(1);
    expect(metrics.coverageContext.criterionDecisions).toBe(1);
    expect(metrics.coverageContext.untestedCriteria).toBeGreaterThan(0);
    expect(Object.keys(metrics.coverageContext)).not.toContain("percent");
    expect(metricKeys.join(" ")).not.toMatch(/score|passRate|conformance/i);
  });
});
