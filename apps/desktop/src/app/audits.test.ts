import { describe, expect, it } from "vitest";
import { auditPlanProgress } from "./audit-plan";
import { auditStoreKey, createAuditProject, normalizeAuditProject } from "./audits";

describe("audit workspaces", () => {
  it("creates isolated, valid audit identifiers", () => {
    const first = createAuditProject(" Checkout release ");
    const second = createAuditProject("Checkout release");
    expect(first.project).toBe("Checkout release");
    expect(first.id).toMatch(/^aud-[a-z0-9-]{6,36}$/);
    expect(first.id).not.toBe(second.id);
    expect(auditStoreKey(first.id, "findings")).toBe(`findings-${first.id}`);
    expect(auditStoreKey(first.id, "sampleItems")).toBe(`sampleItems-${first.id}`);
  });

  it("rejects unsafe audit identifiers", () => {
    expect(() => auditStoreKey("../workspace", "reports")).toThrow();
  });

  it("normalizes older audits and reports plan readiness", () => {
    const legacy = createAuditProject("Legacy audit");
    const normalized = normalizeAuditProject({
      ...legacy,
      target: "https://example.com",
      goal: undefined,
      sample: undefined,
    } as unknown as typeof legacy);
    expect(normalized.goal).toBe("");
    expect(normalized.methodology).toContain("Manual WCAG review");
    expect(normalized.executiveSummary).toBe("");
    expect(normalized.limitations).toBe("");
    expect(normalized.conclusion).toBe("in-progress");
    expect(normalized.completedAt).toBe("");
    const readiness = auditPlanProgress(normalized);
    expect(readiness.total).toBe(7);
    expect(readiness.missing).toContain("Evaluation goal");
  });
});
