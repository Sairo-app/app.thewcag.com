import { describe, expect, it } from "vitest";
import { EVIDENCE_SCHEMA_VERSION, type EvidencePacketV1, type EvidenceTargetV1 } from "@accessibility-build/audit-contracts";
import { applyConsent, calculateCropGeometry, createLocalDraft, runDeterministicChecks } from "./evidence";

function target(patch: Partial<EvidenceTargetV1> = {}): EvidenceTargetV1 {
  return {
    kind: "element",
    tagName: "button",
    role: "button",
    accessibleName: "",
    accessibleDescription: "",
    selector: "button:nth-of-type(1)",
    structuralPath: "html > body > button",
    bounds: { x: 100, y: 200, width: 120, height: 40 },
    marker: { x: 100, y: 200, width: 120, height: 40 },
    states: ["focusable"],
    labels: [],
    nearbyHeading: "Checkout",
    landmark: "main",
    attributes: { type: "button" },
    styles: { display: "inline-flex" },
    domExcerpt: "<button type=\"button\"></button>",
    ...patch,
  };
}

describe("evidence capture", () => {
  it("keeps a high-DPI contextual frame around a small target", () => {
    const crop = calculateCropGeometry(
      { x: 10, y: 20, width: 100, height: 40 },
      { width: 1280, height: 720, devicePixelRatio: 2, visualScale: 1, offsetLeft: 0, offsetTop: 0 },
      2560,
      1440,
    );
    expect(crop.source).toEqual({ x: 0, y: 0, width: 1920, height: 1037 });
    expect(crop.marker).toEqual({ x: 20, y: 40, width: 200, height: 80 });
    expect(crop.outputWidth).toBeGreaterThan(crop.marker.width * 5);
    expect(crop.outputHeight).toBeGreaterThan(crop.marker.height * 5);
  });

  it("centers a target when enough context exists on every side", () => {
    const crop = calculateCropGeometry(
      { x: 600, y: 340, width: 80, height: 40 },
      { width: 1280, height: 720, devicePixelRatio: 2, visualScale: 1, offsetLeft: 0, offsetTop: 0 },
      2560,
      1440,
    );
    expect(crop.source.x).toBe(320);
    expect(crop.source.y).toBe(201);
    expect(crop.marker.x).toBe(880);
    expect(crop.marker.y).toBe(479);
  });

  it("keeps an offscreen target marker inside the captured image", () => {
    const crop = calculateCropGeometry(
      { x: 1_400, y: 800, width: 80, height: 40 },
      { width: 1280, height: 720, devicePixelRatio: 2, visualScale: 1, offsetLeft: 0, offsetTop: 0 },
      2560,
      1440,
    );
    expect(crop.marker.x).toBeGreaterThanOrEqual(0);
    expect(crop.marker.y).toBeGreaterThanOrEqual(0);
    expect(crop.marker.x + crop.marker.width).toBeLessThanOrEqual(crop.outputWidth);
    expect(crop.marker.y + crop.marker.height).toBeLessThanOrEqual(crop.outputHeight);
  });

  it("detects a missing interactive name", () => {
    const checks = runDeterministicChecks(target());
    expect(checks).toContainEqual(expect.objectContaining({ id: "interactive-name", outcome: "fail", wcag: ["4.1.2"] }));
  });

  it("does not claim an unnamed image is definitely a failure", () => {
    const checks = runDeterministicChecks(target({ tagName: "img", role: "img", states: [] }));
    expect(checks).toContainEqual(expect.objectContaining({ id: "image-alternative", outcome: "needs-review" }));
  });

  it("creates a structured local draft without asserting final severity", () => {
    const selected = target();
    const checks = runDeterministicChecks(selected);
    const evidence: EvidencePacketV1 = {
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      id: "fc926f9f-e1bf-4590-ad71-a22ebca60dcc",
      findingId: "WCG-F-20260722-00000-00000-00000-00000-000000",
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
      target: selected,
      checks,
      omissions: [],
    };
    const draft = createLocalDraft(evidence);
    expect(draft.title).toMatch(/accessible name/i);
    expect(draft.wcag[0].criterion).toBe("4.1.2");
    expect(draft.fieldConfidence).toContainEqual(expect.objectContaining({ field: "severity", confidence: "low" }));
  });

  it("removes every withheld payload section before generation", () => {
    const evidence: EvidencePacketV1 = {
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      id: "fc926f9f-e1bf-4590-ad71-a22ebca60dcc",
      findingId: "WCG-F-20260722-00000-00000-00000-00000-000001",
      capturedAt: 1_800_000_000_000,
      captureMode: "element",
      observation: "The checkout button is announced only as button.",
      taskContext: "Complete checkout",
      page: {
        title: "Khushwant's checkout",
        url: "https://example.com/checkout",
        origin: "https://example.com",
        locale: "en",
        browser: "Chrome",
        viewport: { width: 1280, height: 720, devicePixelRatio: 2, visualScale: 1, offsetLeft: 0, offsetTop: 0 },
      },
      target: target({
        accessibleName: "Pay for Khushwant",
        selector: "#customer-khushwant",
        attributes: { id: "customer-khushwant", "aria-label": "Pay for Khushwant" },
      }),
      image: {
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AAAA",
        width: 10,
        height: 10,
        sourceWidth: 10,
        sourceHeight: 10,
      },
      checks: [],
      omissions: [],
    };
    const approved = applyConsent(evidence, {
      includeScreenshot: false,
      includeElementText: false,
      includeUrl: false,
    });
    expect(approved.image).toBeUndefined();
    expect(approved.page).toMatchObject({ title: "", url: "", origin: "" });
    expect(approved.target).toMatchObject({
      accessibleName: "",
      selector: "",
      structuralPath: "",
      attributes: {},
      domExcerpt: "",
    });
    expect(approved.omissions).toHaveLength(3);
  });
});
