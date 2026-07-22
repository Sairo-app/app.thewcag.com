import type {
  AuditProject,
  AuditSampleItem,
  AuditTestRun,
  CaptureEntry,
  Finding,
} from "../shared/desktop";
import { normalizeFindingStatusHistory } from "../shared/finding-lifecycle";
import {
  buildAuditCoverage,
  type AuditChecklistEntry,
  type AuditCoverageState,
} from "./audit-coverage";
import { WCAG_CRITERIA } from "./data/wcag";

export interface ProgramAuditInput {
  audit: AuditProject;
  sampleItems: AuditSampleItem[];
  testRuns: AuditTestRun[];
  captures: CaptureEntry[];
  findings: Finding[];
  checklist: Record<string, AuditChecklistEntry>;
}

export interface ProgramRateMetric {
  numerator: number;
  denominator: number;
  percent: number | null;
}

export interface ProgramComponentRecurrence extends ProgramRateMetric {
  component: string;
  notObservedAgain: number;
}

export interface ProgramComponentHotspot {
  component: string;
  findingRecords: number;
  activeFindings: number;
  blockerOrMajor: number;
  auditCount: number;
  criteria: string[];
}

export interface ProgramMetrics {
  auditCount: number;
  archivedAuditCount: number;
  excludedDemoAudits: number;
  recurrence: ProgramRateMetric & {
    notObservedAgain: number;
    fixedWithoutTimestamp: number;
    byComponent: ProgramComponentRecurrence[];
  };
  retestTime: {
    medianMilliseconds: number | null;
    verifiedTransitions: number;
    fixedEventsMissingReadyTimestamp: number;
  };
  regression: ProgramRateMetric & {
    noPostVerificationUpdate: number;
  };
  hotspots: ProgramComponentHotspot[];
  coverageContext: {
    componentSamples: number;
    componentSampleStates: Record<AuditCoverageState, number>;
    criterionDecisions: number;
    untestedCriteria: number;
    unassignedFindings: number;
  };
}

interface ComponentFindingObservation {
  auditId: string;
  component: string;
  componentKey: string;
  criterion: string;
  finding: Finding;
  findingIdentity: string;
}

function percent(numerator: number, denominator: number): number | null {
  return denominator
    ? Math.round((numerator / denominator) * 1_000) / 10
    : null;
}

