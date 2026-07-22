import { describe, expect, it } from "vitest";
import { isFindingId } from "@accessibility-build/audit-contracts";
import {
  emptyDoc,
  normalizeAnnotationFindingIds,
  type AnnotationDoc,
} from "./model";

describe("annotation finding identities", () => {
  it("assigns different immutable IDs to legacy issue badges", () => {
    const document: AnnotationDoc = {
      ...emptyDoc(),
      nextId: 3,
      shapes: [1, 2].map((id) => ({
        id,
        kind: "badge" as const,
        x1: id,
        y1: id,
        x2: id,
        y2: id,
        color: "#000000",
      })),
    };
    const normalized = normalizeAnnotationFindingIds(document);
    const ids = normalized.document.shapes.map((shape) => shape.findingId);

    expect(normalized.changed).toBe(true);
    expect(ids.every(isFindingId)).toBe(true);
    expect(new Set(ids).size).toBe(2);
    expect(normalizeAnnotationFindingIds(normalized.document).changed).toBe(false);
  });
});
