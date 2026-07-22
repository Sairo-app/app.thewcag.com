const FINDING_ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const FINDING_ID_PATTERN =
  /^WCG-F-(\d{4})(\d{2})(\d{2})-([0-9A-HJKMNP-TV-Z]{5})-([0-9A-HJKMNP-TV-Z]{5})-([0-9A-HJKMNP-TV-Z]{5})-([0-9A-HJKMNP-TV-Z]{5})-([0-9A-HJKMNP-TV-Z]{6})$/;

export const FINDING_ID_PREFIX = "WCG-F";

function utcDateStamp(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) {
    throw new Error("A valid creation time is required for a finding ID");
  }
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("");
}

function secureBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Allocate an offline-safe, immutable finding identity.
 *
 * WCG-F-YYYYMMDD identifies the namespace, entity type, and UTC creation day.
 * The final 26 Crockford Base32 characters contain 130 bits of cryptographic
 * entropy and are grouped only to make transcription and comparison easier.
 */
export function createFindingId(
  createdAt = Date.now(),
  entropy: Uint8Array = secureBytes(26),
): string {
  if (entropy.length < 26) {
    throw new Error("Finding IDs require at least 26 bytes of entropy");
  }
  const fingerprint = Array.from(
    entropy.subarray(0, 26),
    (byte) => FINDING_ID_ALPHABET[byte & 31],
  ).join("");
  return [
    FINDING_ID_PREFIX,
    utcDateStamp(createdAt),
    fingerprint.slice(0, 5),
    fingerprint.slice(5, 10),
    fingerprint.slice(10, 15),
    fingerprint.slice(15, 20),
    fingerprint.slice(20),
  ].join("-");
}

export function isFindingId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(FINDING_ID_PATTERN);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function findingIdDate(value: string): string | null {
  if (!isFindingId(value)) return null;
  const match = value.match(FINDING_ID_PATTERN);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Compact display only. Persistence, exports, and copy actions use the full ID. */
export function compactFindingId(value: string): string {
  if (!isFindingId(value)) return value;
  const parts = value.split("-");
  return `${parts.slice(0, 4).join("-")}…${parts.at(-1)}`;
}
