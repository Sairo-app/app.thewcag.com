import {
  AI_DRAFT_SCHEMA_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  NATIVE_PROTOCOL_VERSION,
  type AffectedUser,
  type AiFindingDraftV1,
  type DeterministicCheckV1,
  type DraftConfidence,
  type EvidenceCaptureMode,
  type EvidencePacketV1,
  type EvidenceRect,
  type FindingSeverity,
  type NativeRequestV1,
  type WcagMappingV1,
} from "./types";
import { WCAG_BY_ID } from "./wcag";
import { createFindingId, isFindingId } from "./finding-id";

const DATA_URL_MAX = 8 * 1024 * 1024;
const PACKET_JSON_MAX = 12 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUDIT_ID = /^aud-[a-z0-9-]{6,36}$/;
const WCAG = /^\d+(?:\.\d+){1,2}$/;

const affectedUsers = new Set<AffectedUser>([
  "screen-reader",
  "keyboard",
  "low-vision",
  "color-vision",
  "cognitive",
  "motor",
  "voice-control",
  "deaf-hard-of-hearing",
  "all-users",
  "other",
]);
const severities = new Set<FindingSeverity>(["blocker", "major", "minor"]);
const confidenceValues = new Set<DraftConfidence>(["high", "medium", "low"]);

export class ContractValidationError extends Error {
  constructor(message: string, readonly path = "value") {
    super(`${path}: ${message}`);
    this.name = "ContractValidationError";
  }
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContractValidationError("expected an object", path);
  }
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string, max: number, min = 0): string {
  if (typeof value !== "string") throw new ContractValidationError("expected a string", path);
  if (value.length < min || value.length > max) {
    throw new ContractValidationError(`expected ${min}-${max} characters`, path);
  }
  return value;
}

function numberAt(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new ContractValidationError(`expected a finite number from ${min} to ${max}`, path);
  }
  return value;
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new ContractValidationError("expected a boolean", path);
  return value;
}

function stringArrayAt(value: unknown, path: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ContractValidationError(`expected no more than ${maxItems} items`, path);
  }
  return value.map((item, index) => stringAt(item, `${path}[${index}]`, maxLength));
}

function exactVersion(value: unknown, expected: number, path: string): void {
  if (value !== expected) throw new ContractValidationError(`unsupported schema version ${String(value)}`, path);
}

function rectAt(value: unknown, path: string): EvidenceRect {
  const item = objectAt(value, path);
  return {
    x: numberAt(item.x, `${path}.x`, -100_000, 100_000),
    y: numberAt(item.y, `${path}.y`, -100_000, 100_000),
    width: numberAt(item.width, `${path}.width`, 1, 100_000),
    height: numberAt(item.height, `${path}.height`, 1, 100_000),
  };
}

function recordAt(value: unknown, path: string, maxItems: number, keyMax: number, valueMax: number): Record<string, string> {
  const item = objectAt(value, path);
  const entries = Object.entries(item);
  if (entries.length > maxItems) throw new ContractValidationError(`expected no more than ${maxItems} fields`, path);
  return Object.fromEntries(entries.map(([key, entry]) => [
    stringAt(key, `${path}.key`, keyMax, 1),
    stringAt(entry, `${path}.${key}`, valueMax),
  ]));
}

function checkAt(value: unknown, path: string): DeterministicCheckV1 {
  const item = objectAt(value, path);
  const outcome = stringAt(item.outcome, `${path}.outcome`, 20) as DeterministicCheckV1["outcome"];
  if (!["pass", "fail", "needs-review", "not-applicable"].includes(outcome)) {
    throw new ContractValidationError("unsupported outcome", `${path}.outcome`);
  }
  const impact = item.impact === undefined ? undefined : stringAt(item.impact, `${path}.impact`, 12) as FindingSeverity;
  if (impact && !severities.has(impact)) throw new ContractValidationError("unsupported severity", `${path}.impact`);
  const wcag = stringArrayAt(item.wcag, `${path}.wcag`, 8, 12);
  if (wcag.some((criterion) => !WCAG.test(criterion))) throw new ContractValidationError("invalid WCAG criterion", `${path}.wcag`);
  return {
    id: stringAt(item.id, `${path}.id`, 80, 1),
    outcome,
    title: stringAt(item.title, `${path}.title`, 180, 1),
    description: stringAt(item.description, `${path}.description`, 1_000),
    wcag,
    impact,
  };
}

