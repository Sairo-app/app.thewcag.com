import type { AuditProject } from "../shared/desktop";

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
