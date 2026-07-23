import { randomBytes, timingSafeEqual } from "node:crypto";
import { hostname } from "node:os";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { safeStorage, shell } from "electron";
import {
  cleanReportText,
  normalizeReportCriteria,
  parseAiFindingDraft,
  parseEvidencePacket,
  REPORT_PUBLISH_LIMITS,
  type AiFindingDraftV1,
} from "@accessibility-build/audit-contracts";
import type { Account } from "../../src/shared/desktop";
import type { JsonStore } from "./store";
import { ManagedAiHttpError } from "./managed-ai-error";

export { ManagedAiHttpError } from "./managed-ai-error";

const DEFAULT_SITE = "https://app.thewcag.com";
const MAX_IMAGE_BYTES = 4_000_000;
const CLAIM_CODE = /^[a-f0-9]{64}$/;
const DEVICE_TOKEN = /^[a-f0-9]{64}$/;
const ENTITLEMENTS_CACHE_KEY = "auth-entitlements-cache";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function safeSiteUrl(value: unknown, site: string): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.origin === site ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizePublishIssues(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, REPORT_PUBLISH_LIMITS.issues).flatMap((candidate, index) => {
    const issue = record(candidate);
    if (!issue) return [];
    const criteria = normalizeReportCriteria(issue.sc);
    const severity = cleanReportText(issue.severity, 20).toLowerCase();
    const status = cleanReportText(issue.status, 20).toLowerCase();
    return [{
      ...(typeof issue.id === "string" ? { id: issue.id } : {}),
      n: index + 1,
      ...(criteria.length ? { sc: criteria } : {}),
      label: cleanReportText(issue.label, REPORT_PUBLISH_LIMITS.issueTitleLength) || "Accessibility issue",
      severity: ["blocker", "major", "minor"].includes(severity) ? severity : "major",
      note: cleanReportText(issue.note, REPORT_PUBLISH_LIMITS.issueNoteLength),
      status: ["open", "retest", "fixed", "accepted"].includes(status) ? status : "open",
    }];
  });
}

export class AuthService {
  private readonly tokenPath: string;
  private readonly site: string;
  private readonly store: JsonStore;

  constructor(
    userData: string,
    store: JsonStore,
    site = process.env.MAIN_VITE_SITE_URL || DEFAULT_SITE,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.tokenPath = join(userData, "device-token.bin");
    this.store = store;
    this.site = new URL(site).origin;
  }

