import { randomUUID } from "node:crypto";
import {
  NATIVE_PROTOCOL_VERSION,
  createLocalFindingDraft,
  parseNativeRequest,
  type AiFindingDraftV1,
  type AuditSummaryV1,
  type EvidencePacketV1,
  type NativeResponseV1,
} from "@accessibility-build/audit-contracts";
import type { AuditActivity, AuditProject, CaptureEntry, Finding } from "../../src/shared/desktop";
import type { AiAuthoringService } from "./ai-authoring";
import type { CaptureRepository } from "./captures";
import type { JsonStore } from "./store";

interface NativeProtocolServices {
  store: Pick<JsonStore, "get" | "set" | "addFindings" | "remove">;
  ai: Pick<AiAuthoringService, "generateFinding">;
  captures?: Pick<CaptureRepository, "create" | "delete">;
  appVersion: string;
}

function requestIdFrom(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return randomUUID();
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === "string" && requestId.length <= 64 ? requestId : randomUUID();
}

function errorResponse(
  requestId: string,
  code: Extract<NativeResponseV1, { ok: false }>["code"],
  message: string,
  retryable = false,
): NativeResponseV1 {
  return {
    protocolVersion: NATIVE_PROTOCOL_VERSION,
    requestId,
    ok: false,
    type: "error",
    code,
    message: message.slice(0, 500),
    retryable,
  };
}

function auditSummary(audit: AuditProject, activeId: string): AuditSummaryV1 {
  return {
    id: audit.id,
    project: audit.project.slice(0, 120),
    target: audit.target.slice(0, 2_000),
    standard: audit.standard,
    active: audit.id === activeId,
    updatedAt: audit.updatedAt,
  };
}

export function findingFromDraft(
  evidence: EvidencePacketV1,
  draft: AiFindingDraftV1,
  reviewState: Finding["reviewState"] = "reviewed",
): Finding {
  const now = Date.now();
  return {
    key: evidence.id,
    title: draft.title,
    wcag: draft.wcag.map((mapping) => mapping.criterion).join(", "),
    severity: draft.severity,
    status: "open",
    reviewState,
    note: draft.description,
    location: evidence.page.url || evidence.target.selector || evidence.target.structuralPath,
    createdAt: now,
    schemaVersion: 2,
    description: draft.description,
    actualResult: draft.actualResult,
    expectedResult: draft.expectedResult,
    userImpact: draft.userImpact,
    affectedUsers: draft.affectedUsers,
    severityRationale: draft.severityRationale,
    wcagMappings: draft.wcag,
    recommendation: draft.recommendation,
    exampleFix: draft.exampleFix,
    reproductionSteps: draft.reproductionSteps,
    evidenceId: evidence.id,
    source: draft.provenance.source,
    confidence: draft.confidence,
    fieldConfidence: draft.fieldConfidence,
    assumptions: draft.assumptions,
    manualChecks: draft.manualChecks,
    provenance: {
      model: draft.provenance.model,
      modelVersion: draft.provenance.modelVersion,
      promptVersion: draft.provenance.promptVersion,
      knowledgeVersion: draft.provenance.knowledgeVersion,
      generatedAt: draft.provenance.generatedAt,
    },
    modifiedAt: now,
    statusHistory: [{ status: "open", changedAt: now }],
  };
}

