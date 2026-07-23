export const REPORT_PUBLISH_LIMITS = {
  requestBytes: 5_600_000,
  imageBase64Length: 5_400_000,
  issues: 100,
  criteriaPerIssue: 8,
  titleLength: 160,
  descriptionLength: 2_000,
  issueTitleLength: 160,
  issueNoteLength: 5_000,
} as const;

const WCAG_CRITERION = /^\d+(?:\.\d+){1,3}$/;
// eslint-disable-next-line no-control-regex
const PUBLIC_TEXT_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

function validCriterion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const criterion = value.trim();
  return WCAG_CRITERION.test(criterion) ? criterion : null;
}

/**
 * Normalize the public-report WCAG field.
 *
 * Arrays are the current wire format and preserve every valid, unique mapping.
 * Strings are the legacy wire format; only the first valid comma-separated token
 * is retained so old multi-value strings no longer lose every criterion.
 */
export function normalizeReportCriteria(value: unknown): string[] {
  if (typeof value === "string") {
    for (const token of value.split(",")) {
      const criterion = validCriterion(token);
      if (criterion) return [criterion];
    }
    return [];
  }
  if (!Array.isArray(value)) return [];

  const criteria: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const criterion = validCriterion(candidate);
    if (!criterion || seen.has(criterion)) continue;
    seen.add(criterion);
    criteria.push(criterion);
    if (criteria.length === REPORT_PUBLISH_LIMITS.criteriaPerIssue) break;
  }
  return criteria;
}

export function cleanReportText(value: unknown, maxLength: number): string {
  // Public report metadata can originate outside either application process.
  return typeof value === "string"
    ? value.replace(PUBLIC_TEXT_CONTROL_CHARACTERS, " ").trim().slice(0, maxLength)
    : "";
}
