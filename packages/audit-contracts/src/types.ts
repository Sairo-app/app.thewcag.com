export const EVIDENCE_SCHEMA_VERSION = 1 as const;
export const AI_DRAFT_SCHEMA_VERSION = 1 as const;
export const NATIVE_PROTOCOL_VERSION = 1 as const;

export type EvidenceCaptureMode = "element" | "region";
export type FindingSeverity = "blocker" | "major" | "minor";
export type DraftConfidence = "high" | "medium" | "low";

export type AffectedUser =
  | "screen-reader"
  | "keyboard"
  | "low-vision"
  | "color-vision"
  | "cognitive"
  | "motor"
  | "voice-control"
  | "deaf-hard-of-hearing"
  | "all-users"
  | "other";

export interface EvidenceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidencePageV1 {
  title: string;
  url: string;
  origin: string;
  locale: string;
  browser: string;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
    visualScale: number;
    offsetLeft: number;
    offsetTop: number;
  };
}

export interface EvidenceTargetV1 {
  kind: EvidenceCaptureMode;
  tagName: string;
  role: string;
  accessibleName: string;
  accessibleDescription: string;
  selector: string;
  structuralPath: string;
  bounds: EvidenceRect;
  marker: EvidenceRect;
  states: string[];
  labels: string[];
  nearbyHeading: string;
  landmark: string;
  attributes: Record<string, string>;
  styles: Record<string, string>;
  domExcerpt: string;
}

export interface DeterministicCheckV1 {
  id: string;
  outcome: "pass" | "fail" | "needs-review" | "not-applicable";
  title: string;
  description: string;
  wcag: string[];
  impact?: FindingSeverity;
}

export interface EvidenceImageV1 {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dataUrl: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface EvidenceConsentV1 {
  approvedAt: number;
  includeScreenshot: boolean;
  /** Component name, role, selector, HTML metadata, geometry, and derived checks. */
  includeElementText: boolean;
  /** Page title, address, browser/device details, and locale. Retains the legacy field name. */
  includeUrl: boolean;
}

export interface EvidencePacketV1 {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  id: string;
  /** Immutable platform identity for the finding this evidence can produce. */
  findingId: string;
  auditId?: string;
  capturedAt: number;
  captureMode: EvidenceCaptureMode;
  observation: string;
  taskContext: string;
  page: EvidencePageV1;
  target: EvidenceTargetV1;
  image?: EvidenceImageV1;
  checks: DeterministicCheckV1[];
  omissions: string[];
  consent?: EvidenceConsentV1;
}

export interface WcagMappingV1 {
  criterion: string;
  level: "A" | "AA";
  name: string;
  rationale: string;
  confidence: DraftConfidence;
}

export interface FieldConfidenceV1 {
  field: string;
  confidence: DraftConfidence;
  reason: string;
}

export interface AiFindingDraftV1 {
  schemaVersion: typeof AI_DRAFT_SCHEMA_VERSION;
  title: string;
  description: string;
  actualResult: string;
  expectedResult: string;
  userImpact: string;
  affectedUsers: AffectedUser[];
  severity: FindingSeverity;
  severityRationale: string;
  wcag: WcagMappingV1[];
  recommendation: string;
  exampleFix: string;
  reproductionSteps: string[];
  confidence: DraftConfidence;
  fieldConfidence: FieldConfidenceV1[];
  assumptions: string[];
  manualChecks: string[];
  provenance: {
    source: "local" | "ai";
    model: string;
    modelVersion: string;
    promptVersion: string;
    knowledgeVersion: string;
    generatedAt: number;
  };
}

export interface AuditSummaryV1 {
  id: string;
  project: string;
  target: string;
  standard: "WCAG 2.2 A" | "WCAG 2.2 AA";
  active: boolean;
  updatedAt: number;
}

export type NativeRequestV1 =
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      type: "ping";
    }
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      type: "audits:list";
    }
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      type: "finding:generate";
      evidence: EvidencePacketV1;
    }
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      type: "finding:save";
      auditId: string;
      evidence: EvidencePacketV1;
      draft: AiFindingDraftV1;
    }
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      type: "finding:queue";
      auditId: string;
      evidence: EvidencePacketV1;
    };

export type NativeResponseV1 =
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      ok: true;
      type: "pong";
      appVersion: string;
    }
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      ok: true;
      type: "audits:list";
      audits: AuditSummaryV1[];
    }
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      ok: true;
      type: "finding:generated";
      draft: AiFindingDraftV1;
    }
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      ok: true;
      type: "finding:saved";
      findingKey: string;
    }
  | {
      protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
      requestId: string;
      ok: true;
      type: "finding:queued";
      findingKey: string;
      draftSource: "local" | "ai";
    }
  | {
      /** Error bodies remain readable across protocol versions so clients can surface upgrade guidance. */
      protocolVersion: number;
      requestId: string;
      ok: false;
      type: "error";
      code:
        | "invalid-request"
        | "version-mismatch"
        | "desktop-unavailable"
        | "not-authenticated"
        | "quota-exceeded"
        | "generation-failed"
        | "save-failed";
      message: string;
      retryable: boolean;
    };
