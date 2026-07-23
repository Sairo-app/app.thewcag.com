import type { IdentifiedReportIssue, ReportIssue } from "./schema";
import {
  cleanReportText,
  createFindingId,
  isFindingId,
  normalizeReportCriteria,
  REPORT_PUBLISH_LIMITS,
} from "@accessibility-build/audit-contracts";
import { REPORT_STATUSES } from "./report-view";
import type { Metadata } from "next";
import { SITE_URL } from "./seo";

export { SITE_URL };

export function buildSharedReportMetadata(input: {
  slug: string;
  title: string;
  description?: string | null;
  issueCount: number;
}): Metadata {
  const image = `${SITE_URL}/api/s/${input.slug}/image`;
  const description =
    input.description ||
    `${input.issueCount} accessibility ${input.issueCount === 1 ? "issue" : "issues"} annotated in the TheWCAG desktop app.`;
  return {
    title: input.title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: input.title, description, images: [{ url: image, width: 1400 }], type: "article" },
    twitter: { card: "summary_large_image", title: input.title, description, images: [image] },
  };
}

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Short, unguessable, URL-safe slug for a shared report. */
export function generateSlug(
  len = 10,
  fillRandom: (bytes: Uint8Array) => void = (bytes) => { crypto.getRandomValues(bytes); },
): string {
  if (!Number.isInteger(len) || len < 1 || len > 128) throw new Error("invalid slug length");
  let out = "";
  while (out.length < len) {
    const remaining = len - out.length;
    const bytes = new Uint8Array(Math.max(16, Math.ceil(remaining * 256 / 248)));
    fillRandom(bytes);
    for (const byte of bytes) {
      // 248 is the largest multiple of 62 below 256. Rejecting the remaining
      // eight byte values gives every alphabet character equal probability.
      if (byte >= 248) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === len) break;
    }
  }
  return out;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_PNG_DIMENSION = 20_000;
const MAX_PNG_PIXELS = 100_000_000;

function structurallyValidPng(buffer: Buffer): boolean {
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  let offset = 8;
  let chunks = 0;
  let sawHeader = false;
  let sawEnd = false;
  while (offset + 12 <= buffer.length && chunks < 10_000) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const next = offset + 12 + length;
    if (next > buffer.length) return false;
    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13 || offset !== 8) return false;
      const width = buffer.readUInt32BE(offset + 8);
      const height = buffer.readUInt32BE(offset + 12);
      if (
        width < 1 ||
        height < 1 ||
        width > MAX_PNG_DIMENSION ||
        height > MAX_PNG_DIMENSION ||
        width * height > MAX_PNG_PIXELS
      ) return false;
      sawHeader = true;
    }
    offset = next;
    chunks += 1;
    if (type === "IEND") {
      if (length !== 0 || offset !== buffer.length) return false;
      sawEnd = true;
      break;
    }
  }
  return sawHeader && sawEnd;
}

/** Validate a base64 string decodes to a PNG within a size cap; return bytes. */
export function decodePngBase64(
  base64: string,
  maxBytes = 4_000_000,
): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  if (!base64) return { ok: false, error: "missing image" };
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    return { ok: false, error: "invalid base64" };
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "invalid base64" };
  }
  if (!structurallyValidPng(buffer)) {
    return { ok: false, error: "not a PNG image" };
  }
  if (buffer.length > maxBytes) return { ok: false, error: "image too large" };
  return { ok: true, buffer };
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

const ISSUE_SEVERITIES = new Set(["blocker", "major", "minor"]);
const ISSUE_STATUSES = new Set(REPORT_STATUSES);

function sanitizeReportIssuesInternal(
  value: unknown,
  maxItems: number,
  allocateIds: boolean,
): ReportIssue[] {
  if (!Array.isArray(value)) return [];
  const issues: ReportIssue[] = [];
  const usedIds = new Set<string>();
  for (const candidate of value.slice(0, maxItems)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const raw = candidate as Record<string, unknown>;
    const label = cleanReportText(raw.label, REPORT_PUBLISH_LIMITS.issueTitleLength) || "Accessibility issue";
    const note = cleanReportText(raw.note, REPORT_PUBLISH_LIMITS.issueNoteLength);
    const criteria = normalizeReportCriteria(raw.sc);
    const sc = criteria.length ? criteria : undefined;
    const rawSeverity = cleanReportText(raw.severity, 20).toLowerCase();
    const severity = ISSUE_SEVERITIES.has(rawSeverity) ? rawSeverity as ReportIssue["severity"] : "major";
    const candidateId = cleanReportText(raw.id, 64).toUpperCase();
    let id: string | undefined = isFindingId(candidateId) && !usedIds.has(candidateId)
      ? candidateId
      : undefined;
    if (!id && allocateIds) {
      do id = createFindingId(); while (usedIds.has(id));
    }
    if (id) usedIds.add(id);
    const rawStatus = cleanReportText(raw.status, 20).toLowerCase();
    const status = ISSUE_STATUSES.has(rawStatus as (typeof REPORT_STATUSES)[number])
      ? rawStatus as NonNullable<ReportIssue["status"]>
      : "open";
    issues.push({ ...(id ? { id } : {}), n: issues.length + 1, sc, label, severity, note, status });
  }
  return issues;
}

/** Normalize stored report data for rendering without ever inventing an identity. */
export function sanitizeReportIssues(
  value: unknown,
  maxItems: number = REPORT_PUBLISH_LIMITS.issues,
): ReportIssue[] {
  return sanitizeReportIssuesInternal(value, maxItems, false);
}

/** Bound publish input and allocate identities before the report is persisted. */
export function sanitizeReportIssuesForPublish(
  value: unknown,
  maxItems: number = REPORT_PUBLISH_LIMITS.issues,
): IdentifiedReportIssue[] {
  return sanitizeReportIssuesInternal(value, maxItems, true) as IdentifiedReportIssue[];
}
