import {
  createFindingId,
  EVIDENCE_SCHEMA_VERSION,
  createLocalFindingDraft,
  parseEvidencePacket,
  type AiFindingDraftV1,
  type DeterministicCheckV1,
  type EvidenceConsentV1,
  type EvidenceImageV1,
  type EvidencePacketV1,
  type EvidenceRect,
  type EvidenceTargetV1,
} from "@accessibility-build/audit-contracts";
import type { CapturedSelection } from "./shared/messages";

export interface CropGeometry {
  source: EvidenceRect;
  marker: EvidenceRect;
  outputWidth: number;
  outputHeight: number;
  scale: number;
}

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

function fallbackAccessibleNameSource(target: EvidenceTargetV1): "placeholder" | "title" | null {
  const name = target.accessibleName.trim();
  if (!name || target.labels.length || target.attributes["aria-label"] || target.attributes.alt) return null;
  const excerptText = target.domExcerpt.replace(/^<[^>]*>|<\/[^>]+>$/g, "").trim();
  if (excerptText) return null;
  if (target.attributes.placeholder?.trim() === name) return "placeholder";
  if (target.attributes.title?.trim() === name) return "title";
  return null;
}

export function runDeterministicChecks(target: EvidenceTargetV1): DeterministicCheckV1[] {
  const checks: DeterministicCheckV1[] = [];
  const fallbackNameSource = fallbackAccessibleNameSource(target);
  if (hasInteractiveRole(target) && !target.accessibleName) {
    checks.push({
      id: "interactive-name",
      outcome: "fail",
      title: "Interactive control has no accessible name",
      description: `The selected ${target.role || target.tagName} does not expose a name in the captured DOM context.`,
      wcag: ["4.1.2"],
      impact: "major",
    });
  } else if (hasInteractiveRole(target) && fallbackNameSource) {
    checks.push({
      id: "interactive-name",
      outcome: "needs-review",
      title: `Interactive control relies on ${fallbackNameSource} text for its name`,
      description: `The selected ${target.role || target.tagName} appears to be named only by its ${fallbackNameSource}. Confirm the computed name in the accessibility tree and provide a persistent visible label if needed.`,
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

export function createLocalDraft(evidence: EvidencePacketV1): AiFindingDraftV1 {
  return createLocalFindingDraft(evidence);
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
    omissions: captureOmissions(selection),
  });
}

export function captureOmissions(selection: Pick<CapturedSelection, "omissions">): string[] {
  return [...new Set([
    "Form and editable values were not extracted from the DOM; visible values may remain in an included screenshot",
    "URL query parameters and fragments were removed",
    "Cookies, browser storage, network data, and hidden page content were not accessed",
    ...(selection.omissions ?? []),
  ])];
}

export function applyConsent(
  evidence: EvidencePacketV1,
  consent: Omit<EvidenceConsentV1, "approvedAt">,
): EvidencePacketV1 {
  const target: EvidenceTargetV1 = consent.includeElementText ? evidence.target : {
    kind: evidence.target.kind,
    tagName: "",
    role: "",
    accessibleName: "",
    accessibleDescription: "",
    selector: "",
    structuralPath: "",
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    marker: { x: 0, y: 0, width: 1, height: 1 },
    states: [],
    labels: [],
    nearbyHeading: "",
    landmark: "",
    attributes: {},
    styles: {},
    domExcerpt: "",
  };
  const page = consent.includeUrl
    ? evidence.page
    : { ...evidence.page, title: "", url: "", origin: "", locale: "", browser: "" };
  const omissions = new Set(evidence.omissions);
  if (!consent.includeScreenshot) omissions.add("Screenshot withheld by the auditor");
  if (!consent.includeElementText) omissions.add("Component name, role, tag, selector, states, styles, landmark, bounds, HTML context, and derived checks withheld by the auditor");
  if (!consent.includeUrl) omissions.add("Page title, address, browser/device details, and locale withheld by the auditor");
  return parseEvidencePacket({
    ...evidence,
    target,
    page,
    image: consent.includeScreenshot ? evidence.image : undefined,
    checks: consent.includeElementText ? evidence.checks : [],
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
