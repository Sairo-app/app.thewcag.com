export const AUDIT_BRIEF_KEY = "audit-brief";

export type AuditStandard = "WCAG 2.2 A" | "WCAG 2.2 AA";

export interface AuditBrief {
  project: string;
  target: string;
  scope: string;
  standard: AuditStandard;
  auditor: string;
  startedAt: string;
  updatedAt: number;
}

export function parseAuditBrief(raw: string | null): AuditBrief | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AuditBrief>;
    if (!value.project?.trim()) return null;
    return {
      project: value.project.trim(),
      target: value.target?.trim() ?? "",
      scope: value.scope?.trim() ?? "",
      standard: value.standard === "WCAG 2.2 A" ? "WCAG 2.2 A" : "WCAG 2.2 AA",
      auditor: value.auditor?.trim() ?? "",
      startedAt: value.startedAt ?? new Date().toISOString().slice(0, 10),
      updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function safeAuditFilename(brief: AuditBrief | null, fallback: string): string {
  const source = brief?.project || fallback;
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || fallback;
}

export function auditMetadataLines(brief: AuditBrief | null): string[] {
  if (!brief) return [];
  return [
    `- **Project:** ${brief.project}`,
    brief.target ? `- **Target:** ${brief.target}` : "",
    brief.scope ? `- **Scope:** ${brief.scope}` : "",
    `- **Standard:** ${brief.standard}`,
    brief.auditor ? `- **Evaluator:** ${brief.auditor}` : "",
    `- **Started:** ${brief.startedAt}`,
  ].filter(Boolean);
}
