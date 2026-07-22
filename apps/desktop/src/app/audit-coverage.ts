import type {
  AuditSampleItem,
  AuditTestRun,
  CaptureEntry,
  Finding,
} from "../shared/desktop";
import {
  findingEvidenceCaptureIds,
  findingHasEvidence,
  referencedEvidenceCaptureIds,
} from "../shared/finding-evidence";
import { auditTestRunComplete } from "./audit-plan";

export interface AuditChecklistEntry {
  result: "untested" | "pass" | "fail" | "na";
  note: string;
  findingKey?: string;
}

export type AuditCoverageState =
  | "complete"
  | "in-progress"
  | "blocked"
  | "gap"
  | "not-started";

export interface AuditCoverageRow {
  sample: AuditSampleItem;
  testRuns: AuditTestRun[];
  captures: CaptureEntry[];
  findings: Finding[];
  findingsWithEvidence: number;
  findingsWithoutEvidence: number;
  criteria: string[];
  state: AuditCoverageState;
  gap: string;
}

export interface AuditCoverage {
  rows: AuditCoverageRow[];
  complete: number;
  blocked: number;
  gaps: number;
  percent: number;
  unassigned: {
    testRuns: AuditTestRun[];
    captures: CaptureEntry[];
    findings: Finding[];
  };
}

export interface AuditSessionSelection {
  sampleItemId: string;
  testRunId?: string;
}

function criteriaForFinding(finding: Finding): string[] {
  const criteria = new Set<string>();
  if (finding.wcag.trim()) {
    finding.wcag
      .split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => criteria.add(value));
  }
  finding.wcagMappings?.forEach((mapping) => criteria.add(mapping.criterion));
  return [...criteria];
}

function coverageState(
  sample: AuditSampleItem,
  runs: AuditTestRun[],
  traceCount: number,
  findingsWithoutEvidence: number,
): Pick<AuditCoverageRow, "state" | "gap"> {
  if (sample.status === "blocked" || runs.some((run) => run.status === "blocked")) {
    return { state: "blocked", gap: sample.notes.trim() || "Testing is blocked." };
  }
  if (sample.status === "complete") {
    if (runs.some((run) => !auditTestRunComplete(run))) {
      return {
        state: "gap",
        gap: "The sample is marked tested, but a linked guided run is incomplete.",
      };
    }
    if (findingsWithoutEvidence) {
      return {
        state: "gap",
        gap: `${findingsWithoutEvidence} finding${findingsWithoutEvidence === 1 ? " needs" : "s need"} linked evidence.`,
      };
    }
    return traceCount
      ? { state: "complete", gap: "" }
      : { state: "gap", gap: "Tested, but no guided run, capture, finding, or WCAG decision is linked." };
  }
  if (
    sample.status === "in-progress" ||
    runs.some((run) => run.status === "in-progress" || auditTestRunComplete(run)) ||
    traceCount
  ) {
    return {
      state: "in-progress",
      gap: runs.length ? "" : "No guided run is linked to this sample yet.",
    };
  }
  return { state: "not-started", gap: "Testing has not started." };
}

export function buildAuditCoverage(input: {
  sampleItems: AuditSampleItem[];
  testRuns: AuditTestRun[];
  captures: CaptureEntry[];
  findings: Finding[];
  checklist: Record<string, AuditChecklistEntry>;
}): AuditCoverage {
  const sampleIds = new Set(input.sampleItems.map((sample) => sample.id));
  const availableCaptureIds = new Set(input.captures.map((capture) => capture.id));
  const assignedCaptureIds = referencedEvidenceCaptureIds(input.findings);
  const rows = input.sampleItems.map((sample): AuditCoverageRow => {
    const testRuns = input.testRuns.filter((run) => run.sampleItemId === sample.id);
    const findings = input.findings.filter((finding) => finding.sampleItemId === sample.id);
    const captureIds = new Set(findings.flatMap(findingEvidenceCaptureIds));
    const captures = input.captures.filter((capture) => captureIds.has(capture.id));
    const findingsWithEvidence = findings.filter((finding) =>
      findingHasEvidence(finding, availableCaptureIds),
    ).length;
    const findingsWithoutEvidence = findings.length - findingsWithEvidence;
    const findingKeys = new Set(findings.map((finding) => finding.key));
    const criteria = new Set(findings.flatMap(criteriaForFinding));
    Object.entries(input.checklist).forEach(([criterion, entry]) => {
      if (
        entry.result !== "untested" &&
        entry.findingKey &&
        findingKeys.has(entry.findingKey)
      ) {
        criteria.add(criterion);
      }
    });
    const traceCount = testRuns.length + captures.length + findings.length + criteria.size;
    const state = coverageState(sample, testRuns, traceCount, findingsWithoutEvidence);
    return {
      sample,
      testRuns,
      captures,
      findings,
      findingsWithEvidence,
      findingsWithoutEvidence,
      criteria: [...criteria].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      ...state,
    };
  });
  const complete = rows.filter((row) => row.state === "complete").length;
  const blocked = rows.filter((row) => row.state === "blocked").length;
  const gaps = rows.filter(
    (row) => row.state === "gap" || row.state === "not-started" || Boolean(row.gap),
  ).length;
  return {
    rows,
    complete,
    blocked,
    gaps,
    percent: rows.length ? Math.round((complete / rows.length) * 100) : 0,
    unassigned: {
      testRuns: input.testRuns.filter((run) => !run.sampleItemId || !sampleIds.has(run.sampleItemId)),
      captures: input.captures.filter((capture) => !assignedCaptureIds.has(capture.id)),
      findings: input.findings.filter(
        (finding) => !finding.sampleItemId || !sampleIds.has(finding.sampleItemId),
      ),
    },
  };
}

export function findNextAuditSession(
  sampleItems: AuditSampleItem[],
  testRuns: AuditTestRun[],
): AuditSessionSelection | null {
  const availableSamples = sampleItems.filter((sample) => sample.status !== "blocked");
  if (!availableSamples.length) return null;

  const pendingRuns = testRuns.filter(
    (run) => !auditTestRunComplete(run) && run.status !== "blocked",
  );
  const run = pendingRuns.find((item) => item.status === "in-progress") ?? pendingRuns[0];
  const pendingSamples = availableSamples.filter(
    (sample) => sample.status === "planned" || sample.status === "in-progress",
  );
  if (!run && !pendingSamples.length) return null;
  const assignedSample = run?.sampleItemId
    ? availableSamples.find((sample) => sample.id === run.sampleItemId)
    : undefined;
  const sample =
    assignedSample ??
    pendingSamples.find((item) => item.status === "in-progress") ??
    pendingSamples.find((item) => item.status === "planned") ??
    availableSamples[0];

  return sample ? { sampleItemId: sample.id, testRunId: run?.id } : null;
}
