import type { Finding, FindingStatusTransition } from "./desktop";

const FINDING_STATUSES = new Set<Finding["status"]>([
  "open",
  "retest",
  "fixed",
  "accepted",
]);

export function normalizeFindingStatusHistory(
  finding: Pick<Finding, "status" | "statusHistory" | "retestedAt">,
): FindingStatusTransition[] {
  const history = (finding.statusHistory ?? [])
    .filter(
      (entry): entry is FindingStatusTransition =>
        Boolean(entry) &&
        FINDING_STATUSES.has(entry.status) &&
        Number.isFinite(entry.changedAt),
    )
    .sort((left, right) => left.changedAt - right.changedAt)
    .filter(
      (entry, index, entries) =>
        index === 0 ||
        entry.status !== entries[index - 1].status ||
        entry.changedAt !== entries[index - 1].changedAt,
    );

  if (
    finding.retestedAt !== undefined &&
    Number.isFinite(finding.retestedAt) &&
    !history.some(
      (entry) =>
        entry.status === "fixed" && entry.changedAt === finding.retestedAt,
    )
  ) {
    history.push({ status: "fixed", changedAt: finding.retestedAt });
    history.sort((left, right) => left.changedAt - right.changedAt);
  }

  return history;
}

export function findingStatusHistoryAfterChange(
  finding: Pick<Finding, "status" | "statusHistory" | "retestedAt"> | undefined,
  nextStatus: Finding["status"],
  changedAt: number,
): FindingStatusTransition[] | undefined {
  if (!finding) return [{ status: nextStatus, changedAt }];
  const history = normalizeFindingStatusHistory(finding);
  if (finding.status === nextStatus) return history.length ? history : undefined;
  return [...history, { status: nextStatus, changedAt }];
}
