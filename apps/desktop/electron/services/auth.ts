import { randomBytes, timingSafeEqual } from "node:crypto";
import { hostname } from "node:os";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { safeStorage, shell } from "electron";
import {
  parseAiFindingDraft,
  parseEvidencePacket,
  type AiFindingDraftV1,
} from "@accessibility-build/audit-contracts";
import type { Account } from "../../src/shared/desktop";
import type { JsonStore } from "./store";

const DEFAULT_SITE = "https://app.thewcag.com";
const MAX_IMAGE_BYTES = 4_000_000;

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class AuthService {
  private readonly tokenPath: string;
  private readonly site: string;
  private readonly store: JsonStore;

  constructor(userData: string, store: JsonStore, site = process.env.MAIN_VITE_SITE_URL || DEFAULT_SITE) {
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
      return false;
    }
    if (url.protocol !== "thewcag:" || url.hostname !== "auth") return false;
    const token = url.searchParams.get("token") || "";
    const state = url.searchParams.get("state") || "";
    const pending = await this.store.get<{ state?: string; createdAt?: number }>("auth-pending", {});
    const fresh = typeof pending.createdAt === "number" && Date.now() - pending.createdAt < 10 * 60 * 1000;
    if (!token || token.length > 4_096 || !pending.state || !fresh || !secureEqual(state, pending.state)) return false;
    await this.saveToken(token);
    await this.store.remove("auth-pending");
    return true;
  }

  async signOut(): Promise<void> {
    await rm(this.tokenPath, { force: true });
  }

  async getAccount(): Promise<Account> {
    const token = await this.readToken();
    if (!token) return { signedIn: false };
    try {
      const response = await fetch(new URL("/api/device/entitlements", this.site), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 401) {
        await this.signOut();
        return { signedIn: false };
      }
      if (!response.ok) return { signedIn: true };
      const value = await response.json() as Partial<Account>;
      return {
        signedIn: true,
        email: typeof value.email === "string" ? value.email : undefined,
        credits: typeof value.credits === "number" ? value.credits : undefined,
        plan: typeof value.plan === "string" ? value.plan : undefined,
      };
    } catch {
      return { signedIn: true };
    }
  }

  async publish(payload: unknown): Promise<string> {
    const token = await this.readToken();
    if (!token) throw new Error("Sign in before publishing a report");
    if (!payload || typeof payload !== "object") throw new Error("Invalid report payload");
    const value = payload as Record<string, unknown>;
    const imageBase64 = typeof value.imageBase64 === "string" ? value.imageBase64 : "";
    if (!imageBase64 || imageBase64.length > 5_400_000) throw new Error("The report image is too large");
    const imageBytes = Buffer.from(imageBase64, "base64");
    if (imageBytes.length < 8 || imageBytes.length > MAX_IMAGE_BYTES || imageBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      throw new Error("The report must contain a PNG image smaller than 4 MB");
    }
    const requestBody = {
      title: typeof value.title === "string" ? value.title.trim().slice(0, 160) : "Accessibility report",
      description: typeof value.description === "string" ? value.description.trim().slice(0, 2_000) : "",
      issues: Array.isArray(value.issues) ? value.issues.slice(0, 100) : [],
      imageBase64,
    };
    const response = await fetch(new URL("/api/device/screenshots", this.site), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
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
    const response = await fetch(new URL("/api/device/ai/findings", this.site), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ evidence }),
      signal: AbortSignal.timeout(55_000),
    });
    if (response.status === 401) {
      await this.signOut();
      throw new Error("Your session expired. Sign in again to use AI authoring");
    }
    const body = await response.json().catch(() => ({})) as {
      draft?: unknown;
      message?: string;
      error?: string;
      retryAfterSeconds?: number;
    };
    if (!response.ok) {
      if (response.status === 429) throw new Error(body.message || "AI authoring limit reached. Try again later");
      if (response.status === 503) throw new Error(body.message || "AI authoring is not configured yet");
      throw new Error(body.message || body.error || `AI authoring failed with status ${response.status}`);
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