export function parseEvidencePacket(value: unknown): EvidencePacketV1 {
  const byteLength = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (byteLength > PACKET_JSON_MAX) throw new ContractValidationError("packet is too large");
  const item = objectAt(value, "evidence");
  exactVersion(item.schemaVersion, EVIDENCE_SCHEMA_VERSION, "evidence.schemaVersion");
  const captureMode = stringAt(item.captureMode, "evidence.captureMode", 12) as EvidenceCaptureMode;
  if (captureMode !== "element" && captureMode !== "region") {
    throw new ContractValidationError("unsupported capture mode", "evidence.captureMode");
  }

  const page = objectAt(item.page, "evidence.page");
  const viewport = objectAt(page.viewport, "evidence.page.viewport");
  const target = objectAt(item.target, "evidence.target");
  const kind = stringAt(target.kind, "evidence.target.kind", 12) as EvidenceCaptureMode;
  if (kind !== captureMode) throw new ContractValidationError("must match capture mode", "evidence.target.kind");

  let image: EvidencePacketV1["image"];
  if (item.image !== undefined) {
    const raw = objectAt(item.image, "evidence.image");
    const mimeType = stringAt(raw.mimeType, "evidence.image.mimeType", 20) as NonNullable<EvidencePacketV1["image"]>["mimeType"];
    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      throw new ContractValidationError("unsupported image type", "evidence.image.mimeType");
    }
    const dataUrl = stringAt(raw.dataUrl, "evidence.image.dataUrl", DATA_URL_MAX, 20);
    if (!dataUrl.startsWith(`data:${mimeType};base64,`)) {
      throw new ContractValidationError("image data URL does not match MIME type", "evidence.image.dataUrl");
    }
    image = {
      mimeType,
      dataUrl,
      width: numberAt(raw.width, "evidence.image.width", 1, 20_000),
      height: numberAt(raw.height, "evidence.image.height", 1, 20_000),
      sourceWidth: numberAt(raw.sourceWidth, "evidence.image.sourceWidth", 1, 40_000),
      sourceHeight: numberAt(raw.sourceHeight, "evidence.image.sourceHeight", 1, 40_000),
    };
  }

  let consent: EvidencePacketV1["consent"];
  if (item.consent !== undefined) {
    const raw = objectAt(item.consent, "evidence.consent");
    consent = {
      approvedAt: numberAt(raw.approvedAt, "evidence.consent.approvedAt", 1_500_000_000_000, 4_500_000_000_000),
      includeScreenshot: booleanAt(raw.includeScreenshot, "evidence.consent.includeScreenshot"),
      includeElementText: booleanAt(raw.includeElementText, "evidence.consent.includeElementText"),
      includeUrl: booleanAt(raw.includeUrl, "evidence.consent.includeUrl"),
    };
  }

  const auditId = item.auditId === undefined ? undefined : stringAt(item.auditId, "evidence.auditId", 48, 1);
  if (auditId && !AUDIT_ID.test(auditId)) throw new ContractValidationError("invalid audit ID", "evidence.auditId");

  const capturedAt = numberAt(item.capturedAt, "evidence.capturedAt", 1_500_000_000_000, 4_500_000_000_000);
  const findingId = item.findingId === undefined
    ? createFindingId(capturedAt)
    : stringAt(item.findingId, "evidence.findingId", 64, 1);
  if (!isFindingId(findingId)) {
    throw new ContractValidationError("invalid finding ID", "evidence.findingId");
  }

  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: (() => {
      const id = stringAt(item.id, "evidence.id", 64, 1);
      if (!UUID.test(id)) throw new ContractValidationError("invalid UUID", "evidence.id");
      return id;
    })(),
    findingId,
    auditId,
    capturedAt,
    captureMode,
    observation: stringAt(item.observation, "evidence.observation", 2_000),
    taskContext: stringAt(item.taskContext, "evidence.taskContext", 1_000),
    page: {
      title: stringAt(page.title, "evidence.page.title", 300),
      url: stringAt(page.url, "evidence.page.url", 2_048),
      origin: stringAt(page.origin, "evidence.page.origin", 255),
      locale: stringAt(page.locale, "evidence.page.locale", 40),
      browser: stringAt(page.browser, "evidence.page.browser", 120),
      viewport: {
        width: numberAt(viewport.width, "evidence.page.viewport.width", 1, 20_000),
        height: numberAt(viewport.height, "evidence.page.viewport.height", 1, 20_000),
        devicePixelRatio: numberAt(viewport.devicePixelRatio, "evidence.page.viewport.devicePixelRatio", 0.25, 8),
        visualScale: numberAt(viewport.visualScale, "evidence.page.viewport.visualScale", 0.1, 10),
        offsetLeft: numberAt(viewport.offsetLeft, "evidence.page.viewport.offsetLeft", -100_000, 100_000),
        offsetTop: numberAt(viewport.offsetTop, "evidence.page.viewport.offsetTop", -100_000, 100_000),
      },
    },
    target: {
      kind,
      tagName: stringAt(target.tagName, "evidence.target.tagName", 40),
      role: stringAt(target.role, "evidence.target.role", 80),
      accessibleName: stringAt(target.accessibleName, "evidence.target.accessibleName", 500),
      accessibleDescription: stringAt(target.accessibleDescription, "evidence.target.accessibleDescription", 1_000),
      selector: stringAt(target.selector, "evidence.target.selector", 1_000),
      structuralPath: stringAt(target.structuralPath, "evidence.target.structuralPath", 1_000),
      bounds: rectAt(target.bounds, "evidence.target.bounds"),
      marker: rectAt(target.marker, "evidence.target.marker"),
      states: stringArrayAt(target.states, "evidence.target.states", 40, 100),
      labels: stringArrayAt(target.labels, "evidence.target.labels", 20, 500),
      nearbyHeading: stringAt(target.nearbyHeading, "evidence.target.nearbyHeading", 500),
      landmark: stringAt(target.landmark, "evidence.target.landmark", 120),
      attributes: recordAt(target.attributes, "evidence.target.attributes", 60, 80, 1_000),
      styles: recordAt(target.styles, "evidence.target.styles", 40, 80, 300),
      domExcerpt: stringAt(target.domExcerpt, "evidence.target.domExcerpt", 12_000),
    },
    image,
    checks: (() => {
      if (!Array.isArray(item.checks) || item.checks.length > 80) {
        throw new ContractValidationError("expected no more than 80 checks", "evidence.checks");
      }
      return item.checks.map((entry, index) => checkAt(entry, `evidence.checks[${index}]`));
    })(),
    omissions: stringArrayAt(item.omissions, "evidence.omissions", 40, 300),
    consent,
  };
}

