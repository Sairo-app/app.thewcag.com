import { describe, expect, it, vi } from "vitest";
import {
  AI_DRAFT_SCHEMA_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  NATIVE_PROTOCOL_VERSION,
  type AiFindingDraftV1,
  type EvidencePacketV1,
} from "@accessibility-build/audit-contracts";
import { findingFromDraft, handleNativeRequest } from "./native-protocol";
import { ManagedAiHttpError } from "./managed-ai-error";

function evidence(): EvidencePacketV1 {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: "3c977290-cb66-4bbd-a68b-72b770828b39",
    findingId: "WCG-F-20260722-00000-00000-00000-00000-000003",
    auditId: "aud-checkout1",
    capturedAt: 1_800_000_000_000,
    captureMode: "element",
    observation: "The button is announced only as button.",
    taskContext: "Checkout",
    page: {
      title: "Checkout",
      url: "https://example.com/checkout",
      origin: "https://example.com",
      locale: "en",
      browser: "Chrome",
      viewport: { width: 1280, height: 720, devicePixelRatio: 2, visualScale: 1, offsetLeft: 0, offsetTop: 0 },
    },
    target: {
      kind: "element",
      tagName: "button",
      role: "button",
      accessibleName: "",
      accessibleDescription: "",
      selector: "button",
      structuralPath: "html > body > button",
      bounds: { x: 10, y: 10, width: 100, height: 40 },
      marker: { x: 10, y: 10, width: 100, height: 40 },
      states: ["focusable"],
      labels: [],
      nearbyHeading: "Payment",
      landmark: "main",
      attributes: { type: "button" },
      styles: { display: "block" },
      domExcerpt: "<button type=\"button\"></button>",
    },
    checks: [],
    omissions: [],
    consent: { approvedAt: 1_800_000_000_100, includeScreenshot: false, includeElementText: true, includeUrl: true },
  };
}

function draft(): AiFindingDraftV1 {
  return {
    schemaVersion: AI_DRAFT_SCHEMA_VERSION,
    title: "Button has no accessible name",
    description: "The checkout button has no accessible name.",
    actualResult: "A screen reader announces button.",
    expectedResult: "The button exposes a descriptive name.",
    userImpact: "Screen reader users cannot identify the action.",
    affectedUsers: ["screen-reader"],
    severity: "major",
    severityRationale: "Checkout is important, but blocking impact requires confirmation.",
    wcag: [{ criterion: "4.1.2", level: "A", name: "Name, Role, Value", rationale: "No name is exposed.", confidence: "high" }],
    recommendation: "Give the button visible text.",
    exampleFix: "<button>Complete checkout</button>",
    reproductionSteps: ["Open checkout.", "Inspect the button."],
    confidence: "high",
    fieldConfidence: [],
    assumptions: [],
    manualChecks: ["Confirm the accessibility tree."],
    provenance: {
      source: "ai",
      model: "openai",
      modelVersion: "test",
      promptVersion: "test",
      knowledgeVersion: "wcag-2.2",
      generatedAt: 1_800_000_000_200,
    },
  };
}

