export const CRASH_REPORT_ORIGINS = [
  "main-uncaught-exception",
  "main-unhandled-rejection",
  "renderer-process-gone",
  "child-process-gone",
] as const;

export type CrashReportOrigin = (typeof CRASH_REPORT_ORIGINS)[number];

export interface CrashReportPayload {
  origin: CrashReportOrigin;
  name: string;
  message: string;
  frames: string[];
  fingerprint: string;
  appVersion: string;
  platform: string;
  osRelease: string;
  arch: string;
}

const ORIGIN_SET = new Set<string>(CRASH_REPORT_ORIGINS);

const FIELDS = [
  "origin",
  "name",
  "message",
  "frames",
  "fingerprint",
  "appVersion",
  "platform",
  "osRelease",
  "arch",
] as const;

const MAXIMUM_NAME = 100;
const MAXIMUM_MESSAGE = 300;
const MAXIMUM_FRAMES = 12;
const MAXIMUM_FRAME = 200;
const MAXIMUM_VERSION = 40;
const MAXIMUM_PLATFORM = 32;

/**
 * One alternation, scanned once, so each span is classified exactly once.
 * Separate passes would let a later rule rewrite an earlier rule's output: a
 * URL reduced to `origin/[path]` is itself path-shaped.
 *
 * Order matters: the first alternative that matches at a position wins.
 */
const REDACTABLE = new RegExp(
  [
    /file:\/\/\/\S+/,
    /[\w.+-]+@[\w-]+\.[\w.-]+/,
    /https?:\/\/[^\s/]+(?:\/\S*)?/,
    /(?:[A-Za-z]:)?[\\/](?:[^\s\\/:*?"<>|]+[\\/])+[^\s\\/:*?"<>|]*/,
    /\b[A-Za-z0-9_-]{32,}\b/,
  ]
    .map((pattern) => pattern.source)
    .join("|"),
  "g",
);

/**
 * The desktop client redacts before sending, but the endpoint is public and an
 * old or tampered client can send anything. Redacting again here means the
 * database can only ever hold sanitized text.
 */
export function redactCrashText(input: string): string {
  return input
    .replace(REDACTABLE, (match) => {
      if (match.startsWith("file://")) return "[path]";
      if (/^https?:\/\//.test(match)) {
        const origin = /^https?:\/\/[^\s/]+/.exec(match)?.[0] ?? match;
        return match.length > origin.length ? `${origin}/[path]` : origin;
      }
      if (/^[\w.+-]+@/.test(match)) return "[email]";
      if (/[\\/]/.test(match)) return "[path]";
      return "[redacted]";
    })
    .trim();
}

function boundedString(value: unknown, maximum: number): string {
  if (typeof value !== "string") throw new Error("Invalid crash report payload");
  return redactCrashText(value).slice(0, maximum);
}

/** Accepts only the allowlisted fields, with every string bounded and redacted. */
export function parseCrashReportPayload(value: unknown): CrashReportPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid crash report payload");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== FIELDS.length || !FIELDS.every((field) => keys.includes(field))) {
    throw new Error("Invalid crash report payload");
  }
  if (typeof record.origin !== "string" || !ORIGIN_SET.has(record.origin)) {
    throw new Error("Invalid crash report payload");
  }
  if (typeof record.fingerprint !== "string" || !/^[a-f0-9]{32}$/.test(record.fingerprint)) {
    throw new Error("Invalid crash report payload");
  }
  if (!Array.isArray(record.frames) || record.frames.length > MAXIMUM_FRAMES) {
    throw new Error("Invalid crash report payload");
  }

  const frames = record.frames.map((frame) => boundedString(frame, MAXIMUM_FRAME)).filter((frame) => frame.length > 0);
  const message = boundedString(record.message, MAXIMUM_MESSAGE);
  const name = boundedString(record.name, MAXIMUM_NAME);
  if (name.length === 0 || (message.length === 0 && frames.length === 0)) {
    throw new Error("Invalid crash report payload");
  }

  return {
    origin: record.origin as CrashReportOrigin,
    name,
    message,
    frames,
    fingerprint: record.fingerprint,
    appVersion: boundedString(record.appVersion, MAXIMUM_VERSION),
    platform: boundedString(record.platform, MAXIMUM_PLATFORM),
    osRelease: boundedString(record.osRelease, MAXIMUM_PLATFORM),
    arch: boundedString(record.arch, MAXIMUM_PLATFORM),
  };
}
