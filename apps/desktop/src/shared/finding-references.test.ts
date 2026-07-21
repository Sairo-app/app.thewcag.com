import { describe, expect, it } from "vitest";
import type { Finding } from "./desktop";
import {
  nextFindingReference,
  normalizeFindingReferences,
} from "./finding-references";

function finding(key: string, reference?: string): Finding {
  return {
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
});