async function saveFinding(
  services: NativeProtocolServices,
  auditId: string,
  evidence: EvidencePacketV1,
  draft: AiFindingDraftV1,
  options: {
    reviewState?: Finding["reviewState"];
    activityTitle?: string;
  } = {},
): Promise<string> {
  const audits = await services.store.get<AuditProject[]>("audits-v2", []);
  const audit = audits.find((item) => item.id === auditId && !item.archivedAt);
  if (!audit) throw new Error("The selected audit is no longer available");
  const scopedEvidence = { ...evidence, auditId };
  const activityKey = `activity-${auditId}`;
  const [activity, existing] = await Promise.all([
    services.store.get<AuditActivity[]>(activityKey, []),
    services.store.get<Finding[]>(`findings-${auditId}`, []),
  ]);
  if (existing.some((item) => item.key === evidence.id)) return evidence.id;

  const evidenceKey = `evidence-${evidence.id}`;
  await services.store.set(evidenceKey, scopedEvidence);
  let capture: CaptureEntry | null = null;
  try {
    if (
      scopedEvidence.image?.mimeType === "image/png" &&
      services.captures
    ) {
      const target = scopedEvidence.target.accessibleName ||
        scopedEvidence.target.role ||
        scopedEvidence.target.tagName ||
        "selected component";
      capture = await services.captures.create(
        scopedEvidence.image.dataUrl,
        `Browser evidence · ${target}`,
        auditId,
      );
    }
    const baseFinding = findingFromDraft(scopedEvidence, draft, options.reviewState);
    const finding: Finding = capture
      ? {
          ...baseFinding,
          evidenceCaptureIds: [capture.id],
          captureId: capture.id,
        }
      : baseFinding;
    await services.store.addFindings([finding], auditId);
  } catch (error) {
    await Promise.all([
      services.store.remove(evidenceKey).catch(() => undefined),
      capture && services.captures
        ? services.captures.delete(capture.id).catch(() => undefined)
        : Promise.resolve(),
    ]);
    throw error;
  }
  await services.store.set(activityKey, [
      {
        id: randomUUID(),
        auditId,
        kind: "finding",
        title: options.activityTitle || "Browser evidence finding saved",
        detail: `${draft.title.slice(0, 160)}${draft.wcag.length ? `, ${draft.wcag.map((item) => item.criterion).join(", ")}` : ""}`,
        createdAt: Date.now(),
        url: evidence.page.url || undefined,
      },
      ...activity,
    ].slice(0, 120)).catch(() => undefined);
  return evidence.id;
}

export async function handleNativeRequest(
  value: unknown,
  services: NativeProtocolServices,
): Promise<NativeResponseV1> {
  const fallbackRequestId = requestIdFrom(value);
  let request;
  try {
    request = parseNativeRequest(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid desktop request";
    return errorResponse(
      fallbackRequestId,
      /version/i.test(message) ? "version-mismatch" : "invalid-request",
      message,
    );
  }

  if (request.type === "ping") {
    return {
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: request.requestId,
      ok: true,
      type: "pong",
      appVersion: services.appVersion,
    };
  }

  if (request.type === "audits:list") {
    const [audits, activeId] = await Promise.all([
      services.store.get<AuditProject[]>("audits-v2", []),
      services.store.get<string>("active-audit-v2", ""),
    ]);
    return {
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: request.requestId,
      ok: true,
      type: "audits:list",
      audits: audits.filter((audit) => !audit.archivedAt).slice(0, 100).map((audit) => auditSummary(audit, activeId)),
    };
  }

  if (request.type === "finding:generate") {
    try {
      const draft = await services.ai.generateFinding(request.evidence);
      return {
        protocolVersion: NATIVE_PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        type: "finding:generated",
        draft,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI authoring failed";
      if (/sign in|session expired/i.test(message)) {
        return errorResponse(request.requestId, "not-authenticated", message);
      }
      if (/limit|quota|later/i.test(message)) {
        return errorResponse(request.requestId, "quota-exceeded", message, true);
      }
      return errorResponse(request.requestId, "generation-failed", message, true);
    }
  }

  if (request.type === "finding:queue") {
    if (!request.evidence.consent) {
      return errorResponse(
        request.requestId,
        "invalid-request",
        "Review and approve the extension payload before sending it to the desktop.",
      );
    }
    if (request.evidence.observation.trim().length < 8) {
      return errorResponse(
        request.requestId,
        "invalid-request",
        "Describe the observed issue before sending it to the desktop.",
      );
    }
    let draft: AiFindingDraftV1;
    try {
      draft = await services.ai.generateFinding(request.evidence);
    } catch {
      draft = createLocalFindingDraft(request.evidence);
    }
    try {
      const findingKey = await saveFinding(
        services,
        request.auditId,
        request.evidence,
        draft,
        {
          reviewState: "pending",
          activityTitle: "Browser issue queued for review",
        },
      );
      return {
        protocolVersion: NATIVE_PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        type: "finding:queued",
        findingKey,
        draftSource: draft.provenance.source,
      };
    } catch (error) {
      return errorResponse(
        request.requestId,
        "save-failed",
        error instanceof Error ? error.message : "The issue could not be queued for review",
        true,
      );
    }
  }

  try {
    const findingKey = await saveFinding(services, request.auditId, request.evidence, request.draft);
    return {
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: request.requestId,
      ok: true,
      type: "finding:saved",
      findingKey,
    };
  } catch (error) {
    return errorResponse(
      request.requestId,
      "save-failed",
      error instanceof Error ? error.message : "The finding could not be saved",
      true,
    );
  }
}
