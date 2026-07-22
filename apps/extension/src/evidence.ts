import {
  AI_DRAFT_SCHEMA_VERSION,
  compactFindingId,
  createFindingId,
  EVIDENCE_SCHEMA_VERSION,
  parseAiFindingDraft,
  parseEvidencePacket,
  type AffectedUser,
  type AiFindingDraftV1,
  type DeterministicCheckV1,
  type EvidenceConsentV1,
  type EvidenceImageV1,
  type EvidencePacketV1,
  type EvidenceRect,
  type EvidenceTargetV1,
  type FindingSeverity,
  type WcagMappingV1,
} from "@accessibility-build/audit-contracts";
import type { CapturedSelection } from "./shared/messages";

export interface CropGeometry {
  source: EvidenceRect;
  marker: EvidenceRect;
  outputWidth: number;
  outputHeight: number;
  scale: number;
}

const WCAG_DETAILS: Record<string, { name: string; level: "A" | "AA" }> = {
  "1.1.1": { name: "Non-text Content", level: "A" },
  "2.1.1": { name: "Keyboard", level: "A" },
  "2.4.3": { name: "Focus Order", level: "A" },
  "2.5.8": { name: "Target Size (Minimum)", level: "AA" },
  "4.1.2": { name: "Name, Role, Value", level: "A" },
};

export function calculateCropGeometry(
  bounds: EvidenceRect,
  viewport: CapturedSelection["page"]["viewport"],
  sourceWidth: number,
  sourceHeight: number,
  paddingCss = 64,
  maxOutputDimension = 2_400,
): CropGeometry {
  const viewportWidth = Math.max(1, viewport.width);
  const viewportHeight = Math.max(1, viewport.height);
  const scaleX = sourceWidth / viewportWidth;
  const scaleY = sourceHeight / viewportHeight;
  const rawTargetX = bounds.x - viewport.offsetLeft;
  const rawTargetY = bounds.y - viewport.offsetTop;
  const targetX = Math.max(0, Math.min(viewportWidth - 1, rawTargetX));
  const targetY = Math.max(0, Math.min(viewportHeight - 1, rawTargetY));
  const targetRight = Math.max(
    targetX + 1,
    Math.min(viewportWidth, rawTargetX + bounds.width),
  );
  const targetBottom = Math.max(
    targetY + 1,
    Math.min(viewportHeight, rawTargetY + bounds.height),
  );
  const targetWidth = Math.max(1, targetRight - targetX);
  const targetHeight = Math.max(1, targetBottom - targetY);

  // Keep enough surrounding interface to explain where the issue occurs. A
  // tiny control should never become an element-only screenshot, while a
  // deliberately selected large region should still fit without distortion.
  const contextWidth = Math.min(
    viewportWidth,
    Math.max(
      targetWidth + paddingCss * 2,
      Math.min(960, viewportWidth * 0.78),
    ),
  );
  const contextHeight = Math.min(
    viewportHeight,
    Math.max(
      targetHeight + paddingCss * 2,
      Math.min(640, viewportHeight * 0.72),
    ),
  );
  const cssX = Math.max(
    0,
    Math.min(
      viewportWidth - contextWidth,
      targetX + targetWidth / 2 - contextWidth / 2,
    ),
  );
  const cssY = Math.max(
    0,
    Math.min(
      viewportHeight - contextHeight,
      targetY + targetHeight / 2 - contextHeight / 2,
    ),
  );
  const cssRight = cssX + contextWidth;
  const cssBottom = cssY + contextHeight;
  const source: EvidenceRect = {
    x: Math.max(0, Math.floor(cssX * scaleX)),
    y: Math.max(0, Math.floor(cssY * scaleY)),
    width: Math.max(1, Math.ceil((cssRight - cssX) * scaleX)),
    height: Math.max(1, Math.ceil((cssBottom - cssY) * scaleY)),
  };
  source.width = Math.min(source.width, sourceWidth - source.x);
  source.height = Math.min(source.height, sourceHeight - source.y);

  const outputScale = Math.min(1, maxOutputDimension / Math.max(source.width, source.height));
  const outputWidth = Math.max(1, Math.round(source.width * outputScale));
  const outputHeight = Math.max(1, Math.round(source.height * outputScale));
  const marker = {
    x: Math.max(0, (targetX * scaleX - source.x) * outputScale),
    y: Math.max(0, (targetY * scaleY - source.y) * outputScale),
    width: Math.max(1, targetWidth * scaleX * outputScale),
    height: Math.max(1, targetHeight * scaleY * outputScale),
  };
  marker.width = Math.min(marker.width, outputWidth - marker.x);
  marker.height = Math.min(marker.height, outputHeight - marker.y);
  return { source, marker, outputWidth, outputHeight, scale: outputScale };
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

async function loadImage(dataUrl: string): Promise<LoadedImage> {
  if (typeof document === "undefined") {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error("The captured screenshot could not be read.");
    const bitmap = await createImageBitmap(await response.blob());
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
    image.onerror = () => reject(new Error("The captured screenshot could not be read."));
    image.src = dataUrl;
  });
}