  async signIn(): Promise<void> {
    // The web connection contract uses a 128-bit, 32-character hexadecimal
    // nonce. Keep this in sync with apps/web/app/connect/validation.ts.
    const state = randomBytes(16).toString("hex");
    await this.store.set("auth-pending", { state, createdAt: Date.now() });
    const device = hostname().replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 80) || "Desktop";
    const url = new URL("/connect", this.site);
    url.searchParams.set("state", state);
    url.searchParams.set("device", device);
    await shell.openExternal(url.toString());
  }

  async handleDeepLink(raw: string): Promise<boolean> {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error("This sign-in link is invalid. Start again from the app.");
    }
    if (url.protocol !== "thewcag:" || url.hostname !== "auth") {
      throw new Error("This sign-in link is invalid. Start again from the app.");
    }
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const pending = await this.store.get<{ state?: string; createdAt?: number }>("auth-pending", {});
    const fresh = typeof pending.createdAt === "number" && Date.now() - pending.createdAt < 10 * 60 * 1000;
    if (!CLAIM_CODE.test(code)) {
      throw new Error("This sign-in link is invalid. Start again from the app.");
    }
    if (!pending.state) {
      throw new Error("No sign-in request is waiting. Start again from the app.");
    }
    if (!fresh) {
      await this.store.remove("auth-pending");
      throw new Error("This sign-in request expired. Start again from the app.");
    }
    if (!secureEqual(state, pending.state)) {
      throw new Error("This sign-in link does not match the request from this app.");
    }

    let response: Response;
    try {
      response = await this.fetcher(new URL("/api/device/claim", this.site), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new Error("The sign-in service is unavailable. Open the browser link and try again.");
    }

    const body = record(await response.json().catch(() => ({}))) ?? {};
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        await this.store.remove("auth-pending");
      }
      const message = typeof body.message === "string" ? body.message : "The device could not be connected. Try again.";
      throw new Error(message);
    }

    const token = typeof body.token === "string" ? body.token : "";
    if (!DEVICE_TOKEN.test(token)) {
      await this.store.remove("auth-pending");
      throw new Error("The sign-in service returned an invalid device credential.");
    }
    try {
      await this.saveToken(token);
    } catch (error) {
      // The server has activated the row, so revoke it if local secure storage
      // cannot retain the credential. This avoids creating an active orphan.
      await this.fetcher(new URL("/api/device/revoke", this.site), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
      await this.store.remove("auth-pending");
      throw error;
    }
    await this.store.remove("auth-pending");
    return true;
  }

  async signOut(): Promise<void> {
    const token = await this.readToken();
    try {
      if (token) {
        await this.fetcher(new URL("/api/device/revoke", this.site), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        });
      }
    } catch {
      // Local sign-out must still succeed while the service is unavailable.
    } finally {
      await Promise.all([
        rm(this.tokenPath, { force: true }),
        this.store.remove(ENTITLEMENTS_CACHE_KEY).catch(() => undefined),
      ]);
    }
  }

  async getAccount(): Promise<Account> {
    const token = await this.readToken();
    if (!token) return { signedIn: false };
    try {
      const response = await this.fetcher(new URL("/api/device/entitlements", this.site), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 401) {
        await this.signOut();
        return { signedIn: false };
      }
      if (!response.ok) return this.unavailableAccount();
      const value = await response.json();
      const account = this.accountFromEntitlements(value);
      if (!account) return this.unavailableAccount();
      await this.store.set(ENTITLEMENTS_CACHE_KEY, {
        cachedAt: Date.now(),
        value,
      }).catch(() => undefined);
      return account;
    } catch {
      return this.unavailableAccount();
    }
  }

  private accountFromEntitlements(value: unknown): Account | null {
    const payload = record(value);
    if (!payload) return null;
    const features = record(payload.features);
    const managedAi = record(features?.managedAi);
    const hostedReports = record(features?.hostedReports);
    const managedUsed = nonNegativeNumber(managedAi?.used);
    const managedLimit = nonNegativeNumber(managedAi?.limit);
    const hostedActive = nonNegativeNumber(hostedReports?.active);
    const hostedLimit = nonNegativeNumber(hostedReports?.limit);
    if (
      !features ||
      !managedAi ||
      !hostedReports ||
      managedUsed === null ||
      managedLimit === null ||
      hostedActive === null ||
      hostedLimit === null
    ) return null;

    const storage = record(payload.storage);
    const actions = record(payload.actions);
    const subscription = record(payload.subscription);
    const storageUsed = nonNegativeNumber(storage?.usedBytes);
    const storageQuota = nonNegativeNumber(storage?.quotaBytes);
    const subscriptionStatus = subscription?.status;
    const billingUrl = safeSiteUrl(actions?.billingUrl, this.site);
    return {
      signedIn: true,
      featuresState: "loaded",
      email: typeof payload.email === "string" ? payload.email : undefined,
      plan: payload.plan === "pro" ? "pro" : "free",
      features: {
        managedAi: {
          enabled: managedAi.enabled === true,
          used: managedUsed,
          limit: managedLimit,
          ...(typeof managedAi.resetsAt === "string" ? { resetsAt: managedAi.resetsAt } : {}),
        },
        hostedReports: {
          enabled: hostedReports.enabled === true,
          active: hostedActive,
          limit: hostedLimit,
        },
        whiteLabelReports: features.whiteLabelReports === true,
        reportAnalytics: features.reportAnalytics === true,
        publishReports: features.publishReports === true,
        aiFindingDrafts: features.aiFindingDrafts === true,
      },
      ...(storageUsed !== null && storageQuota !== null
        ? { storage: { usedBytes: storageUsed, quotaBytes: storageQuota } }
        : {}),
      ...(actions ? {
        actions: {
          canUpgrade: actions.canUpgrade === true,
          canManageBilling: actions.canManageBilling === true,
          upgradeUrl:
            safeSiteUrl(actions.upgradeUrl, this.site) ??
            new URL("/pricing", this.site).toString(),
          ...(billingUrl ? { billingUrl } : {}),
        },
      } : {}),
      ...(subscription && ["none", "pending", "active", "on_hold", "cancelled", "failed", "expired", "revoked"].includes(String(subscriptionStatus)) ? {
        subscription: {
          status: subscriptionStatus as NonNullable<Account["subscription"]>["status"],
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd === true,
          ...(typeof subscription.renewsAt === "string" ? { renewsAt: subscription.renewsAt } : {}),
          ...(typeof subscription.endsAt === "string" ? { endsAt: subscription.endsAt } : {}),
          ...(typeof subscription.graceEndsAt === "string" ? { graceEndsAt: subscription.graceEndsAt } : {}),
        },
      } : {}),
    };
  }

  private async unavailableAccount(): Promise<Account> {
    const cached: { cachedAt?: number; value?: unknown } = await this.store.get<{
      cachedAt?: number;
      value?: unknown;
    }>(ENTITLEMENTS_CACHE_KEY, {}).catch(() => ({} as {
      cachedAt?: number;
      value?: unknown;
    }));
    const account = this.accountFromEntitlements(cached.value);
    return account
      ? { ...account, featuresState: "unavailable" }
      : { signedIn: true, featuresState: "unavailable" };
  }

  async publish(payload: unknown): Promise<string> {
    const token = await this.readToken();
    if (!token) throw new Error("Sign in before publishing a report");
    if (!payload || typeof payload !== "object") throw new Error("Invalid report payload");
    const value = payload as Record<string, unknown>;
    const imageBase64 = typeof value.imageBase64 === "string" ? value.imageBase64 : "";
    if (!imageBase64 || imageBase64.length > REPORT_PUBLISH_LIMITS.imageBase64Length) throw new Error("The report image is too large");
    const imageBytes = Buffer.from(imageBase64, "base64");
    if (imageBytes.length < 8 || imageBytes.length > MAX_IMAGE_BYTES || imageBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      throw new Error("The report must contain a PNG image smaller than 4 MB");
    }
    const requestBody = {
      title: cleanReportText(value.title, REPORT_PUBLISH_LIMITS.titleLength) || "Accessibility report",
      description: cleanReportText(value.description, REPORT_PUBLISH_LIMITS.descriptionLength),
      issues: normalizePublishIssues(value.issues),
      imageBase64,
    };
    const serializedBody = JSON.stringify(requestBody);
    if (Buffer.byteLength(serializedBody, "utf8") > REPORT_PUBLISH_LIMITS.requestBytes) {
      throw new Error("This report is too large to publish. Shorten finding notes or use a smaller screenshot, then try again.");
    }
    const response = await this.fetcher(new URL("/api/device/screenshots", this.site), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: serializedBody,
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 401) {
      await this.signOut();
      throw new Error("Your session expired. Sign in again to publish");
    }
    const body = await response.json().catch(() => ({})) as { url?: string; message?: string; error?: string };
    if (!response.ok) throw new Error(body.message || body.error || `Publishing failed with status ${response.status}`);
    if (!body.url || new URL(body.url).protocol !== "https:") throw new Error("The publishing service returned an invalid URL");
    return body.url;
  }

  async generateFinding(rawEvidence: unknown): Promise<AiFindingDraftV1> {
    const token = await this.readToken();
    if (!token) throw new Error("Sign in to TheWCAG before using AI authoring");
    const evidence = parseEvidencePacket(rawEvidence);
    if (!evidence.consent?.approvedAt) throw new Error("Review and approve the evidence before AI authoring");
    const response = await this.fetcher(new URL("/api/device/ai/findings", this.site), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ evidence }),
      signal: AbortSignal.timeout(55_000),
    });
    const body = await response.json().catch(() => ({})) as {
      draft?: unknown;
      message?: string;
      error?: string;
      retryAfterSeconds?: number;
    };
    if (!response.ok) {
      if (response.status === 401) await this.signOut();
      const fallback = response.status === 401
        ? "Your session expired. Sign in again to use AI authoring"
        : response.status === 402
          ? "Managed AI authoring requires Pro. Local drafts and your own AI key remain available"
          : response.status === 429
            ? "AI authoring limit reached. Try again later"
            : response.status === 503
              ? "AI authoring is not configured yet"
              : `AI authoring failed with status ${response.status}`;
      throw new ManagedAiHttpError(
        response.status,
        body.message || body.error || fallback,
        nonNegativeNumber(body.retryAfterSeconds) ?? undefined,
      );
    }
    return parseAiFindingDraft(body.draft);
  }

  private async saveToken(token: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure credential storage is unavailable");
    await writeFile(this.tokenPath, safeStorage.encryptString(token), { mode: 0o600 });
  }

  private async readToken(): Promise<string | null> {
    let encrypted: Buffer;
    try {
      // Check for a saved session before touching safeStorage. On macOS,
      // querying safeStorage can involve Keychain, which should never happen
      // on a fresh install or while the user is signed out.
      encrypted = await readFile(this.tokenPath);
    } catch {
      return null;
    }
    try {
      if (!safeStorage.isEncryptionAvailable()) return null;
      return safeStorage.decryptString(encrypted);
    } catch {
      return null;
    }
  }
}
