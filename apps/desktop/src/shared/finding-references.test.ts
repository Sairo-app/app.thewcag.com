import { describe, expect, it } from "vitest";
import type { Finding } from "./desktop";
import {
  nextFindingReference,
  normalizeFindingReferences,
} from "./finding-references";

function finding(key: string, reference?: string): Finding {
  return {
    id: `WCG-F-20260722-00000-00000-00000-00000-${key.replace(/[^0-9A-HJKMNP-TV-Z]/gi, "0").toUpperCase().padStart(6, "0").slice(-6)}`,
    key,
    reference,
    title: key,
    wcag: "1.1.1",
    severity: "major",
    status: "open",
    note: "",
    createdAt: 1,
  };
}

describe("finding references", () => {
  it("preserves unique references and assigns stable values to legacy findings", () => {
    const result = normalizeFindingReferences([
      finding("a", "F-004"),
      finding("b"),
      finding("c", "F-004"),
    ]);
    expect(result.changed).toBe(true);
    expect(result.findings.map((item) => item.reference)).toEqual([
      "F-004",
      "F-005",
      "F-006",
    ]);
    expect(normalizeFindingReferences(result.findings).changed).toBe(false);
  });

  it("creates the next reference without depending on sort order", () => {
    expect(nextFindingReference([finding("a", "F-020"), finding("b", "F-003")]))
      .toBe("F-021");
  });

  it("migrates legacy and duplicate identities without changing valid ones", () => {
    const original = finding("a", "F-001");
    const { id: _legacyId, ...legacyRecord } = finding("b", "F-002");
    const legacy = legacyRecord as Finding;
    const duplicate = { ...finding("c", "F-003"), id: original.id };

    const normalized = normalizeFindingReferences([
      original,
      legacy as Finding,
      duplicate,
    ]);
    expect(normalized.findings[0].id).toBe(original.id);
    expect(normalized.findings[1].id).toMatch(/^WCG-F-/);
    expect(normalized.findings[2].id).not.toBe(original.id);
    expect(new Set(normalized.findings.map((item) => item.id)).size).toBe(3);
    expect(normalizeFindingReferences(normalized.findings).changed).toBe(false);
  });
});
