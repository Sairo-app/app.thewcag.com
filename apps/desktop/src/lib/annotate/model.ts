export type ShapeKind = "badge" | "arrow" | "rect" | "redact" | "text" | "measure" | "probe" | "focus";
/** "crop" trims the capture itself (into a new capture) - it draws no shape. */
export type Tool = "select" | "crop" | ShapeKind;

export const ISSUE_TYPES = [
  { id: "contrast", label: "Contrast", sc: "1.4.3", template: "Text does not reach the 4.5:1 minimum contrast ratio against its background." },
  { id: "use-of-color", label: "Use of color", sc: "1.4.1", template: "Information is conveyed by color alone; add a second cue (icon, label or pattern)." },
  { id: "focus", label: "Focus indicator", sc: "2.4.7", template: "The keyboard focus indicator is missing or not clearly visible on this element." },
  { id: "target-size", label: "Target size", sc: "2.5.8", template: "This interactive target is smaller than the 24×24px minimum." },
  { id: "alt-text", label: "Alt text", sc: "1.1.1", template: "This image conveys information but has missing or unhelpful alternative text." },
  { id: "label", label: "Label / name", sc: "4.1.2", template: "This control has no accessible name for assistive technology." },
  { id: "keyboard", label: "Keyboard", sc: "2.1.1", template: "This functionality cannot be reached or operated with the keyboard alone." },
  { id: "other", label: "Other", sc: "", template: "" },
] as const;
export type IssueId = (typeof ISSUE_TYPES)[number]["id"];

export const SEVERITIES = ["blocker", "major", "minor"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Severity is the badge's visual identity - triage at a glance. */
export const SEVERITY_COLORS: Record<Severity, string> = {
  blocker: "#DC2626",
  major: "#F59E0B",
  minor: "#64748B",
};

export interface Shape {
  id: number;
  kind: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  text?: string;
  issueType?: IssueId;
  severity?: Severity;
  note?: string;
  /** Immutable identity allocated as soon as an issue badge is captured. */
  findingId?: string;
  /** redact: solid is the safe default - pixelation can be reversed */
  style?: "solid" | "pixel";
}

export interface AnnotationDoc {
  version: 1;
  nextId: number;
  shapes: Shape[];
}

export function emptyDoc(): AnnotationDoc {
  return { version: 1, nextId: 1, shapes: [] };
}

export function parseDoc(json: string): AnnotationDoc | null {
  try {
    const doc = JSON.parse(json);
    if (doc?.version === 1 && Array.isArray(doc.shapes)) {
      return normalizeAnnotationFindingIds(doc as AnnotationDoc).document;
    }
  } catch {
    /* corrupted doc - start fresh rather than crash */
  }
  return null;
}

export function normalizeAnnotationFindingIds(document: AnnotationDoc): {
  document: AnnotationDoc;
  changed: boolean;
} {
  const used = new Set<string>();
  let changed = false;
  const shapes = document.shapes.map((shape) => {
    if (shape.kind !== "badge") return shape;
    let findingId = shape.findingId;
    if (!isFindingId(findingId) || used.has(findingId)) {
      do findingId = createFindingId(); while (used.has(findingId));
      changed = true;
    }
    used.add(findingId);
    return findingId === shape.findingId ? shape : { ...shape, findingId };
  });
  return {
    document: changed ? { ...document, shapes } : document,
    changed,
  };
}

export function issueTypeOf(shape: Shape) {
  return ISSUE_TYPES.find((t) => t.id === shape.issueType) ?? ISSUE_TYPES[ISSUE_TYPES.length - 1];
}

export const TARGET_MIN = 24; // WCAG 2.5.8 minimum target size
import { createFindingId, isFindingId } from "@accessibility-build/audit-contracts";