function wcagAt(value: unknown, path: string): WcagMappingV1 {
  const item = objectAt(value, path);
  const criterion = stringAt(item.criterion, `${path}.criterion`, 12, 3);
  const official = WCAG.test(criterion) ? WCAG_BY_ID.get(criterion) : undefined;
  if (!official) throw new ContractValidationError("unsupported WCAG 2.2 A or AA criterion", `${path}.criterion`);
  const level = stringAt(item.level, `${path}.level`, 2) as WcagMappingV1["level"];
  if (level !== "A" && level !== "AA") throw new ContractValidationError("unsupported level", `${path}.level`);
  const confidence = stringAt(item.confidence, `${path}.confidence`, 10) as DraftConfidence;
  if (!confidenceValues.has(confidence)) throw new ContractValidationError("unsupported confidence", `${path}.confidence`);
  return {
    criterion,
    level: official.level,
    name: official.name,
    rationale: stringAt(item.rationale, `${path}.rationale`, 1_000, 1),
    confidence,
  };
}

export function parseAiFindingDraft(value: unknown): AiFindingDraftV1 {
  const item = objectAt(value, "draft");
  exactVersion(item.schemaVersion, AI_DRAFT_SCHEMA_VERSION, "draft.schemaVersion");
  const severity = stringAt(item.severity, "draft.severity", 12) as FindingSeverity;
  if (!severities.has(severity)) throw new ContractValidationError("unsupported severity", "draft.severity");
  const confidence = stringAt(item.confidence, "draft.confidence", 10) as DraftConfidence;
  if (!confidenceValues.has(confidence)) throw new ContractValidationError("unsupported confidence", "draft.confidence");

  if (!Array.isArray(item.affectedUsers) || item.affectedUsers.length < 1 || item.affectedUsers.length > affectedUsers.size) {
    throw new ContractValidationError("expected at least one supported affected-user category", "draft.affectedUsers");
  }
  const users = item.affectedUsers.map((value, index) => {
    const user = stringAt(value, `draft.affectedUsers[${index}]`, 40) as AffectedUser;
    if (!affectedUsers.has(user)) throw new ContractValidationError("unsupported affected-user category", `draft.affectedUsers[${index}]`);
    return user;
  });

  if (!Array.isArray(item.wcag) || item.wcag.length > 8) {
    throw new ContractValidationError("expected no more than 8 WCAG mappings", "draft.wcag");
  }
  if (!Array.isArray(item.fieldConfidence) || item.fieldConfidence.length > 30) {
    throw new ContractValidationError("expected no more than 30 confidence entries", "draft.fieldConfidence");
  }
  const provenance = objectAt(item.provenance, "draft.provenance");
  const source = stringAt(provenance.source, "draft.provenance.source", 10) as AiFindingDraftV1["provenance"]["source"];
  if (source !== "local" && source !== "ai") throw new ContractValidationError("unsupported source", "draft.provenance.source");

  const wcag = item.wcag.map((entry, index) => wcagAt(entry, `draft.wcag[${index}]`));
  if (new Set(wcag.map((entry) => entry.criterion)).size !== wcag.length) {
    throw new ContractValidationError("duplicate criteria are not allowed", "draft.wcag");
  }
  const reproductionSteps = stringArrayAt(item.reproductionSteps, "draft.reproductionSteps", 20, 1_000);
  if (!reproductionSteps.length) {
    throw new ContractValidationError("expected at least one step", "draft.reproductionSteps");
  }
  const manualChecks = stringArrayAt(item.manualChecks, "draft.manualChecks", 20, 500);
  if (!manualChecks.length) {
    throw new ContractValidationError("expected at least one manual check", "draft.manualChecks");
  }

  return {
    schemaVersion: AI_DRAFT_SCHEMA_VERSION,
    title: stringAt(item.title, "draft.title", 240, 1),
    description: stringAt(item.description, "draft.description", 3_000, 1),
    actualResult: stringAt(item.actualResult, "draft.actualResult", 3_000, 1),
    expectedResult: stringAt(item.expectedResult, "draft.expectedResult", 3_000, 1),
    userImpact: stringAt(item.userImpact, "draft.userImpact", 2_000, 1),
    affectedUsers: [...new Set(users)],
    severity,
    severityRationale: stringAt(item.severityRationale, "draft.severityRationale", 1_000, 1),
    wcag,
    recommendation: stringAt(item.recommendation, "draft.recommendation", 4_000, 1),
    exampleFix: stringAt(item.exampleFix, "draft.exampleFix", 6_000),
    reproductionSteps,
    confidence,
    fieldConfidence: item.fieldConfidence.map((entry, index) => {
      const field = objectAt(entry, `draft.fieldConfidence[${index}]`);
      const fieldConfidence = stringAt(field.confidence, `draft.fieldConfidence[${index}].confidence`, 10) as DraftConfidence;
      if (!confidenceValues.has(fieldConfidence)) {
        throw new ContractValidationError("unsupported confidence", `draft.fieldConfidence[${index}].confidence`);
      }
      return {
        field: stringAt(field.field, `draft.fieldConfidence[${index}].field`, 80, 1),
        confidence: fieldConfidence,
        reason: stringAt(field.reason, `draft.fieldConfidence[${index}].reason`, 500),
      };
    }),
    assumptions: stringArrayAt(item.assumptions, "draft.assumptions", 20, 500),
    manualChecks,
    provenance: {
      source,
      model: stringAt(provenance.model, "draft.provenance.model", 120),
      modelVersion: stringAt(provenance.modelVersion, "draft.provenance.modelVersion", 120),
      promptVersion: stringAt(provenance.promptVersion, "draft.provenance.promptVersion", 80),
      knowledgeVersion: stringAt(provenance.knowledgeVersion, "draft.provenance.knowledgeVersion", 80),
      generatedAt: numberAt(provenance.generatedAt, "draft.provenance.generatedAt", 1_500_000_000_000, 4_500_000_000_000),
    },
  };
}

