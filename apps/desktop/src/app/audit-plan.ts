import type {
  AuditProject,
  AuditSampleItem,
  AuditTestRun,
} from "../shared/desktop";

export const AUDIT_PLAN_FIELDS = [
  { key: "target", label: "Target" },
  { key: "goal", label: "Evaluation goal" },
  { key: "scope", label: "Included scope" },
  { key: "sample", label: "Sampling rationale" },
  { key: "environment", label: "Test environment" },
  { key: "assistiveTechnology", label: "Assistive technology" },
  { key: "auditor", label: "Auditor" },
] as const satisfies ReadonlyArray<{
  key: keyof AuditProject;
  label: string;
}>;

export function auditPlanProgress(audit: AuditProject): {
  complete: number;
  total: number;
  percent: number;
  missing: string[];
} {
  const missing = AUDIT_PLAN_FIELDS.filter(({ key }) => {
    const value = audit[key];
    return typeof value !== "string" || !value.trim();
  }).map(({ label }) => label);
  const total = AUDIT_PLAN_FIELDS.length;
  const complete = total - missing.length;
  return {
    complete,
    total,
    percent: Math.round((complete / total) * 100),
    missing,
  };
}

export interface AuditStartReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  definedSampleItems: number;
  sampleDefinitionPercent: number;
}

export function auditStartReadiness(
  audit: AuditProject,
  sampleItems: AuditSampleItem[],
  testRuns: AuditTestRun[],
): AuditStartReadiness {
  const plan = auditPlanProgress(audit);
  const blockers = plan.missing.map((field) => `Complete ${field.toLowerCase()}.`);
  if (!sampleItems.length) blockers.push("Add at least one representative sample item.");
  if (sampleItems.some((item) => !item.label.trim())) {
    blockers.push("Name every representative sample item.");
  }

  const missingLocations = sampleItems.filter((item) => !item.location.trim()).length;
  if (missingLocations) {
    blockers.push(`Add exact locations for ${missingLocations} sample ${missingLocations === 1 ? "item" : "items"}.`);
  }
  const warnings: string[] = [];
  if (!testRuns.length) {
    warnings.push("No guided test runs are planned; confirm the WCAG checklist alone is sufficient.");
  }
  if (!audit.scopeProfile) {
    warnings.push("The scope was entered manually and has not been confirmed through the built-in scoper.");
  }
  if (!audit.excludedScope.trim()) {
    warnings.push("Record exclusions or state that there are no known exclusions.");
  }

  const definedSampleItems = sampleItems.filter(
    (item) => item.label.trim() && item.location.trim(),
  ).length;
  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    definedSampleItems,
    sampleDefinitionPercent: sampleItems.length
      ? Math.round((definedSampleItems / sampleItems.length) * 100)
      : 0,
  };
}

export function auditTestRunComplete(run: AuditTestRun): boolean {
  return (
    run.status === "complete" &&
    run.steps.length > 0 &&
    run.steps.every((step) => step.complete && Boolean(step.observation.trim()))
  );
}