async function blobDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function canvasDataUrl(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mimeType: EvidenceImageV1["mimeType"],
  quality?: number,
): Promise<string> {
  if ("toDataURL" in canvas) {
    return canvas.toDataURL(mimeType, quality);
  }
  return blobDataUrl(await canvas.convertToBlob({ type: mimeType, quality }));
}

export async function createMarkedCrop(
  screenshotDataUrl: string,
  selection: CapturedSelection,
): Promise<EvidenceImageV1> {
  const sourceImage = await loadImage(screenshotDataUrl);
  const geometry = calculateCropGeometry(
    selection.target.bounds,
    selection.page.viewport,
    sourceImage.width,
    sourceImage.height,
  );
  const canvas = typeof document === "undefined"
    ? new OffscreenCanvas(geometry.outputWidth, geometry.outputHeight)
    : document.createElement("canvas");
  canvas.width = geometry.outputWidth;
  canvas.height = geometry.outputHeight;
  const context = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) {
    sourceImage.close?.();
    throw new Error("Screenshot processing is unavailable.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    sourceImage.source,
    geometry.source.x,
    geometry.source.y,
    geometry.source.width,
    geometry.source.height,
    0,
    0,
    geometry.outputWidth,
    geometry.outputHeight,
  );

  const line = Math.max(4, Math.min(10, geometry.outputWidth / 140));
  const markerX = Math.max(0, geometry.marker.x);
  const markerY = Math.max(0, geometry.marker.y);
  const markerWidth = Math.max(1, geometry.marker.width);
  const markerHeight = Math.max(1, geometry.marker.height);
  context.save();

  // A light outside veil preserves the page context while keeping attention
  // on the exact control or region the auditor selected.
  context.fillStyle = "rgba(31, 41, 51, 0.1)";
  context.fillRect(0, 0, geometry.outputWidth, markerY);
  context.fillRect(
    0,
    markerY + markerHeight,
    geometry.outputWidth,
    Math.max(0, geometry.outputHeight - markerY - markerHeight),
  );
  context.fillRect(0, markerY, markerX, markerHeight);
  context.fillRect(
    markerX + markerWidth,
    markerY,
    Math.max(0, geometry.outputWidth - markerX - markerWidth),
    markerHeight,
  );

  context.beginPath();
  context.roundRect(
    markerX + line / 2,
    markerY + line / 2,
    Math.max(1, markerWidth - line),
    Math.max(1, markerHeight - line),
    Math.min(12, Math.max(4, line * 1.6)),
  );
  context.strokeStyle = "rgba(255, 255, 255, 0.96)";
  context.lineWidth = line + 5;
  context.stroke();

  context.strokeStyle = "#D9480F";
  context.fillStyle = "rgba(217, 72, 15, 0.08)";
  context.lineWidth = line;
  context.beginPath();
  context.roundRect(
    markerX + line / 2,
    markerY + line / 2,
    Math.max(1, markerWidth - line),
    Math.max(1, markerHeight - line),
    Math.min(12, Math.max(4, line * 1.6)),
  );
  context.fill();
  context.stroke();

  const labelText = selection.target.kind === "region"
    ? "1  Selected region"
    : `1  Selected ${selection.target.role || selection.target.tagName || "control"}`;
  const labelFontSize = Math.max(
    20,
    Math.min(48, geometry.outputWidth / 38),
  );
  const labelHeight = Math.round(labelFontSize + 20);
  context.font = `700 ${labelFontSize}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
  const labelWidth = Math.min(
    geometry.outputWidth - 8,
    Math.ceil(context.measureText(labelText).width + 28),
  );
  const labelX = Math.max(
    4,
    Math.min(geometry.outputWidth - labelWidth - 4, markerX),
  );
  const labelY = markerY >= labelHeight + 12
    ? markerY - labelHeight - 8
    : Math.min(
        geometry.outputHeight - labelHeight - 4,
        markerY + markerHeight + 8,
      );
  context.fillStyle = "#D9480F";
  context.beginPath();
  context.roundRect(labelX, Math.max(4, labelY), labelWidth, labelHeight, 8);
  context.fill();
  context.fillStyle = "#FFFFFF";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(
    labelText,
    labelX + 14,
    Math.max(4, labelY) + labelHeight / 2 + 0.5,
    labelWidth - 28,
  );
  context.restore();
  sourceImage.close?.();

  let mimeType: EvidenceImageV1["mimeType"] = "image/png";
  let dataUrl = await canvasDataUrl(canvas, mimeType);
  if (dataUrl.length > 7_500_000) {
    mimeType = "image/webp";
    dataUrl = await canvasDataUrl(canvas, mimeType, 0.9);
  }
  if (dataUrl.length > 8_000_000) throw new Error("The selected region is too large. Select a smaller area and try again.");

  return {
    mimeType,
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    sourceWidth: sourceImage.width,
    sourceHeight: sourceImage.height,
  };
}

function hasInteractiveRole(target: EvidenceTargetV1): boolean {
  return [
    "button", "link", "checkbox", "radio", "textbox", "combobox", "listbox", "menuitem",
    "option", "slider", "spinbutton", "switch", "tab", "treeitem",
  ].includes(target.role);
}

function isNativelyInteractive(target: EvidenceTargetV1): boolean {
  if (["button", "select", "textarea"].includes(target.tagName)) return true;
  if (target.tagName === "a" && Boolean(target.attributes.href)) return true;
  if (target.tagName === "input" && target.attributes.type !== "hidden") return true;
  return false;
}

export function runDeterministicChecks(target: EvidenceTargetV1): DeterministicCheckV1[] {
  const checks: DeterministicCheckV1[] = [];
  if (hasInteractiveRole(target) && !target.accessibleName) {
    checks.push({
      id: "interactive-name",
      outcome: "fail",
      title: "Interactive control has no accessible name",
      description: `The selected ${target.role || target.tagName} does not expose a name in the captured DOM context.`,
      wcag: ["4.1.2"],
      impact: "major",
    });
  }
  if (hasInteractiveRole(target) && !isNativelyInteractive(target) && !target.states.includes("focusable")) {
    checks.push({
      id: "custom-control-keyboard",
      outcome: "needs-review",
      title: "Custom control may not be keyboard operable",
      description: "The selected element has an interactive role but was not detected as keyboard focusable.",
      wcag: ["2.1.1", "4.1.2"],
      impact: "major",
    });
  }
  const tabIndex = Number(target.attributes.tabindex);
  if (Number.isFinite(tabIndex) && tabIndex > 0) {
    checks.push({
      id: "positive-tabindex",
      outcome: "needs-review",
      title: "Positive tabindex may create an unexpected focus order",
      description: `The selected element uses tabindex=${tabIndex}. Confirm that keyboard focus follows the visual and logical reading order.`,
      wcag: ["2.4.3"],
      impact: "minor",
    });
  }
  if (hasInteractiveRole(target) && (target.bounds.width < 24 || target.bounds.height < 24)) {
    checks.push({
      id: "target-size",
      outcome: "needs-review",
      title: "Interactive target may be smaller than 24 CSS pixels",
      description: `The captured bounds are ${Math.round(target.bounds.width)} by ${Math.round(target.bounds.height)} CSS pixels. Check spacing and WCAG exceptions.`,
      wcag: ["2.5.8"],
      impact: "minor",
    });
  }
  if ((target.role === "img" || target.tagName === "img") && !target.accessibleName) {
    checks.push({
      id: "image-alternative",
      outcome: "needs-review",
      title: "Image purpose needs manual review",
      description: "The selected image has no captured accessible name. Confirm whether it is decorative or requires a text alternative.",
      wcag: ["1.1.1"],
      impact: "major",
    });
  }
  return checks;
}

function sentence(value: string, fallback: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return (clean.match(/^.*?[.!?](?:\s|$)/)?.[0] || clean).slice(0, 240).replace(/[.!?]+$/, "");
}

function affectedUsersFor(checks: DeterministicCheckV1[]): AffectedUser[] {
  const output = new Set<AffectedUser>();
  if (checks.some((check) => check.id === "interactive-name" || check.id === "image-alternative")) {
    output.add("screen-reader");
    output.add("voice-control");
  }
  if (checks.some((check) => check.id === "custom-control-keyboard" || check.id === "positive-tabindex")) {
    output.add("keyboard");
    output.add("motor");
  }
  if (checks.some((check) => check.id === "target-size")) {
    output.add("motor");
    output.add("low-vision");
  }
  if (!output.size) output.add("other");
  return [...output];
}

function severityFor(checks: DeterministicCheckV1[]): FindingSeverity {
  if (checks.some((check) => check.impact === "blocker")) return "blocker";
  if (checks.some((check) => check.impact === "major")) return "major";
  return "minor";
}

function mappingsFor(checks: DeterministicCheckV1[]): WcagMappingV1[] {
  const criteria = new Map<string, DeterministicCheckV1>();
  for (const check of checks) {
    for (const criterion of check.wcag) if (!criteria.has(criterion)) criteria.set(criterion, check);
  }
  return [...criteria].map(([criterion, check]) => ({
    criterion,
    level: WCAG_DETAILS[criterion]?.level ?? "A",
    name: WCAG_DETAILS[criterion]?.name ?? "WCAG success criterion",
    rationale: check.description,
    confidence: check.outcome === "fail" ? "high" : "medium",
  }));
}

export function createLocalDraft(evidence: EvidencePacketV1): AiFindingDraftV1 {
  const primary = evidence.checks.find((check) => check.outcome === "fail") ?? evidence.checks[0];
  const role = evidence.target.role || evidence.target.tagName || "element";
  const observed = sentence(evidence.observation, primary?.title || `Review the selected ${role}`);
  const mappings = mappingsFor(evidence.checks);
  const draft: AiFindingDraftV1 = {
    schemaVersion: AI_DRAFT_SCHEMA_VERSION,
    title: primary?.title || observed,
    description: evidence.observation.trim() || `The selected ${role} requires accessibility review.`,
    actualResult: evidence.observation.trim() || primary?.description || `The selected ${role} does not provide the expected accessible behavior.`,
    expectedResult: primary?.id === "interactive-name"
      ? `The ${role} should expose a concise accessible name that describes its purpose.`
      : `The ${role} should support the expected accessible semantics and interaction without creating a barrier.`,
    userImpact: primary?.id === "interactive-name"
      ? `People using a screen reader or voice control may be unable to identify or operate the ${role}.`
      : `Affected users may be unable to understand or operate this part of the interface reliably.`,
    affectedUsers: affectedUsersFor(evidence.checks),
    severity: severityFor(evidence.checks),
    severityRationale: evidence.taskContext.trim()
      ? `The issue affects the task “${evidence.taskContext.trim()}”. Confirm task criticality and whether a practical workaround exists.`
      : "Confirm task criticality, frequency, reach, and whether a practical workaround exists before finalizing severity.",
    wcag: mappings,
    recommendation: primary?.id === "interactive-name"
      ? `Provide a visible text label or another programmatic name. Prefer native HTML and verify the final name in the browser accessibility tree.`
      : `Review the captured semantics and behavior, use native HTML where possible, and verify the change with keyboard and assistive technology.`,
    exampleFix: primary?.id === "interactive-name" && role === "button"
      ? `<button type="button">Describe the action</button>`
      : "",
    reproductionSteps: [
      `Open ${evidence.page.title || "the captured page"}.`,
      `Locate the selected ${role}${evidence.target.accessibleName ? ` named “${evidence.target.accessibleName}”` : ""}.`,
      evidence.observation.trim() || "Inspect the element with the relevant assistive technology and confirm the captured behavior.",
    ],
    confidence: primary?.outcome === "fail" ? "medium" : "low",
    fieldConfidence: [
      {
        field: "wcag",
        confidence: mappings.some((mapping) => mapping.confidence === "high") ? "high" : "medium",
        reason: mappings.length ? "Based on deterministic selected-element evidence." : "No deterministic WCAG mapping was available.",
      },
      {
        field: "severity",
        confidence: "low",
        reason: "Task importance, frequency, reach, and workaround availability require auditor judgment.",
      },
    ],
    assumptions: evidence.observation.trim() ? [] : ["The issue behavior was inferred from captured element context."],
    manualChecks: [
      "Confirm the behavior with the relevant keyboard or assistive-technology workflow.",
      "Confirm the WCAG mapping and severity before saving the finding.",
    ],
    provenance: {
      source: "local",
      model: "deterministic-draft",
      modelVersion: "1",
      promptVersion: "local-v1",
      knowledgeVersion: "wcag-2.2",
      generatedAt: Date.now(),
    },
  };
  return parseAiFindingDraft(draft);
}

export async function createEvidencePacket(
  selection: CapturedSelection,
  screenshotDataUrl: string,
): Promise<EvidencePacketV1> {
  const image = await createMarkedCrop(screenshotDataUrl, selection);
  const capturedAt = Date.now();
  return parseEvidencePacket({
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    findingId: createFindingId(capturedAt),
    capturedAt,
    captureMode: selection.target.kind,
    observation: "",
    taskContext: "",
    page: selection.page,
    target: selection.target,
    image,
    checks: runDeterministicChecks(selection.target),
    omissions: [
      "Form and editable values were not collected",
      "URL query parameters and fragments were removed",
      "Cookies, browser storage, network data, and hidden page content were not accessed",
    ],
  });
}

export function applyConsent(
  evidence: EvidencePacketV1,
  consent: Omit<EvidenceConsentV1, "approvedAt">,
): EvidencePacketV1 {
  const target = consent.includeElementText ? evidence.target : {
    ...evidence.target,
    accessibleName: "",
    accessibleDescription: "",
    selector: "",
    structuralPath: "",
    labels: [],
    nearbyHeading: "",
    domExcerpt: "",
    attributes: {},
  };
  const page = consent.includeUrl
    ? evidence.page
    : { ...evidence.page, title: "", url: "", origin: "" };
  const omissions = new Set(evidence.omissions);
  if (!consent.includeScreenshot) omissions.add("Screenshot withheld by the auditor");
  if (!consent.includeElementText) omissions.add("Element text, attributes, and selector withheld by the auditor");
  if (!consent.includeUrl) omissions.add("Page title and address withheld by the auditor");
  return parseEvidencePacket({
    ...evidence,
    target,
    page,
    image: consent.includeScreenshot ? evidence.image : undefined,
    omissions: [...omissions],
    consent: { ...consent, approvedAt: Date.now() },
  });
}

export function findingMarkdown(evidence: EvidencePacketV1, draft: AiFindingDraftV1): string {
  const wcag = draft.wcag.length
    ? draft.wcag.map((mapping) => `${mapping.criterion} ${mapping.name} (${mapping.level})`).join(", ")
    : "Manual review required";
  return [
    `# ${draft.title}`,
    "",
    `**Finding ID:** ${evidence.findingId}`,
    `**Severity:** ${draft.severity}`,
    `**WCAG:** ${wcag}`,
    `**Page:** ${evidence.page.url || "Withheld"}`,
    `**Target:** \`${evidence.target.selector || evidence.target.structuralPath || "Selected region"}\``,
    "",
    "## Description",
    "",
    draft.description,
    "",
    "## Actual result",
    "",
    draft.actualResult,
    "",
    "## Expected result",
    "",
    draft.expectedResult,
    "",
    "## User impact",
    "",
    draft.userImpact,
    "",
    "## Suggested resolution",
    "",
    draft.recommendation,
    ...(draft.exampleFix ? ["", "## Example fix", "", "```html", draft.exampleFix, "```"] : []),
    "",
    "## Reproduction steps",
    "",
    ...draft.reproductionSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "> Generated as a draft. Confirm the behavior, severity, and WCAG mapping before delivery.",
    "",
  ].join("\n");
}
