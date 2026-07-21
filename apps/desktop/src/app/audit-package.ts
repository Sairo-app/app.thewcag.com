import type {
  AuditActivity,
  AuditProject,
  AuditSampleItem,
  AuditTestRun,
  Finding,
  FindingSavedView,
  PublishedReport,
} from "../shared/desktop";

export const AUDIT_PACKAGE_VERSION = 1;

export interface AuditPackageCapture {
  id: string;
  title: string;
  rawPngDataUrl: string;
  thumbnailPngDataUrl?: string;
  document?: string;
}

export interface AuditPackagePayload {
  exportedAt: string;
  audit: AuditProject;
  sections: {
    sampleItems: AuditSampleItem[];
    testRuns: AuditTestRun[];
    findings: Finding[];
    findingViews: FindingSavedView[];
    checklist: Record<string, unknown>;
    history: unknown[];
    palette: string[];
    activity: AuditActivity[];
    reports: PublishedReport[];
  };
  captures: AuditPackageCapture[];
}

interface AuditPackageDocument {
  schemaVersion: number;
  payload: AuditPackagePayload;
  integrity: {
    algorithm: "SHA-256";
    digest: string;
  };
}

const MAX_PACKAGE_CHARACTERS = 300 * 1024 * 1024;
const PNG_DATA_URL = /^data:image\/png;base64,[a-zA-Z0-9+/=]+$/;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === "string");
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateStructuredSections(sections: Record<string, unknown>): void {
  const sampleItems = sections.sampleItems as unknown[];
  if (
    sampleItems.some(
      (item) =>
        !object(item) ||
        !hasStrings(item, ["id", "kind", "label", "location", "status", "notes"]) ||
        !["page", "flow", "component", "document", "state"].includes(
          String(item.kind),
        ) ||
        !["planned", "in-progress", "complete", "blocked"].includes(
          String(item.status),
        ) ||
        !finiteNumber(item.createdAt) ||
        !finiteNumber(item.modifiedAt),
    )
  ) {
    throw new Error("The audit package has invalid representative sample records.");
  }

  const testRuns = sections.testRuns as unknown[];
  if (
    testRuns.some(
      (run) =>
        !object(run) ||
        !hasStrings(run, ["id", "scriptId", "title", "category", "status", "notes"]) ||
        !["authentication", "checkout", "forms", "media", "documents", "components"].includes(
          String(run.category),
        ) ||
        !["planned", "in-progress", "complete", "blocked"].includes(
          String(run.status),
        ) ||
        !finiteNumber(run.createdAt) ||
        !finiteNumber(run.modifiedAt) ||
        !Array.isArray(run.steps) ||
        run.steps.length > 100 ||
        run.steps.some(
          (step) =>
            !object(step) ||
            !hasStrings(step, ["id", "label", "observation"]) ||
            typeof step.complete !== "boolean",
        ),
    )
  ) {
    throw new Error("The audit package has invalid guided test records.");
  }

  const findings = sections.findings as unknown[];
  if (
    findings.some(
      (finding) =>
        !object(finding) ||
        !hasStrings(finding, ["key", "title", "wcag", "severity", "status", "note"]) ||
        !["blocker", "major", "minor"].includes(String(finding.severity)) ||
        !["open", "retest", "fixed", "accepted"].includes(String(finding.status)) ||
        !finiteNumber(finding.createdAt) ||
        (finding.occurrences !== undefined &&
          (!Array.isArray(finding.occurrences) ||
            finding.occurrences.length > 2_000 ||
            finding.occurrences.some(
              (occurrence) =>
                !object(occurrence) ||
                !hasStrings(occurrence, ["id", "location", "note"]) ||
                !finiteNumber(occurrence.createdAt),
            ))) ||
        (finding.affectedUsers !== undefined &&
          (!Array.isArray(finding.affectedUsers) ||
            finding.affectedUsers.some((user) => typeof user !== "string"))),
    )
  ) {
    throw new Error("The audit package has invalid finding records.");
  }

  const findingViews = sections.findingViews as unknown[];
  if (
    findingViews.some(
      (view) =>
        !object(view) ||
        !hasStrings(view, ["id", "name", "query", "status", "severity", "sort"]) ||
        !finiteNumber(view.createdAt),
    )
  ) {
    throw new Error("The audit package has invalid finding views.");
  }

  if ((sections.palette as unknown[]).some((color) => typeof color !== "string")) {
    throw new Error("The audit package has an invalid palette.");
  }

  const history = sections.history as unknown[];
  if (
    history.some(
      (entry) =>
        !object(entry) ||
        !hasStrings(entry, ["fg", "bg"]) ||
        !finiteNumber(entry.ratio) ||
        !finiteNumber(entry.createdAt),
    )
  ) {
    throw new Error("The audit package has invalid contrast history.");
  }

  const activity = sections.activity as unknown[];
  if (
    activity.some(
      (entry) =>
        !object(entry) ||
        !hasStrings(entry, ["id", "auditId", "kind", "title"]) ||
        !finiteNumber(entry.createdAt),
    )
  ) {
    throw new Error("The audit package has invalid activity records.");
  }

  const reports = sections.reports as unknown[];
  if (
    reports.some(
      (report) =>
        !object(report) ||
        !hasStrings(report, ["id", "auditId", "captureId", "title", "url"]) ||
        !finiteNumber(report.findingCount) ||
        !finiteNumber(report.createdAt),
    )
  ) {
    throw new Error("The audit package has invalid report records.");
  }

  const checklist = sections.checklist as Record<string, unknown>;
  if (
    Object.values(checklist).some(
      (entry) =>
        !object(entry) ||
        typeof entry.note !== "string" ||
        !["untested", "pass", "fail", "na"].includes(String(entry.result)),
    )
  ) {
    throw new Error("The audit package has invalid checklist decisions.");
  }
}

