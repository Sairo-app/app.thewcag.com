import type {
  Finding,
  FindingTicketLink,
  TicketConnectorId,
  TicketExternalSnapshot,
  TicketFieldMapping,
  TicketFieldValues,
  TicketSourceField,
  TicketSyncConflict,
} from "./desktop";
import { findingStatusHistoryAfterChange } from "./finding-lifecycle";

export const TICKET_SOURCE_FIELDS: TicketSourceField[] = [
  "title",
  "description",
  "actualResult",
  "expectedResult",
  "userImpact",
  "wcagMapping",
  "severity",
  "evidenceLink",
  "owner",
  "targetDate",
];

export const TICKET_FIELD_LABELS: Record<TicketSourceField, string> = {
  title: "Title",
  description: "Issue description",
  actualResult: "Actual result",
  expectedResult: "Expected result",
  userImpact: "Who it affects",
  wcagMapping: "WCAG mapping",
  severity: "Severity",
  evidenceLink: "Evidence",
  owner: "Owner",
  targetDate: "Target date",
};

export const DEFAULT_TICKET_FIELD_MAPPINGS: Record<TicketConnectorId, TicketFieldMapping> = {
  jira: {
    title: "summary",
    description: "description",
    actualResult: "description",
    expectedResult: "description",
    userImpact: "description",
    wcagMapping: "labels",
    severity: "priority",
    evidenceLink: "description",
    owner: "description",
    targetDate: "duedate",
  },
  linear: {
    title: "title",
    description: "description",
    actualResult: "description",
    expectedResult: "description",
    userImpact: "description",
    wcagMapping: "description",
    severity: "priority",
    evidenceLink: "description",
    owner: "description",
    targetDate: "dueDate",
  },
  github: {
    title: "title",
    description: "body",
    actualResult: "body",
    expectedResult: "body",
    userImpact: "body",
    wcagMapping: "body",
    severity: "body",
    evidenceLink: "body",
    owner: "body",
    targetDate: "body",
  },
};

export interface MappedTicketField {
  source: TicketSourceField;
  target: string;
  label: string;
  value: string;
}