describe("native extension protocol", () => {
  it("preserves structured fields when converting a draft", () => {
    const finding = findingFromDraft(evidence(), draft());
    expect(finding.schemaVersion).toBe(2);
    expect(finding.id).toBe(evidence().findingId);
    expect(finding.actualResult).toMatch(/screen reader/i);
    expect(finding.wcagMappings?.[0].criterion).toBe("4.1.2");
  });

  it("returns bounded active audit summaries", async () => {
    const get = async <T,>(key: string, fallback: T): Promise<T> => {
      if (key === "audits-v2") return [{
        id: "aud-checkout1",
        project: "Checkout",
        target: "example.com",
        scope: "Checkout",
        standard: "WCAG 2.2 AA",
        auditor: "Auditor",
        startedAt: "2026-07-21",
        updatedAt: 10,
        createdAt: 1,
      }] as T;
      if (key === "active-audit-v2") return "aud-checkout1" as T;
      return fallback;
    };
    const response = await handleNativeRequest({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: "e1f6ebf8-8f42-4373-a3d2-3ea5b64f0ac7",
      type: "audits:list",
    }, {
      store: { get, set: vi.fn(), addFindings: vi.fn(), remove: vi.fn() },
      ai: { generateFinding: vi.fn() },
      appVersion: "3.0.0",
    });
    expect(response).toEqual(expect.objectContaining({ ok: true, type: "audits:list" }));
    if (response.ok && response.type === "audits:list") expect(response.audits[0].active).toBe(true);
  });

  it("rejects malformed messages without invoking privileged services", async () => {
    const generateFinding = vi.fn();
    const response = await handleNativeRequest({ type: "finding:generate" }, {
      store: { get: vi.fn(), set: vi.fn(), addFindings: vi.fn(), remove: vi.fn() },
      ai: { generateFinding },
      appVersion: "3.0.0",
    });
    expect(response).toEqual(expect.objectContaining({ ok: false, code: "version-mismatch" }));
    expect(generateFinding).not.toHaveBeenCalled();
  });

  it.each([
    [402, "quota-exceeded", false],
    [429, "quota-exceeded", true],
    [503, "generation-failed", true],
  ] as const)("maps managed AI HTTP %i without message guessing", async (status, code, retryable) => {
    const message = status === 402 ? "Managed AI authoring requires Pro." : `Managed AI failed with ${status}.`;
    const response = await handleNativeRequest({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: "e1f6ebf8-8f42-4373-a3d2-3ea5b64f0ac7",
      type: "finding:generate",
      evidence: evidence(),
    }, {
      store: { get: vi.fn(), set: vi.fn(), addFindings: vi.fn(), remove: vi.fn() },
      ai: {
        generateFinding: vi.fn().mockRejectedValue(
          new ManagedAiHttpError(status, message),
        ),
      },
      appVersion: "3.0.0",
    });

    expect(response).toEqual(expect.objectContaining({
      ok: false,
      code,
      message,
      retryable,
    }));
  });

  it("treats the immutable finding ID as an idempotency key", async () => {
    const addFindings = vi.fn();
    const set = vi.fn();
    const get = async <T,>(key: string, fallback: T): Promise<T> => {
      if (key === "audits-v2") return [{
        id: "aud-checkout1",
        project: "Checkout",
        target: "example.com",
        scope: "Checkout",
        standard: "WCAG 2.2 AA",
        auditor: "Auditor",
        startedAt: "2026-07-21",
        updatedAt: 10,
        createdAt: 1,
      }] as T;
      if (key === "findings-aud-checkout1") return [{
        id: evidence().findingId,
        key: "existing-finding-key",
      }] as T;
      return fallback;
    };
    const response = await handleNativeRequest({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: "e1f6ebf8-8f42-4373-a3d2-3ea5b64f0ac7",
      type: "finding:save",
      auditId: "aud-checkout1",
      evidence: evidence(),
      draft: draft(),
    }, {
      store: { get, set, addFindings, remove: vi.fn() },
      ai: { generateFinding: vi.fn() },
      appVersion: "3.0.0",
    });
    expect(response).toEqual(expect.objectContaining({
      ok: true,
      type: "finding:saved",
      findingKey: "existing-finding-key",
    }));
    expect(addFindings).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("queues browser evidence as a pending finding without applying an auditor decision", async () => {
    const addFindings = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockResolvedValue(undefined);
    const get = async <T,>(key: string, fallback: T): Promise<T> => {
      if (key === "audits-v2") return [{
        id: "aud-checkout1",
        project: "Checkout",
        target: "example.com",
        scope: "Checkout",
        standard: "WCAG 2.2 AA",
        auditor: "Auditor",
        startedAt: "2026-07-21",
        updatedAt: 10,
        createdAt: 1,
      }] as T;
      return fallback;
    };
    const packet = evidence();
    packet.image = {
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      width: 320,
      height: 180,
      sourceWidth: 640,
      sourceHeight: 360,
    };
    const createCapture = vi.fn().mockResolvedValue({
      id: "cap-browser-12345678",
      auditId: "aud-checkout1",
      title: "Browser evidence · button",
      createdAt: 1,
      modifiedAt: 1,
      issues: 0,
      width: 320,
      height: 180,
      assetUrl: "thewcag-asset://capture/cap-browser-12345678?kind=raw",
      thumbnailUrl: null,
    });
    const response = await handleNativeRequest({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: "e1f6ebf8-8f42-4373-a3d2-3ea5b64f0ac7",
      type: "finding:queue",
      auditId: "aud-checkout1",
      evidence: packet,
    }, {
      store: { get, set, addFindings, remove: vi.fn() },
      ai: { generateFinding: vi.fn().mockResolvedValue(draft()) },
      captures: { create: createCapture, delete: vi.fn() },
      appVersion: "3.0.0",
    });

    expect(response).toEqual(expect.objectContaining({
      ok: true,
      type: "finding:queued",
      findingKey: evidence().id,
      draftSource: "ai",
    }));
    expect(addFindings).toHaveBeenCalledWith([
      expect.objectContaining({
        key: evidence().id,
        reviewState: "pending",
        status: "open",
        location: "https://example.com/checkout",
        evidenceId: evidence().id,
        evidenceCaptureIds: ["cap-browser-12345678"],
        captureId: "cap-browser-12345678",
      }),
    ], "aud-checkout1");
    expect(set).toHaveBeenCalledWith(`evidence-${evidence().id}`, expect.objectContaining({
      auditId: "aud-checkout1",
      observation: evidence().observation,
    }));
    expect(createCapture).toHaveBeenCalledWith(
      packet.image.dataUrl,
      "Browser evidence · button",
      "aud-checkout1",
    );
  });

  it("falls back to a bounded local draft when managed authoring is unavailable", async () => {
    const addFindings = vi.fn().mockResolvedValue(undefined);
    const get = async <T,>(key: string, fallback: T): Promise<T> => {
      if (key === "audits-v2") return [{
        id: "aud-checkout1",
        project: "Checkout",
        target: "example.com",
        scope: "Checkout",
        standard: "WCAG 2.2 AA",
        auditor: "Auditor",
        startedAt: "2026-07-21",
        updatedAt: 10,
        createdAt: 1,
      }] as T;
      return fallback;
    };
    const packet = evidence();
    packet.checks = [{
      id: "interactive-name",
      outcome: "fail",
      title: "Interactive control has no accessible name",
      description: "The selected button has no accessible name.",
      wcag: ["4.1.2"],
      impact: "major",
    }];
    const response = await handleNativeRequest({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: "e1f6ebf8-8f42-4373-a3d2-3ea5b64f0ac7",
      type: "finding:queue",
      auditId: "aud-checkout1",
      evidence: packet,
    }, {
      store: {
        get,
        set: vi.fn().mockResolvedValue(undefined),
        addFindings,
        remove: vi.fn().mockResolvedValue(undefined),
      },
      ai: { generateFinding: vi.fn().mockRejectedValue(new Error("No provider configured")) },
      appVersion: "3.0.0",
    });

    expect(response).toEqual(expect.objectContaining({
      ok: true,
      type: "finding:queued",
      draftSource: "local",
    }));
    expect(addFindings).toHaveBeenCalledWith([
      expect.objectContaining({
        reviewState: "pending",
        wcag: "4.1.2",
        affectedUsers: expect.arrayContaining(["screen-reader", "voice-control"]),
      }),
    ], "aud-checkout1");
  });

  it("rejects an unapproved browser payload before privileged work", async () => {
    const packet = evidence();
    delete packet.consent;
    const generateFinding = vi.fn();
    const addFindings = vi.fn();
    const response = await handleNativeRequest({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: "e1f6ebf8-8f42-4373-a3d2-3ea5b64f0ac7",
      type: "finding:queue",
      auditId: "aud-checkout1",
      evidence: packet,
    }, {
      store: { get: vi.fn(), set: vi.fn(), addFindings, remove: vi.fn() },
      ai: { generateFinding },
      appVersion: "3.0.0",
    });

    expect(response).toEqual(expect.objectContaining({ ok: false, code: "invalid-request" }));
    expect(generateFinding).not.toHaveBeenCalled();
    expect(addFindings).not.toHaveBeenCalled();
  });
});