export function parseNativeRequest(value: unknown): NativeRequestV1 {
  const item = objectAt(value, "request");
  exactVersion(item.protocolVersion, NATIVE_PROTOCOL_VERSION, "request.protocolVersion");
  const requestId = stringAt(item.requestId, "request.requestId", 64, 1);
  if (!UUID.test(requestId)) throw new ContractValidationError("invalid UUID", "request.requestId");
  const type = stringAt(item.type, "request.type", 40);
  if (type === "ping" || type === "audits:list") {
    return { protocolVersion: NATIVE_PROTOCOL_VERSION, requestId, type };
  }
  if (type === "finding:generate") {
    return { protocolVersion: NATIVE_PROTOCOL_VERSION, requestId, type, evidence: parseEvidencePacket(item.evidence) };
  }
  if (type === "finding:save") {
    const auditId = stringAt(item.auditId, "request.auditId", 48, 1);
    if (!AUDIT_ID.test(auditId)) throw new ContractValidationError("invalid audit ID", "request.auditId");
    return {
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId,
      type,
      auditId,
      evidence: parseEvidencePacket(item.evidence),
      draft: parseAiFindingDraft(item.draft),
    };
  }
  if (type === "finding:queue") {
    const auditId = stringAt(item.auditId, "request.auditId", 48, 1);
    if (!AUDIT_ID.test(auditId)) throw new ContractValidationError("invalid audit ID", "request.auditId");
    return {
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId,
      type,
      auditId,
      evidence: parseEvidencePacket(item.evidence),
    };
  }
  throw new ContractValidationError("unsupported request type", "request.type");
}