function normalizeComponent(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function criteriaForFinding(finding: Finding): string[] {
  const criteria = new Set<string>();
  const authored = `${finding.wcag} ${(finding.wcagMappings ?? [])
    .map((mapping) => mapping.criterion)
    .join(" ")}`;
  for (const match of authored.matchAll(/\b\d+\.\d+\.\d+\b/g)) {
    criteria.add(match[0]);
  }
  return [...criteria];
}

function fixedTimes(finding: Finding): number[] {
  return normalizeFindingStatusHistory(finding)
    .filter((entry) => entry.status === "fixed")
    .map((entry) => entry.changedAt);
}

function lifecycleDurations(finding: Finding): {
  durations: number[];
  fixedWithoutReady: number;
  hasRegression: boolean;
  hasVerifiedFix: boolean;
  hasPostVerificationUpdate: boolean;
} {
  const events = normalizeFindingStatusHistory(finding);
  const durations: number[] = [];
  let readyAt: number | null = null;
  let fixedAt: number | null = null;
  let fixedWithoutReady = 0;
  let hasRegression = false;
  let hasPostVerificationUpdate = false;

  for (const event of events) {
    if (fixedAt !== null && event.changedAt > fixedAt) {
      hasPostVerificationUpdate = true;
      if (event.status === "open" || event.status === "retest") {
        hasRegression = true;
      }
    }
    if (event.status === "retest") {
      readyAt = event.changedAt;
    } else if (event.status === "fixed") {
      if (readyAt !== null && event.changedAt >= readyAt) {
        durations.push(event.changedAt - readyAt);
      } else {
        fixedWithoutReady += 1;
      }
      readyAt = null;
      fixedAt = event.changedAt;
    } else if (event.status === "open" || event.status === "accepted") {
      readyAt = null;
    }
  }

  return {
    durations,
    fixedWithoutReady,
    hasRegression,
    hasVerifiedFix: fixedAt !== null,
    hasPostVerificationUpdate,
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calculateProgramMetrics(inputs: ProgramAuditInput[]): ProgramMetrics {
  const included = inputs.filter((input) => !input.audit.demo);
  const observations: ComponentFindingObservation[] = [];
  const hotspots = new Map<
    string,
    ProgramComponentHotspot & { auditIds: Set<string>; criteriaSet: Set<string> }
  >();
  const componentSampleStates: Record<AuditCoverageState, number> = {
    complete: 0,
    "in-progress": 0,
    blocked: 0,
    gap: 0,
    "not-started": 0,
  };
  let componentSamples = 0;
  let criterionDecisions = 0;
  let untestedCriteria = 0;
  let unassignedFindings = 0;

  for (const input of included) {
    const sampleById = new Map(input.sampleItems.map((sample) => [sample.id, sample]));
    const coverage = buildAuditCoverage(input);
    const componentRows = coverage.rows.filter((row) => row.sample.kind === "component");
    componentSamples += componentRows.length;
    componentRows.forEach((row) => {
      componentSampleStates[row.state] += 1;
    });
    unassignedFindings += coverage.unassigned.findings.length;

    const applicable = WCAG_CRITERIA.filter(
      (criterion) => input.audit.standard === "WCAG 2.2 AA" || criterion.level === "A",
    );
    for (const criterion of applicable) {
      const result = input.checklist[criterion.sc]?.result ?? "untested";
      if (result === "pass" || result === "fail" || result === "na") {
        criterionDecisions += 1;
      } else {
        untestedCriteria += 1;
      }
    }

    for (const finding of input.findings) {
      const sample = finding.sampleItemId
        ? sampleById.get(finding.sampleItemId)
        : undefined;
      if (!sample || sample.kind !== "component") continue;
      const componentKey = normalizeComponent(sample.label);
      if (!componentKey) continue;
      const criteria = criteriaForFinding(finding);
      const existing = hotspots.get(componentKey) ?? {
        component: sample.label.trim() || "Unnamed component",
        findingRecords: 0,
        activeFindings: 0,
        blockerOrMajor: 0,
        auditCount: 0,
        criteria: [],
        auditIds: new Set<string>(),
        criteriaSet: new Set<string>(),
      };
      existing.findingRecords += 1;
      if (finding.status === "open" || finding.status === "retest") {
        existing.activeFindings += 1;
      }
      if (finding.severity === "blocker" || finding.severity === "major") {
        existing.blockerOrMajor += 1;
      }
      existing.auditIds.add(input.audit.id);
      criteria.forEach((criterion) => existing.criteriaSet.add(criterion));
      hotspots.set(componentKey, existing);

      criteria.forEach((criterion) => {
        observations.push({
          auditId: input.audit.id,
          component: existing.component,
          componentKey,
          criterion,
          finding,
          findingIdentity: `${input.audit.id}:${finding.key}`,
        });
      });
    }
  }

  const recurrenceBySignature = new Map<
    string,
    { component: string; fixedAt: number; fixedFindingIdentity: string }
  >();
  let fixedWithoutTimestamp = 0;
  const fixedWithoutTimestampIdentities = new Set<string>();
  observations.forEach((observation) => {
    const times = fixedTimes(observation.finding);
    if (!times.length) {
      if (
        observation.finding.status === "fixed" &&
        !fixedWithoutTimestampIdentities.has(observation.findingIdentity)
      ) {
        fixedWithoutTimestampIdentities.add(observation.findingIdentity);
        fixedWithoutTimestamp += 1;
      }
      return;
    }
    const signature = `${observation.componentKey}\u0000${observation.criterion}`;
    const firstFixedAt = Math.min(...times);
    const current = recurrenceBySignature.get(signature);
    if (!current || firstFixedAt < current.fixedAt) {
      recurrenceBySignature.set(signature, {
        component: observation.component,
        fixedAt: firstFixedAt,
        fixedFindingIdentity: observation.findingIdentity,
      });
    }
  });

  const recurringSignatures = new Set<string>();
  observations.forEach((observation) => {
    const signature = `${observation.componentKey}\u0000${observation.criterion}`;
    const priorFix = recurrenceBySignature.get(signature);
    if (
      priorFix &&
      observation.findingIdentity !== priorFix.fixedFindingIdentity &&
      observation.finding.createdAt > priorFix.fixedAt
    ) {
      recurringSignatures.add(signature);
    }
  });

  const recurrenceComponents = new Map<
    string,
    { component: string; denominator: number; numerator: number }
  >();
  recurrenceBySignature.forEach((entry, signature) => {
    const componentKey = signature.split("\u0000", 1)[0];
    const current = recurrenceComponents.get(componentKey) ?? {
      component: entry.component,
      denominator: 0,
      numerator: 0,
    };
    current.denominator += 1;
    if (recurringSignatures.has(signature)) current.numerator += 1;
    recurrenceComponents.set(componentKey, current);
  });

  const durations: number[] = [];
  let fixedEventsMissingReadyTimestamp = 0;
  let verifiedFindings = 0;
  let regressedFindings = 0;
  let noPostVerificationUpdate = 0;
  included.flatMap((input) => input.findings).forEach((finding) => {
    const lifecycle = lifecycleDurations(finding);
    durations.push(...lifecycle.durations);
    fixedEventsMissingReadyTimestamp += lifecycle.fixedWithoutReady;
    if (!lifecycle.hasVerifiedFix) return;
    verifiedFindings += 1;
    if (lifecycle.hasRegression) regressedFindings += 1;
    if (!lifecycle.hasPostVerificationUpdate) noPostVerificationUpdate += 1;
  });

  const recurrenceDenominator = recurrenceBySignature.size;
  const recurrenceNumerator = recurringSignatures.size;
  const hotspotRows = [...hotspots.values()]
    .map(({ auditIds, criteriaSet, ...row }) => ({
      ...row,
      auditCount: auditIds.size,
      criteria: [...criteriaSet].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      ),
    }))
    .sort(
      (left, right) =>
        right.findingRecords - left.findingRecords ||
        left.component.localeCompare(right.component),
    );

  return {
    auditCount: included.length,
    archivedAuditCount: included.filter((input) => input.audit.archivedAt).length,
    excludedDemoAudits: inputs.length - included.length,
    recurrence: {
      numerator: recurrenceNumerator,
      denominator: recurrenceDenominator,
      percent: percent(recurrenceNumerator, recurrenceDenominator),
      notObservedAgain: recurrenceDenominator - recurrenceNumerator,
      fixedWithoutTimestamp,
      byComponent: [...recurrenceComponents.values()]
        .map((entry) => ({
          component: entry.component,
          numerator: entry.numerator,
          denominator: entry.denominator,
          percent: percent(entry.numerator, entry.denominator),
          notObservedAgain: entry.denominator - entry.numerator,
        }))
        .sort(
          (left, right) =>
            right.numerator - left.numerator ||
            right.denominator - left.denominator ||
            left.component.localeCompare(right.component),
        ),
    },
    retestTime: {
      medianMilliseconds: median(durations),
      verifiedTransitions: durations.length,
      fixedEventsMissingReadyTimestamp,
    },
    regression: {
      numerator: regressedFindings,
      denominator: verifiedFindings,
      percent: percent(regressedFindings, verifiedFindings),
      noPostVerificationUpdate,
    },
    hotspots: hotspotRows,
    coverageContext: {
      componentSamples,
      componentSampleStates,
      criterionDecisions,
      untestedCriteria,
      unassignedFindings,
    },
  };
}