function normalized(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function ticketFieldValuesFromFinding(finding: Finding): TicketFieldValues {
  const wcag = finding.wcagMappings?.length
    ? finding.wcagMappings
      .map((mapping) => mapping.criterion)
      .join("; ")
    : normalized(finding.wcag);
  return {
    title: normalized(finding.title),
    description: normalized(finding.description ?? finding.note),
    actualResult: normalized(finding.actualResult),
    expectedResult: normalized(finding.expectedResult),
    userImpact: normalized(finding.userImpact),
    wcagMapping: wcag,
    severity: finding.severity,
    evidenceLink: normalized(finding.evidenceLink),
    owner: normalized(finding.owner),
    targetDate: normalized(finding.dueDate),
  };
}

export function mapFindingToTicketFields(
  finding: Finding,
  mapping: TicketFieldMapping,
): MappedTicketField[] {
  return mapTicketFieldValues(ticketFieldValuesFromFinding(finding), mapping);
}

export function mapTicketFieldValues(
  values: TicketFieldValues,
  mapping: TicketFieldMapping,
): MappedTicketField[] {
  return TICKET_SOURCE_FIELDS.flatMap((source) => {
    const target = normalized(mapping[source]);
    const value = values[source];
    return target && value
      ? [{ source, target, value, label: TICKET_FIELD_LABELS[source] }]
      : [];
  });
}

export function ticketMarkdownSections(fields: MappedTicketField[]): string {
  return fields
    .map((field) => `### ${field.label}\n${field.value}`)
    .join("\n\n");
}

export function ticketMarkdownSectionValues(markdown: string): Partial<TicketFieldValues> {
  const byLabel = new Map(Object.entries(TICKET_FIELD_LABELS).map(([field, label]) => [label, field as TicketSourceField]));
  const result: Partial<TicketFieldValues> = {};
  const pattern = /^### (.+)\n([\s\S]*?)(?=\n\n### |$)/gm;
  for (const match of markdown.matchAll(pattern)) {
    const field = byLabel.get(match[1].trim());
    if (field) result[field] = match[2].trim();
  }
  return result;
}

export function createFindingTicketLink(
  connector: TicketConnectorId,
  externalId: string,
  key: string,
  url: string,
  snapshot: TicketExternalSnapshot,
): FindingTicketLink {
  return {
    connector,
    externalId,
    key,
    url,
    externalStatus: snapshot.status,
    syncState: "in-sync",
    baseline: snapshot,
    conflicts: [],
    createdAt: snapshot.fetchedAt,
    lastSyncedAt: snapshot.fetchedAt,
  };
}

function externalStatusConflict(
  finding: Finding,
  link: FindingTicketLink,
  external: TicketExternalSnapshot,
): TicketSyncConflict | null {
  if (external.status === link.baseline.status) return null;
  return {
    field: "status",
    kind: "external-change",
    baselineValue: link.baseline.status,
    localValue: finding.status,
    externalValue: external.status,
  };
}

export function reviewTicketSync(
  finding: Finding,
  link: FindingTicketLink,
  external: TicketExternalSnapshot,
): FindingTicketLink {
  const local = ticketFieldValuesFromFinding(finding);
  const baseline = { ...link.baseline.fields };
  const conflicts: TicketSyncConflict[] = [];
  for (const field of TICKET_SOURCE_FIELDS) {
    const externalValue = external.fields[field];
    if (externalValue === undefined) continue;
    const baselineValue = baseline[field] ?? local[field];
    if (externalValue === baselineValue) continue;
    if (local[field] === externalValue) {
      baseline[field] = externalValue;
      continue;
    }
    conflicts.push({
      field,
      kind: local[field] === baselineValue ? "external-change" : "diverged",
      baselineValue,
      localValue: local[field],
      externalValue,
    });
  }
  const statusConflict = externalStatusConflict(finding, link, external);
  if (statusConflict) conflicts.push(statusConflict);
  if (!conflicts.length) {
    return {
      ...link,
      externalStatus: external.status,
      syncState: "in-sync",
      baseline: { ...external, fields: { ...baseline, ...external.fields } },
      pendingExternal: undefined,
      conflicts: [],
      lastSyncedAt: external.fetchedAt,
      lastError: undefined,
    };
  }
  return {
    ...link,
    externalStatus: external.status,
    syncState: "review",
    baseline: { ...link.baseline, fields: baseline },
    pendingExternal: external,
    conflicts,
    lastError: undefined,
  };
}

function localStatusFromExternal(value: string): Finding["status"] | null {
  const status = value.trim().toLowerCase();
  if (/accepted|won't fix|wontfix|declined/.test(status)) return "accepted";
  if (/done|closed|complete|completed|resolved|fixed/.test(status)) return "fixed";
  if (/review|verify|retest|qa|in progress|started/.test(status)) return "retest";
  if (/open|todo|to do|backlog|new|reopen/.test(status)) return "open";
  return null;
}

function applyExternalField(finding: Finding, field: TicketSourceField | "status", value: string): Finding {
  if (field === "status") {
    const status = localStatusFromExternal(value);
    return status ? { ...finding, status } : finding;
  }
  if (field === "wcagMapping") {
    const criterion = /\b\d+\.\d+\.\d+\b/.exec(value)?.[0] ?? value.trim();
    return { ...finding, wcag: criterion };
  }
  if (field === "severity") {
    const severity = value.toLowerCase();
    return ["blocker", "major", "minor"].includes(severity)
      ? { ...finding, severity: severity as Finding["severity"] }
      : finding;
  }
  const key: Partial<Record<TicketSourceField, keyof Finding>> = {
    title: "title",
    description: "description",
    actualResult: "actualResult",
    expectedResult: "expectedResult",
    userImpact: "userImpact",
    evidenceLink: "evidenceLink",
    owner: "owner",
    targetDate: "dueDate",
  };
  const findingKey = key[field];
  return findingKey ? { ...finding, [findingKey]: value } : finding;
}

export function resolveTicketConflict(
  finding: Finding,
  field: TicketSourceField | "status",
  resolution: "keep-local" | "use-external",
): Finding {
  const link = finding.ticketLink;
  const conflict = link?.conflicts.find((item) => item.field === field);
  if (!link || !conflict) return finding;
  const changedAt = Date.now();
  let next = resolution === "use-external"
    ? applyExternalField(finding, field, conflict.externalValue)
    : finding;
  if (next.status !== finding.status) {
    next = {
      ...next,
      statusHistory: findingStatusHistoryAfterChange(
        finding,
        next.status,
        changedAt,
      ),
      retestedAt:
        next.status === "fixed" ? changedAt : finding.retestedAt,
    };
  }
  const remaining = link.conflicts.filter((item) => item.field !== field);
  const baseline = {
    ...link.baseline,
    fields: { ...link.baseline.fields },
    fetchedAt: link.pendingExternal?.fetchedAt ?? link.baseline.fetchedAt,
  };
  if (field === "status") baseline.status = conflict.externalValue;
  else baseline.fields[field] = conflict.externalValue;
  const resolved = remaining.length === 0;
  next = {
    ...next,
    modifiedAt: changedAt,
    ticketLink: {
      ...link,
      baseline,
      conflicts: remaining,
      syncState: resolved ? "in-sync" : "review",
      pendingExternal: resolved ? undefined : link.pendingExternal,
      lastSyncedAt: resolved ? baseline.fetchedAt : link.lastSyncedAt,
    },
  };
  return next;
}
