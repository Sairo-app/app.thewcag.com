import type { ReportIssue } from "./schema";
import {
  createFindingId,
  isFindingId,
} from "@accessibility-build/audit-contracts";

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.thewcag.com";

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

/** Validate a base64 string decodes to a PNG within a size cap; return bytes. */
export function decodePngBase64(
  base64: string,
  maxBytes = 4_000_000,
): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  if (!base64) return { ok: false, error: "missing image" };
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "invalid base64" };
  }
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ok: false, error: "not a PNG image" };
  }
  if (buffer.length > maxBytes) return { ok: false, error: "image too large" };
  return { ok: true, buffer };
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

const ISSUE_SEVERITIES = new Set(["blocker", "major", "minor"]);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength) : "";
}

/** Bound and normalize untrusted issue metadata before it reaches JSONB or a public report. */
export function sanitizeReportIssues(value: unknown, maxItems = 100): ReportIssue[] {
  if (!Array.isArray(value)) return [];
  const issues: ReportIssue[] = [];
  const usedIds = new Set<string>();
  for (const candidate of value.slice(0, maxItems)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const raw = candidate as Record<string, unknown>;
    const label = cleanText(raw.label, 120) || "Accessibility issue";
    const note = cleanText(raw.note, 1000);
    const rawSc = cleanText(raw.sc, 20);
    const sc = /^\d+(?:\.\d+){1,3}$/.test(rawSc) ? rawSc : undefined;
    const rawSeverity = cleanText(raw.severity, 20).toLowerCase();
    const severity = ISSUE_SEVERITIES.has(rawSeverity) ? rawSeverity : "major";
    let id = cleanText(raw.id, 64).toUpperCase();
    if (!isFindingId(id) || usedIds.has(id)) {
      do id = createFindingId(); while (usedIds.has(id));
    }
    usedIds.add(id);
    issues.push({ id, n: issues.length + 1, sc, label, severity, note });
  }
  return issues;
}
