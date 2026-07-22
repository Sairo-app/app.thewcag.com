export const A11Y_SCAN_PROFILES = [
  "desktop",
  "mobile-320",
  "forced-colors",
  "reduced-motion",
] as const;

export type A11yScanProfile = (typeof A11Y_SCAN_PROFILES)[number];

export interface AxeTriageEntry {
  ruleId: string;
  routes: string[];
  profiles: A11yScanProfile[];
  targets: string[];
  reason: string;
  owner: string;
  issue: string;
  expiresOn: string;
}

export interface AxeTriageAllowlist {
  version: 1;
  notice: string;
  entries: AxeTriageEntry[];
}

export interface AxeSignalIdentity {
  ruleId: string;
  route: string;
  profile: A11yScanProfile;
  target: string;
}

const PROFILE_SET = new Set<string>(A11Y_SCAN_PROFILES);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(
    (entry) => typeof entry === "string" && Boolean(entry.trim()),
  );
}

export function validateAxeTriageAllowlist(
  value: unknown,
  today = new Date(),
): AxeTriageAllowlist {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The accessibility triage allowlist must be an object.");
  }
  const candidate = value as Partial<AxeTriageAllowlist>;
  if (candidate.version !== 1 || typeof candidate.notice !== "string" || !Array.isArray(candidate.entries)) {
    throw new Error("The accessibility triage allowlist must use schema version 1.");
  }
  const todayValue = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  )).getTime();

  candidate.entries.forEach((entry, index) => {
    if (
      !entry ||
      typeof entry.ruleId !== "string" ||
      !/^[a-z0-9-]{2,100}$/.test(entry.ruleId) ||
      !strings(entry.routes) ||
      entry.routes.some((route) => !route.startsWith("/")) ||
      !strings(entry.profiles) ||
      entry.profiles.some((profile) => !PROFILE_SET.has(profile)) ||
      !strings(entry.targets) ||
      typeof entry.reason !== "string" ||
      entry.reason.trim().length < 20 ||
      typeof entry.owner !== "string" ||
      !entry.owner.trim() ||
      typeof entry.issue !== "string" ||
      !/^https:\/\//.test(entry.issue) ||
      typeof entry.expiresOn !== "string" ||
      !ISO_DATE.test(entry.expiresOn)
    ) {
      throw new Error(`Accessibility triage entry ${index + 1} is incomplete or invalid.`);
    }
    const expiration = Date.parse(`${entry.expiresOn}T00:00:00.000Z`);
    if (!Number.isFinite(expiration) || expiration < todayValue) {
      throw new Error(`Accessibility triage entry ${index + 1} expired on ${entry.expiresOn}.`);
    }
  });

  return candidate as AxeTriageAllowlist;
}

export function isAxeSignalTriaged(
  signal: AxeSignalIdentity,
  allowlist: AxeTriageAllowlist,
): boolean {
  return allowlist.entries.some((entry) =>
    entry.ruleId === signal.ruleId &&
    entry.routes.includes(signal.route) &&
    entry.profiles.includes(signal.profile) &&
    entry.targets.includes(signal.target),
  );
}
