import type {
  ReportIssue,
  ReportIssueSeverity,
  ReportRemediationStatus,
} from "./schema";

export const REPORT_SEVERITIES: readonly ReportIssueSeverity[] = ["blocker", "major", "minor"];
export const REPORT_STATUSES: readonly ReportRemediationStatus[] = ["open", "retest", "fixed", "accepted"];

export type ReportCriterionFilter = "all" | "unmapped" | string;
export type ReportIssueSort = "number" | "severity" | "criterion" | "status";

export interface ReportIssueQuery {
  severity: "all" | ReportIssueSeverity;
  criterion: ReportCriterionFilter;
  status: "all" | ReportRemediationStatus;
  sort: ReportIssueSort;
}

export const DEFAULT_REPORT_ISSUE_QUERY: ReportIssueQuery = {
  severity: "all",
  criterion: "all",
  status: "all",
  sort: "number",
};

const severityRank = new Map(REPORT_SEVERITIES.map((severity, index) => [severity, index]));
const statusRank = new Map(REPORT_STATUSES.map((status, index) => [status, index]));

export function reportIssueStatus(issue: ReportIssue): ReportRemediationStatus {
  return issue.status && REPORT_STATUSES.includes(issue.status) ? issue.status : "open";
}

function compareCriterion(a: ReportIssue, b: ReportIssue): number {
  const aCriterion = a.sc?.[0];
  const bCriterion = b.sc?.[0];
  if (!aCriterion && !bCriterion) return a.n - b.n;
  if (!aCriterion) return 1;
  if (!bCriterion) return -1;
  const left = aCriterion.split(".").map(Number);
  const right = bCriterion.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.n - b.n;
}

function compareIssues(a: ReportIssue, b: ReportIssue, sort: ReportIssueSort): number {
  if (sort === "severity") {
    return (severityRank.get(a.severity) ?? 1) - (severityRank.get(b.severity) ?? 1) || a.n - b.n;
  }
  if (sort === "criterion") return compareCriterion(a, b);
  if (sort === "status") {
    return (statusRank.get(reportIssueStatus(a)) ?? 0) - (statusRank.get(reportIssueStatus(b)) ?? 0) || a.n - b.n;
  }
  return a.n - b.n;
}

/** Pure, stable filtering and sorting shared by the report UI and tests. */
export function filterAndSortReportIssues(issues: readonly ReportIssue[], query: ReportIssueQuery): ReportIssue[] {
  return issues
    .filter((issue) => query.severity === "all" || issue.severity === query.severity)
    .filter((issue) => {
      if (query.criterion === "all") return true;
      if (query.criterion === "unmapped") return !issue.sc?.length;
      return issue.sc?.includes(query.criterion) ?? false;
    })
    .filter((issue) => query.status === "all" || reportIssueStatus(issue) === query.status)
    .slice()
    .sort((a, b) => compareIssues(a, b, query.sort));
}

export function reportIssueEmptyState(
  totalIssueCount: number,
  visibleIssueCount: number,
): "no-findings" | "no-matches" | null {
  if (totalIssueCount === 0) return "no-findings";
  if (visibleIssueCount === 0) return "no-matches";
  return null;
}

export function reportImageAlt(title: string, issues: readonly ReportIssue[]): string {
  if (issues.length === 0) return `Annotated screenshot for ${title}. No findings are marked on the image.`;
  const findings = issues.map((issue) => {
    const criterion = issue.sc?.length ? `, WCAG ${issue.sc.join(", ")}` : "";
    const note = issue.note ? `: ${issue.note}` : "";
    return `Finding ${issue.n}, ${issue.severity}${criterion}, ${issue.label}${note}`;
  });
  return `Annotated screenshot for ${title}. ${issues.length} ${issues.length === 1 ? "finding" : "findings"}: ${findings.join("; ")}.`;
}
