import type { Finding } from "./desktop";
import { createFindingId, isFindingId } from "@accessibility-build/audit-contracts";

const REFERENCE = /^F-(\d{3,})$/;

export function nextFindingReference(findings: Finding[]): string {
  const highest = findings.reduce((maximum, finding) => {
    const match = finding.reference?.match(REFERENCE);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `F-${String(highest + 1).padStart(3, "0")}`;
}

export function normalizeFindingReferences(findings: Finding[]): {
  findings: Finding[];
  changed: boolean;
} {
  const used = new Set<string>();
  const usedIds = new Set<string>();
  let next = 1;
  let changed = false;
  const normalized = findings.map((finding) => {
    let identity = finding.id;
    if (!isFindingId(identity) || usedIds.has(identity)) {
      do {
        identity = createFindingId(finding.createdAt || Date.now());
      } while (usedIds.has(identity));
      changed = true;
    }
    usedIds.add(identity);
    const current = finding.reference?.toUpperCase();
    if (current && REFERENCE.test(current) && !used.has(current)) {
      used.add(current);
      next = Math.max(next, Number(current.slice(2)) + 1);
      return current === finding.reference && identity === finding.id
        ? finding
        : { ...finding, id: identity, reference: current };
    }
    while (used.has(`F-${String(next).padStart(3, "0")}`)) next += 1;
    const reference = `F-${String(next).padStart(3, "0")}`;
    next += 1;
    used.add(reference);
    changed = true;
    return { ...finding, id: identity, reference };
  });
  return { findings: normalized, changed };
}
