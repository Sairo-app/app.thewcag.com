import { createHash } from "node:crypto";
import { basename } from "node:path";
import type { AppSettings, CrashReportOrigin } from "../../src/shared/desktop";
import { CRASH_REPORT_ORIGINS } from "../../src/shared/desktop";

const DEFAULT_SITE = "https://app.thewcag.com";
const STATE_KEY = "crash-reports-v1";

/** Keeps a single failing loop from turning into a report storm. */
const MAXIMUM_REPORTS_PER_SESSION = 5;
/** A fingerprint already sent stays quiet for a day. */
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1_000;

const MAXIMUM_MESSAGE_LENGTH = 300;
const MAXIMUM_FRAMES = 12;
const MAXIMUM_FRAME_LENGTH = 200;

const ORIGIN_SET = new Set<string>(CRASH_REPORT_ORIGINS);

/**
 * One alternation, scanned once, so each span is classified exactly once.
 * Running the rules as separate passes lets a later rule rewrite the output of
 * an earlier one — a URL reduced to `origin/[path]` is itself path-shaped, and
 * a second pass would collapse it to a bare file name.
 *
 * Order matters: the first alternative that matches at a position wins.
 */
const REDACTABLE = new RegExp(
  [
    /file:\/\/\/\S+/, // file URL
    /[\w.+-]+@[\w-]+\.[\w.-]+/, // email address
    /https?:\/\/[^\s/]+(?:\/\S*)?/, // http(s) URL
    /(?:[A-Za-z]:)?[\\/](?:[^\s\\/:*?"<>|]+[\\/])+[^\s\\/:*?"<>|]*/, // filesystem path
    /\b[A-Za-z0-9_-]{32,}\b/, // token, key, or opaque identifier
  ]
    .map((pattern) => pattern.source)
    .join("|"),
  "g",
);

export interface CrashReport {
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

interface CrashReportState {
  /** fingerprint -> epoch milliseconds of the last accepted send. */
  sent: Record<string, number>;
}

interface SettingsReader {
  get(): Promise<AppSettings>;
}

interface StateStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface CrashReportEnvironment {
  appVersion: string;
  platform: string;
  osRelease: string;
  arch: string;
}

export interface CrashReportResult {
  attempted: boolean;
  accepted: boolean;
  reason?: "disabled" | "duplicate" | "rate-limited" | "unusable" | "unavailable";
}

/**
 * Strips anything that could identify a person, a machine, or audited work.
 *
 * Crash text routinely carries home directory paths (which contain the account
 * name), audited URLs, and occasionally a token pasted into a field. None of
 * that is needed to locate a defect, and a local-first product must not leak it
 * just because the user agreed to send diagnostics.
 */
export function redact(input: string): string {
  return input
    .replace(REDACTABLE, (match) => {
      if (match.startsWith("file://")) return safeBasename(match);
      if (/^https?:\/\//.test(match)) {
        const origin = /^https?:\/\/[^\s/]+/.exec(match)?.[0] ?? match;
        return match.length > origin.length ? `${origin}/[path]` : origin;
      }
      if (/^[\w.+-]+@/.test(match)) return "[email]";
      if (/[\\/]/.test(match)) return safeBasename(match);
      return "[redacted]";
    })
    .trim();
}

function safeBasename(value: string): string {
  const cleaned = value.replace(/^file:\/\//, "").replace(/\\/g, "/");
  const name = basename(cleaned.split("?")[0].split("#")[0]);
  return name.length > 0 ? name : "[path]";
}

/** Reduces a raw stack to redacted, length-capped frames. */
export function sanitizeStack(stack: string | undefined): string[] {
  if (typeof stack !== "string") return [];
  return stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .slice(0, MAXIMUM_FRAMES)
    .map((line) => redact(line).slice(0, MAXIMUM_FRAME_LENGTH))
    .filter((line) => line.length > 0);
}

export function fingerprintOf(name: string, message: string, frames: string[]): string {
  return createHash("sha256")
    .update([name, message, ...frames.slice(0, 3)].join("\n"))
    .digest("hex")
    .slice(0, 32);
}

/** Builds a sendable report, or null when there is nothing useful to send. */
export function buildCrashReport(
  origin: CrashReportOrigin,
  error: unknown,
  environment: CrashReportEnvironment,
): CrashReport | null {
  if (!ORIGIN_SET.has(origin)) return null;

  const source = error instanceof Error ? error : undefined;
  const rawName = source?.name ?? (typeof error === "string" ? "Error" : typeof error);
  const rawMessage = source?.message ?? (typeof error === "string" ? error : "");

  const name = redact(String(rawName)).slice(0, 100) || "Error";
  const message = redact(String(rawMessage)).slice(0, MAXIMUM_MESSAGE_LENGTH);
  const frames = sanitizeStack(source?.stack);

  // A report with neither a message nor a frame cannot point at anything.
  if (message.length === 0 && frames.length === 0) return null;

  return {
    origin,
    name,
    message,
    frames,
    fingerprint: fingerprintOf(name, message, frames),
    appVersion: environment.appVersion,
    platform: environment.platform,
    osRelease: environment.osRelease,
    arch: environment.arch,
  };
}

function normalizeState(value: unknown): CrashReportState {
  const sent = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<CrashReportState>).sent
    : undefined;
  if (!sent || typeof sent !== "object" || Array.isArray(sent)) return { sent: {} };
  const entries = Object.entries(sent as Record<string, unknown>).filter(
    (entry): entry is [string, number] =>
      typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isFinite(entry[1]),
  );
  return { sent: Object.fromEntries(entries) };
}

export class CrashReportService {
  private queue: Promise<void> = Promise.resolve();
  private sessionReports = 0;
  private readonly endpoint: URL;

  constructor(
    private readonly settings: SettingsReader,
    private readonly store: StateStore,
    private readonly environment: CrashReportEnvironment,
    site = process.env.MAIN_VITE_SITE_URL || DEFAULT_SITE,
    private readonly fetcher: typeof fetch = fetch,
    private readonly clock: () => number = Date.now,
  ) {
    this.endpoint = new URL("/api/crash-report", new URL(site).origin);
  }

  report(origin: CrashReportOrigin, error: unknown): Promise<CrashReportResult> {
    const request = this.queue.then(() => this.attempt(origin, error));
    this.queue = request.then(() => undefined, () => undefined);
    return request;
  }

  private async attempt(origin: CrashReportOrigin, error: unknown): Promise<CrashReportResult> {
    const settings = await this.settings.get().catch(() => null);
    if (!settings?.shareCrashReports) {
      return { attempted: false, accepted: false, reason: "disabled" };
    }
    if (this.sessionReports >= MAXIMUM_REPORTS_PER_SESSION) {
      return { attempted: false, accepted: false, reason: "rate-limited" };
    }

    const report = buildCrashReport(origin, error, this.environment);
    if (!report) return { attempted: false, accepted: false, reason: "unusable" };

    const now = this.clock();
    const state = normalizeState(await this.store.get<unknown>(STATE_KEY, { sent: {} }));
    const lastSent = state.sent[report.fingerprint];
    if (typeof lastSent === "number" && now - lastSent < DEDUPE_WINDOW_MS) {
      return { attempted: false, accepted: false, reason: "duplicate" };
    }

    this.sessionReports += 1;
    try {
      const response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
        signal: AbortSignal.timeout(5_000),
      });
      // Only a terminal response records the fingerprint. A server-side outage
      // leaves the crash eligible for a later session.
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        const retained = Object.fromEntries(
          Object.entries(state.sent).filter(([, at]) => now - at < DEDUPE_WINDOW_MS),
        );
        retained[report.fingerprint] = now;
        await this.store.set(STATE_KEY, { sent: retained } satisfies CrashReportState);
      }
      return response.ok
        ? { attempted: true, accepted: true }
        : { attempted: true, accepted: false, reason: "unavailable" };
    } catch {
      return { attempted: true, accepted: false, reason: "unavailable" };
    }
  }
}
