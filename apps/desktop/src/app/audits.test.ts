import { describe, expect, it } from "vitest";
import { auditPlanProgress, auditStartReadiness } from "./audit-plan";
import { BUILT_IN_AUDIT_TEMPLATES, createTestRun, AUDIT_TEST_SCRIPTS } from "./audit-templates";
import { auditStoreKey, createAuditProject, localDateInputValue, normalizeAuditProject } from "./audits";

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

  it("drops malformed locally stored scoper metadata", () => {
    const audit = createAuditProject("Stored audit");
    const normalized = normalizeAuditProject({
      ...audit,
      scopeProfile: {
        version: 1,
        targetType: "web-product",
        featureIds: ["forms", "forms"],
        templateId: "web-product-aa",
        confidence: "high",
        reasons: ["Duplicate feature identifiers are invalid."],
        confirmedAt: Date.now(),
      },
    });
    expect(normalized.scopeProfile).toBeUndefined();
  });

  it("uses the auditor's local calendar date instead of UTC", () => {
    expect(localDateInputValue(new Date(2026, 6, 22, 0, 30))).toBe("2026-07-22");
  });

  it("requires planning rather than completed testing before inspection", () => {
    const template = BUILT_IN_AUDIT_TEMPLATES.find((item) => item.id === "web-product-aa")!;
    const audit = {
      ...createAuditProject("Product audit"),
      target: "https://app.example.com",
      goal: template.goal,
      scope: template.scope,
      sample: template.sample,
      excludedScope: template.excludedScope,
      environment: template.environment,
      assistiveTechnology: template.assistiveTechnology,
      methodology: template.methodology,
      auditor: "Audit team",
    };
    const now = Date.now();
    const sampleItems = template.sampleItems.map((item, index) => ({
      ...item,
      id: `sample-${index}`,
      location: item.location || `https://app.example.com/sample-${index + 1}`,
      status: "planned" as const,
      createdAt: now,
      modifiedAt: now,
    }));
    const testRuns = [createTestRun(AUDIT_TEST_SCRIPTS[0])];
    const readiness = auditStartReadiness(audit, sampleItems, testRuns);
    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(testRuns[0].status).toBe("planned");
    expect(readiness.warnings).toContain(
      "The scope was entered manually and has not been confirmed through the built-in scoper.",
    );
  });

  it("blocks inspection when core context or a representative sample is missing", () => {
    const readiness = auditStartReadiness(createAuditProject(), [], []);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain("Complete target.");
    expect(readiness.blockers).toContain("Add at least one representative sample item.");
  });
});
