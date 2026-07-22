import { describe, expect, it } from "vitest";
import {
  AI_DRAFT_SCHEMA_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  NATIVE_PROTOCOL_VERSION,
  createLocalFindingDraft,
  parseAiFindingDraft,
  parseEvidencePacket,
  parseNativeRequest,
  type AiFindingDraftV1,
  type EvidencePacketV1,
} from "./index";

function evidence(): EvidencePacketV1 {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: "3c977290-cb66-4bbd-a68b-72b770828b39",
    auditId: "aud-checkout1",
    capturedAt: 1_800_000_000_000,
    captureMode: "element",
    observation: "The control is announced without a name.",
    taskContext: "Complete checkout",
    page: {
      title: "Checkout",
      url: "https://example.com/checkout",
      origin: "https://example.com",
      locale: "en-US",
      browser: "Chrome",
      viewport: {
        width: 1280,
        height: 800,
        devicePixelRatio: 2,
        visualScale: 1,
        offsetLeft: 0,
        offsetTop: 0,
      },
    },
    target: {
      kind: "element",
      tagName: "button",
      role: "button",
      accessibleName: "",
      accessibleDescription: "",
      selector: "button.checkout",
      structuralPath: "html > body > main > button:nth-of-type(1)",
      bounds: { x: 100, y: 200, width: 180, height: 44 },
      marker: { x: 92, y: 192, width: 196, height: 60 },
      states: ["focusable"],
      labels: [],
      nearbyHeading: "Payment",
      landmark: "main",
      attributes: { class: "checkout", type: "button" },
      styles: { display: "inline-flex" },
      domExcerpt: "<button class=\"checkout\" type=\"button\"></button>",
    },
    checks: [{
      id: "accessible-name",
      outcome: "fail",
      title: "Interactive control has no accessible name",
      description: "The selected button has no accessible name.",
      wcag: ["4.1.2"],
      impact: "major",
    }],
    omissions: ["Form values were removed"],
  };
}

function draft(): AiFindingDraftV1 {
  return {
    schemaVersion: AI_DRAFT_SCHEMA_VERSION,
    title: "Checkout button has no accessible name",
    description: "The checkout control is exposed without a name.",
    actualResult: "A screen reader announces only button.",
    expectedResult: "The button should expose a descriptive accessible name.",
    userImpact: "Screen reader users cannot identify the checkout action.",
    affectedUsers: ["screen-reader", "voice-control"],
    severity: "major",
    severityRationale: "The control is required to complete checkout.",
    wcag: [{
      criterion: "4.1.2",
      level: "A",
      name: "Name, Role, Value",
      rationale: "The interactive control has no programmatic name.",
      confidence: "high",
    }],
    recommendation: "Provide visible text or an equivalent accessible name.",
    exampleFix: "<button type=\"button\">Complete checkout</button>",
    reproductionSteps: ["Open checkout.", "Inspect the checkout button with a screen reader."],
    confidence: "high",
    fieldConfidence: [{ field: "wcag", confidence: "high", reason: "Confirmed by deterministic evidence." }],
    assumptions: [],
    manualChecks: ["Confirm the final name in the browser accessibility tree."],
    provenance: {
      source: "local",
      model: "deterministic",
      modelVersion: "1",
      promptVersion: "local-v1",
      knowledgeVersion: "wcag-2.2",
      generatedAt: 1_800_000_000_100,
    },
  };
}

describe("audit contracts", () => {
  it("accepts bounded evidence and strips unknown fields", () => {
    const parsed = parseEvidencePacket({ ...evidence(), ignored: "value" });
    expect(parsed.id).toBe(evidence().id);
    expect("ignored" in parsed).toBe(false);
  });

  it("rejects sensitive mismatched image payloads", () => {
    const value = evidence();
    value.image = {
      mimeType: "image/png",
      dataUrl: "data:image/jpeg;base64,AAAA",
      width: 10,
      height: 10,
      sourceWidth: 10,
      sourceHeight: 10,
    };
    expect(() => parseEvidencePacket(value)).toThrow(/does not match MIME type/);
  });

  it("rejects an invalid WCAG mapping", () => {
    const value = draft();
    value.wcag[0].criterion = "9.9.9";
    expect(() => parseAiFindingDraft(value)).toThrow(/unsupported WCAG/);
  });

  it("normalizes WCAG names and levels to the official catalog", () => {
    const value = draft();
    value.wcag[0].name = "Invented name";
    value.wcag[0].level = "AA";
    const parsed = parseAiFindingDraft(value);
    expect(parsed.wcag[0]).toMatchObject({ name: "Name, Role, Value", level: "A" });
  });

  it("requires affected users, reproduction steps, and manual checks", () => {
    expect(() => parseAiFindingDraft({ ...draft(), affectedUsers: [] })).toThrow(/affected-user/);
    expect(() => parseAiFindingDraft({ ...draft(), reproductionSteps: [] })).toThrow(/at least one step/);
    expect(() => parseAiFindingDraft({ ...draft(), manualChecks: [] })).toThrow(/manual check/);
  });

  it("parses a native save request recursively", () => {
    const parsed = parseNativeRequest({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: "e1f6ebf8-8f42-4373-a3d2-3ea5b64f0ac7",
      type: "finding:save",
      auditId: "aud-checkout1",
      evidence: evidence(),
      draft: draft(),
    });
    expect(parsed.type).toBe("finding:save");
  });

  it("parses a bounded browser intake request and strips non-contract fields", () => {
    const parsed = parseNativeRequest({
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      requestId: "e1f6ebf8-8f42-4373-a3d2-3ea5b64f0ac7",
      type: "finding:queue",
      auditId: "aud-checkout1",
      evidence: { ...evidence(), ignoredAuditContent: "must not cross the boundary" },
      unexpected: "discarded",
    });
    expect(parsed).toMatchObject({ type: "finding:queue", auditId: "aud-checkout1" });
    if (parsed.type === "finding:queue") {
      expect("unexpected" in parsed).toBe(false);
      expect("ignoredAuditContent" in parsed.evidence).toBe(false);
    }
  });

  it("creates an explicitly unconfirmed local review draft from captured evidence", () => {
    const packet = evidence();
    packet.checks[0].id = "interactive-name";
    const local = createLocalFindingDraft(packet, 1_800_000_000_500);
    expect(local).toMatchObject({
      severity: "major",
      provenance: { source: "local", generatedAt: 1_800_000_000_500 },
    });
    expect(local.wcag).toEqual([
      expect.objectContaining({ criterion: "4.1.2", name: "Name, Role, Value", level: "A" }),
    ]);
    expect(local.affectedUsers).toEqual(expect.arrayContaining(["screen-reader", "voice-control"]));
    expect(local.manualChecks.join(" ")).toMatch(/confirm.*WCAG mapping.*severity/i);
  });
});
