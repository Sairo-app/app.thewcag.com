import { describe, expect, it } from "vitest";
import type { AuditSampleItem, AuditTestRun, CaptureEntry, Finding } from "../shared/desktop";
import { buildAuditCoverage, findNextAuditSession } from "./audit-coverage";

function sample(id: string, status: AuditSampleItem["status"] = "planned"): AuditSampleItem {
  return {
    id,
    kind: "flow",
    label: id,
    location: `/${id}`,
    status,
    notes: "",
    createdAt: 1,
    modifiedAt: 1,
  };
}

function run(id: string, status: AuditTestRun["status"] = "planned", sampleItemId?: string): AuditTestRun {
  const complete = status === "complete";
  return {
    id,
    scriptId: "forms",
    sampleItemId,
    title: id,
    category: "forms",
    status,
    steps: [{
      id: "step-1",
      label: "Test errors",
      complete,
      observation: complete ? "Verified with keyboard and screen reader." : "",
    }],
    notes: "",
    createdAt: 1,
    modifiedAt: 1,
  };
}

describe("audit coverage", () => {
  it("connects a sample to runs, evidence, findings, and checklist decisions", () => {
    const finding: Finding = {
      key: "finding-1",
      sampleItemId: "checkout",
      testRunId: "run-1",
      title: "Error is not announced",
      wcag: "3.3.1",
      severity: "major",
      status: "open",
      note: "",
      evidenceCaptureIds: ["cap-1"],
      captureId: "cap-1",
      createdAt: 1,
    };
    const capture = {
      id: "cap-1",
      auditId: "aud-a1234567",
      sampleItemId: "checkout",
      testRunId: "run-1",
      title: "Checkout error",
      createdAt: 1,
      modifiedAt: 1,
      issues: 0,
      width: 1,
      height: 1,
      assetUrl: "capture://raw",
      thumbnailUrl: null,
    } satisfies CaptureEntry;
    const coverage = buildAuditCoverage({
      sampleItems: [sample("checkout", "complete")],
      testRuns: [run("run-1", "complete", "checkout")],
      captures: [capture],
      findings: [finding],
      checklist: { "3.3.1": { result: "fail", note: "", findingKey: "finding-1" } },
    });

    expect(coverage.rows[0]).toMatchObject({ state: "complete" });
    expect(coverage.rows[0].criteria).toEqual(["3.3.1"]);
    expect(coverage.rows[0].captures).toHaveLength(1);
    expect(coverage.rows[0].findings).toHaveLength(1);
    expect(coverage.rows[0].findingsWithEvidence).toBe(1);
    expect(coverage.rows[0].findingsWithoutEvidence).toBe(0);
    expect(coverage.complete).toBe(1);
  });

  it("does not treat a sample-scoped capture as finding evidence until it is linked", () => {
    const capture = {
      id: "orphan-cap",
      sampleItemId: "checkout",
      title: "Legacy evidence-stage capture",
      createdAt: 1,
      modifiedAt: 1,
      issues: 0,
      width: 1,
      height: 1,
      assetUrl: "capture://raw",
      thumbnailUrl: null,
    } satisfies CaptureEntry;
    const finding: Finding = {
      key: "finding-without-evidence",
      sampleItemId: "checkout",
      title: "Error is not announced",
      wcag: "3.3.1",
      severity: "major",
      status: "open",
      note: "",
      createdAt: 1,
    };
    const coverage = buildAuditCoverage({
      sampleItems: [sample("checkout", "complete")],
      testRuns: [run("run-1", "complete", "checkout")],
      captures: [capture],
      findings: [finding],
      checklist: {},
    });
    expect(coverage.rows[0]).toMatchObject({
      state: "gap",
      findingsWithEvidence: 0,
      findingsWithoutEvidence: 1,
    });
    expect(coverage.rows[0].gap).toContain("finding needs linked evidence");
    expect(coverage.rows[0].captures).toEqual([]);
    expect(coverage.unassigned.captures).toEqual([capture]);
  });

  it("highlights completed samples without a trace and keeps unassigned work visible", () => {
    const coverage = buildAuditCoverage({
      sampleItems: [sample("checkout", "complete")],
      testRuns: [run("run-1")],
      captures: [],
      findings: [],
      checklist: {},
    });
    expect(coverage.rows[0].state).toBe("gap");
    expect(coverage.gaps).toBe(1);
    expect(coverage.unassigned.testRuns).toHaveLength(1);
  });
});

describe("next guided audit session", () => {
  it("resumes an assigned in-progress run before planned work", () => {
    expect(findNextAuditSession(
      [sample("home"), sample("checkout", "in-progress")],
      [run("planned"), run("active", "in-progress", "checkout")],
    )).toEqual({ sampleItemId: "checkout", testRunId: "active" });
  });

  it("allows sample-only testing when no guided run is planned", () => {
    expect(findNextAuditSession([sample("home")], [])).toEqual({ sampleItemId: "home", testRunId: undefined });
  });

  it("stops when every sample and run is complete", () => {
    expect(findNextAuditSession([sample("home", "complete")], [run("forms", "complete", "home")])).toBeNull();
  });
});
