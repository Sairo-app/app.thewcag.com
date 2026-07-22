import { describe, expect, it, vi } from "vitest";
import {
  AI_DRAFT_SCHEMA_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  type EvidencePacketV1,
} from "@accessibility-build/audit-contracts";
import {
  buildOpenAiFindingRequest,
  generateAiFinding,
  safetyIdentifier,
} from "./ai-finding";

function evidence(includeImage = false): EvidencePacketV1 {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: "3c977290-cb66-4bbd-a68b-72b770828b39",
    findingId: "WCG-F-20260722-00000-00000-00000-00000-000004",
    capturedAt: 1_800_000_000_000,
    captureMode: "element",
    observation: "The checkout button is announced only as button.",
    taskContext: "Complete checkout",
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
      selector: "button.checkout",
      structuralPath: "html > body > button",
      bounds: { x: 100, y: 200, width: 180, height: 44 },
      marker: { x: 100, y: 200, width: 180, height: 44 },
      states: ["focusable"],
      labels: [],
      nearbyHeading: "Payment",
      landmark: "main",
      attributes: { type: "button" },
      styles: { display: "inline-flex" },
      domExcerpt: "<button type=\"button\"></button>",
    },
    image: includeImage ? {
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      width: 180,
      height: 44,
      sourceWidth: 2560,
      sourceHeight: 1440,
    } : undefined,
    checks: [{
      id: "interactive-name",
      outcome: "fail",
      title: "Interactive control has no accessible name",
      description: "The selected button has no accessible name.",
      wcag: ["4.1.2"],
      impact: "major",
    }],
    omissions: [],
    consent: { approvedAt: 1_800_000_000_100, includeScreenshot: includeImage, includeElementText: true, includeUrl: true },
  };
}

const providerFinding = {
  title: "Checkout button has no accessible name",
  description: "The checkout control is exposed without an accessible name.",
  actualResult: "A screen reader announces only button.",
  expectedResult: "The control exposes a descriptive name.",
  userImpact: "Screen reader and voice-control users cannot identify the action.",
  affectedUsers: ["screen-reader", "voice-control"],
  severity: "major",
  severityRationale: "The control is required for checkout, but task blocking needs confirmation.",
  wcag: [{ criterion: "4.1.2", level: "AA", name: "Wrong model name", rationale: "The control has no name.", confidence: "high" }],
  recommendation: "Give the native button visible descriptive text.",
  exampleFix: "<button>Complete checkout</button>",
  reproductionSteps: ["Open checkout.", "Inspect the button with a screen reader."],
  confidence: "high",
  fieldConfidence: [{ field: "severity", confidence: "low", reason: "Task impact needs confirmation." }],
  assumptions: [],
  manualChecks: ["Confirm the computed accessible name."],
};

describe("AI finding provider", () => {
  it("uses a non-stored strict structured request and includes only consented images", () => {
    const withoutImage = buildOpenAiFindingRequest(evidence(false), "safe-id");
    expect(withoutImage.store).toBe(false);
    expect(withoutImage.text.format.strict).toBe(true);
    expect(withoutImage.input[0].content).toHaveLength(1);

    const withImage = buildOpenAiFindingRequest(evidence(true), "safe-id");
    expect(withImage.input[0].content).toContainEqual(expect.objectContaining({ type: "input_image" }));
  });

  it("omits the page address and element text when the auditor withholds them", () => {
    const withheld = evidence(false);
    withheld.page.url = "https://private.example/customer/42";
    withheld.target.accessibleName = "Private customer action";
    withheld.target.domExcerpt = "<button>Private customer action</button>";
    withheld.consent = {
      ...withheld.consent!,
      includeUrl: false,
      includeElementText: false,
    };
    const request = buildOpenAiFindingRequest(withheld, "safe-id");
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain("private.example");
    expect(serialized).not.toContain("Private customer action");
    expect(serialized).toContain("Withheld by auditor");
  });

  it("normalizes model WCAG names and levels against the versioned catalog", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(providerFinding) }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const draft = await generateAiFinding(evidence(), {
      apiKey: "test-key",
      safetyIdentifier: "safe-id",
      fetchImpl,
    });
    expect(draft.schemaVersion).toBe(AI_DRAFT_SCHEMA_VERSION);
    expect(draft.wcag[0]).toEqual(expect.objectContaining({ level: "A", name: "Name, Role, Value" }));
    expect(draft.provenance.source).toBe("ai");
  });

  it("rejects provider refusals without creating a partial draft", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      output: [{ type: "message", content: [{ type: "refusal", refusal: "Unable" }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    await expect(generateAiFinding(evidence(), {
      apiKey: "test-key",
      safetyIdentifier: "safe-id",
      fetchImpl,
    })).rejects.toThrow(/declined/);
  });

  it("creates a stable privacy-preserving safety identifier", () => {
    expect(safetyIdentifier("user-1", "salt")).toBe(safetyIdentifier("user-1", "salt"));
    expect(safetyIdentifier("user-1", "salt")).not.toBe(safetyIdentifier("user-2", "salt"));
  });
});
