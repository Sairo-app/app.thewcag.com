import type { Finding } from "./desktop";

export function retainFindingSelection(
  selected: ReadonlySet<string>,
  findings: Array<Pick<Finding, "key">>,
): Set<string> {
  const available = new Set(findings.map((finding) => finding.key));
  return new Set([...selected].filter((key) => available.has(key)));
}