function validatePayload(payload: unknown): asserts payload is AuditPackagePayload {
  if (!object(payload) || !object(payload.audit) || !object(payload.sections)) {
    throw new Error("This is not a TheWCAG audit package.");
  }
  if (
    typeof payload.audit.project !== "string" ||
    !hasStrings(payload.audit, [
      "target",
      "goal",
      "scope",
      "sample",
      "excludedScope",
      "environment",
      "assistiveTechnology",
      "methodology",
      "executiveSummary",
      "limitations",
      "completedAt",
      "auditor",
      "startedAt",
    ]) ||
    !["not-set", "in-progress", "meets-target", "does-not-meet-target"].includes(
      String(payload.audit.conclusion),
    ) ||
    !["WCAG 2.2 A", "WCAG 2.2 AA"].includes(String(payload.audit.standard))
  ) {
    throw new Error("The audit package has invalid project metadata.");
  }
  const sections = payload.sections;
  const limits: Array<[string, number]> = [
    ["sampleItems", 2_000],
    ["testRuns", 500],
    ["findings", 5_000],
    ["findingViews", 200],
    ["history", 10_000],
    ["palette", 100],
    ["activity", 10_000],
    ["reports", 1_000],
  ];
  for (const [key, maximum] of limits) {
    if (!Array.isArray(sections[key]) || sections[key].length > maximum) {
      throw new Error(`The audit package has an invalid ${key} section.`);
    }
  }
  if (!object(sections.checklist)) {
    throw new Error("The audit package has an invalid checklist section.");
  }
  validateStructuredSections(sections);
  if (!Array.isArray(payload.captures) || payload.captures.length > 100) {
    throw new Error("The audit package contains too many captures.");
  }
  for (const capture of payload.captures) {
    if (
      !object(capture) ||
      typeof capture.id !== "string" ||
      typeof capture.title !== "string" ||
      typeof capture.rawPngDataUrl !== "string" ||
      !PNG_DATA_URL.test(capture.rawPngDataUrl) ||
      capture.rawPngDataUrl.length > 55 * 1024 * 1024
    ) {
      throw new Error("The audit package contains an invalid capture.");
    }
    if (
      capture.thumbnailPngDataUrl !== undefined &&
      (typeof capture.thumbnailPngDataUrl !== "string" ||
        !PNG_DATA_URL.test(capture.thumbnailPngDataUrl) ||
        capture.thumbnailPngDataUrl.length > 12 * 1024 * 1024)
    ) {
      throw new Error("The audit package contains an invalid thumbnail.");
    }
    if (
      capture.document !== undefined &&
      (typeof capture.document !== "string" || capture.document.length > 8 * 1024 * 1024)
    ) {
      throw new Error("The audit package contains an invalid annotation document.");
    }
  }
}

export async function serializeAuditPackage(
  payload: AuditPackagePayload,
): Promise<string> {
  validatePayload(payload);
  const encoded = JSON.stringify(payload);
  if (encoded.length > MAX_PACKAGE_CHARACTERS) {
    throw new Error("The audit package is too large. Remove unnecessary captures and try again.");
  }
  const document: AuditPackageDocument = {
    schemaVersion: AUDIT_PACKAGE_VERSION,
    payload,
    integrity: {
      algorithm: "SHA-256",
      digest: await sha256(encoded),
    },
  };
  return JSON.stringify(document);
}

export async function parseAuditPackage(text: string): Promise<AuditPackagePayload> {
  if (!text || text.length > MAX_PACKAGE_CHARACTERS) {
    throw new Error("The audit package is empty or too large.");
  }
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error("The audit package is not valid JSON.");
  }
  if (
    !object(document) ||
    document.schemaVersion !== AUDIT_PACKAGE_VERSION ||
    !object(document.integrity) ||
    document.integrity.algorithm !== "SHA-256" ||
    typeof document.integrity.digest !== "string"
  ) {
    throw new Error("The audit package version or integrity record is not supported.");
  }
  validatePayload(document.payload);
  const digest = await sha256(JSON.stringify(document.payload));
  if (digest !== document.integrity.digest) {
    throw new Error("The audit package failed its integrity check and was not imported.");
  }
  return document.payload;
}
