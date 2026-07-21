import type { Finding } from "./desktop";

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
  let next = 1;
  let changed = false;
  const normalized = findings.map((finding) => {
    const current = finding.reference?.toUpperCase();
    if (current && REFERENCE.test(current) && !used.has(current)) {
      used.add(current);
      next = Math.max(next, Number(current.slice(2)) + 1);
      return current === finding.reference ? finding : { ...finding, reference: current };
    }
    while (used.has(`F-${String(next).padStart(3, "0")}`)) next += 1;
    const reference = `F-${String(next).padStart(3, "0")}`;
    next += 1;
    used.add(reference);
    changed = true;
    return { ...finding, reference };
  });
  return { findings: normalized, changed };
}
