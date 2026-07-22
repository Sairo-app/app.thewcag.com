import type { CaptureEntry, Finding } from "./desktop";

function uniqueCaptureIds(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    if (!value?.trim() || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/** The ordered captures authored as the finding's primary evidence. */
export function findingPrimaryEvidenceCaptureIds(finding: Finding): string[] {
  return uniqueCaptureIds(
    finding.evidenceCaptureIds === undefined
      ? [finding.captureId]
      : finding.evidenceCaptureIds,
  );
}

/** Every capture relationship that contributes to the finding's traceability. */
export function findingEvidenceCaptureIds(finding: Finding): string[] {
  return uniqueCaptureIds([
    ...findingPrimaryEvidenceCaptureIds(finding),
    finding.beforeCaptureId,
    finding.afterCaptureId,
    ...(finding.occurrences ?? []).map((occurrence) => occurrence.captureId),
  ]);
}

export function findingHasEvidence(
  finding: Finding,
  availableCaptureIds?: ReadonlySet<string>,
): boolean {
  const ids = findingEvidenceCaptureIds(finding);
  return availableCaptureIds
    ? ids.some((id) => availableCaptureIds.has(id))
    : ids.length > 0;
}

export function referencedEvidenceCaptureIds(findings: Finding[]): Set<string> {
  return new Set(findings.flatMap(findingEvidenceCaptureIds));
}

export function unassignedCaptures(
  captures: CaptureEntry[],
  findings: Finding[],
): CaptureEntry[] {
  const assigned = referencedEvidenceCaptureIds(findings);
  return captures.filter((capture) => !assigned.has(capture.id));
}

/** Adds the canonical evidence array without invalidating legacy package pointers. */
export function normalizeFindingEvidence(finding: Finding): Finding {
  const evidenceCaptureIds = findingPrimaryEvidenceCaptureIds(finding);
  if (!evidenceCaptureIds.length) {
    return finding.evidenceCaptureIds !== undefined && finding.captureId
      ? { ...finding, captureId: undefined }
      : finding;
  }
  const captureId = evidenceCaptureIds[0];
  if (
    finding.captureId === captureId &&
    finding.evidenceCaptureIds?.length === evidenceCaptureIds.length &&
    finding.evidenceCaptureIds.every((id, index) => id === evidenceCaptureIds[index])
  ) {
    return finding;
  }
  return { ...finding, evidenceCaptureIds, captureId };
}
