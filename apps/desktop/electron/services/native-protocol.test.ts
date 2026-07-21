import { describe, expect, it, vi } from "vitest";
import {
  AI_DRAFT_SCHEMA_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  NATIVE_PROTOCOL_VERSION,
  type AiFindingDraftV1,
  type EvidencePacketV1,
} from "@accessibility-build/audit-contracts";
import { findingFromDraft, handleNativeRequest } from "./native-protocol";

function evidence(): EvidencePacketV1 {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: "3c977290-cb66-4bbd-a68b-72b770828b39",
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

  it("treats a repeated evidence save as idempotent", async () => {
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
      if (key === "findings-aud-checkout1") return [{ key: evidence().id }] as T;
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
      findingKey: evidence().id,
    }));
    expect(addFindings).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});
