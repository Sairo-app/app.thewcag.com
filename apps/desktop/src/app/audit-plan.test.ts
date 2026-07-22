import { describe, expect, it } from "vitest";
import { auditStartReadiness, auditTestRunComplete } from "./audit-plan";
import { AUDIT_TEST_SCRIPTS, createTestRun } from "./audit-templates";
import { createAuditProject } from "./audits";

describe("audit start readiness", () => {
  function plannedAudit() {
    return {
      ...createAuditProject("Checkout audit"),
      target: "https://example.com/checkout",
      goal: "Evaluate checkout accessibility",
      scope: "Checkout journey",
      sample: "Critical success and error states",
      environment: "Chrome on Windows",
      assistiveTechnology: "NVDA",
      auditor: "Audit team",
    };
  }

  it("blocks inspection until every representative item has an exact location", () => {
    const readiness = auditStartReadiness(
      plannedAudit(),
      [{
        id: "sample-1",
        kind: "flow",
        label: "Checkout journey",
        location: "",
        status: "planned",
        notes: "",
        createdAt: 1,
        modifiedAt: 1,
      }],
      [],
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain("Add exact locations for 1 sample item.");
  });

  it("only completes a guided run when every checked step has an observation", () => {
    const run = createTestRun(AUDIT_TEST_SCRIPTS[0]);
    run.status = "complete";
    run.steps = run.steps.map((step) => ({ ...step, complete: true }));
    expect(auditTestRunComplete(run)).toBe(false);
    run.steps = run.steps.map((step) => ({ ...step, observation: "Verified with keyboard and NVDA." }));
    expect(auditTestRunComplete(run)).toBe(true);
  });
});
