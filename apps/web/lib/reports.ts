import type { ReportIssue } from "./schema";
import { REPORT_STATUSES } from "./report-view";
import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

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
export function generateSlug(len = 10): string {
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
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

function cleanText(value: unknown, maxLength: number): string {
  // Report metadata is public and may originate from the extension or desktop app.
  // eslint-disable-next-line no-control-regex
  return typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength) : "";
}

/** Bound and normalize untrusted issue metadata before it reaches JSONB or a public report. */
export function sanitizeReportIssues(value: unknown, maxItems = 100): ReportIssue[] {
  if (!Array.isArray(value)) return [];
  const issues: ReportIssue[] = [];
  for (const candidate of value.slice(0, maxItems)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const raw = candidate as Record<string, unknown>;
    const label = cleanText(raw.label, 120) || "Accessibility issue";
    const note = cleanText(raw.note, 1000);
    const rawSc = cleanText(raw.sc, 20);
    const sc = /^\d+(?:\.\d+){1,3}$/.test(rawSc) ? rawSc : undefined;
    const rawSeverity = cleanText(raw.severity, 20).toLowerCase();
    const severity = ISSUE_SEVERITIES.has(rawSeverity) ? rawSeverity as ReportIssue["severity"] : "major";
    const rawStatus = cleanText(raw.status, 20).toLowerCase();
    const status = ISSUE_STATUSES.has(rawStatus as (typeof REPORT_STATUSES)[number])
      ? rawStatus as NonNullable<ReportIssue["status"]>
      : "open";
    issues.push({ n: issues.length + 1, sc, label, severity, note, status });
  }
  return issues;
}
