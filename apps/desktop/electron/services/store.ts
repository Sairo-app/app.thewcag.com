import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  createFindingId,
  isFindingId,
  parseAiFindingDraft,
  type AiFindingDraftV1,
} from "@accessibility-build/audit-contracts";
import type { Finding } from "../../src/shared/desktop";
import { normalizeFindingReferences } from "../../src/shared/finding-references";

const KEY = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_JSON_BYTES = 10 * 1024 * 1024;
const FINDINGS_KEY = /^findings(?:-aud-[a-z0-9-]{6,36})?$/;

interface FindingIdentityLedger {
  version: 1;
  /** Identity to stable internal key. Entries are append-only. */
  identities: Record<string, string>;
}

export function assertStoreKey(key: string): void {
  if (!KEY.test(key)) throw new Error("Invalid storage key");
}

export function mergeFindings(existing: Finding[], incoming: unknown): Finding[] {
  if (!Array.isArray(incoming)) return normalizeFindingReferences(existing).findings;
  const normalized = normalizeFindingReferences(existing).findings;
  const seen = new Set(normalized.map((finding) => finding.key).filter(Boolean));
  const next = [...normalized];
  for (const value of incoming) {
    if (!value || typeof value !== "object") continue;
    const finding = value as Partial<Finding>;
    if (!finding.key || seen.has(finding.key) || typeof finding.title !== "string") continue;
    seen.add(finding.key);
    const base: Finding = {
      id: isFindingId(finding.id)
        ? finding.id
        : createFindingId(
            typeof finding.createdAt === "number" ? finding.createdAt : Date.now(),
          ),
      key: finding.key,
      title: finding.title.trim().slice(0, 240),
      wcag: typeof finding.wcag === "string" ? finding.wcag.slice(0, 20) : "",
      severity: ["blocker", "major", "minor"].includes(finding.severity ?? "")
        ? finding.severity as Finding["severity"]
        : "major",
      status: ["open", "retest", "fixed", "accepted"].includes(finding.status ?? "")
        ? finding.status as Finding["status"]
        : "open",
      note: typeof finding.note === "string" ? finding.note.slice(0, 5_000) : "",
      captureId: typeof finding.captureId === "string" ? finding.captureId : undefined,
      createdAt: typeof finding.createdAt === "number" ? finding.createdAt : Date.now(),
    };
    if (typeof finding.duplicateOfId === "string" && isFindingId(finding.duplicateOfId)) {
      base.duplicateOfId = finding.duplicateOfId;
    }
    if (finding.schemaVersion === 2) {
      try {
        const draft = parseAiFindingDraft({
          schemaVersion: 1,
          title: base.title,
          description: finding.description,
          actualResult: finding.actualResult,
          expectedResult: finding.expectedResult,
          userImpact: finding.userImpact,
          affectedUsers: finding.affectedUsers,
          severity: base.severity,
          severityRationale: finding.severityRationale,
          wcag: finding.wcagMappings,
          recommendation: finding.recommendation,
          exampleFix: finding.exampleFix ?? "",
          reproductionSteps: finding.reproductionSteps,
          confidence: finding.confidence,
          fieldConfidence: finding.fieldConfidence,
          assumptions: finding.assumptions,
          manualChecks: finding.manualChecks,
          provenance: {
            source: finding.source === "ai" ? "ai" : "local",
            model: finding.provenance?.model ?? "",
            modelVersion: finding.provenance?.modelVersion ?? "",
            promptVersion: finding.provenance?.promptVersion ?? "",
            knowledgeVersion: finding.provenance?.knowledgeVersion ?? "",
            generatedAt: finding.provenance?.generatedAt ?? base.createdAt,
          },
        } satisfies Partial<AiFindingDraftV1> & Record<string, unknown>);
        Object.assign(base, {
          schemaVersion: 2,
          description: draft.description,
          actualResult: draft.actualResult,
          expectedResult: draft.expectedResult,
          userImpact: draft.userImpact,
          affectedUsers: draft.affectedUsers,
          severityRationale: draft.severityRationale,
          wcagMappings: draft.wcag,
          recommendation: draft.recommendation,
          exampleFix: draft.exampleFix,
          reproductionSteps: draft.reproductionSteps,
          evidenceId: typeof finding.evidenceId === "string" ? finding.evidenceId.slice(0, 64) : undefined,
          source: finding.source === "ai" ? "ai" : finding.source === "local" ? "local" : "manual",
          confidence: draft.confidence,
          fieldConfidence: draft.fieldConfidence,
          assumptions: draft.assumptions,
          manualChecks: draft.manualChecks,
          provenance: {
            model: draft.provenance.model,
            modelVersion: draft.provenance.modelVersion,
            promptVersion: draft.provenance.promptVersion,
            knowledgeVersion: draft.provenance.knowledgeVersion,
            generatedAt: draft.provenance.generatedAt,
          },
          modifiedAt: typeof finding.modifiedAt === "number" ? finding.modifiedAt : Date.now(),
        } satisfies Partial<Finding>);
      } catch {
        // Keep the bounded legacy fields rather than rejecting the full audit.
      }
    }
    next.push(base);
  }
  return normalizeFindingReferences(next).findings;
}

export class JsonStore {
  readonly directory: string;
  private identityQueue: Promise<void> = Promise.resolve();

  constructor(userData: string) {
    this.directory = join(userData, "store");
  }

  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  private pathFor(key: string): string {
    assertStoreKey(key);
    return join(this.directory, `${key}.json`);
  }

  async getRaw(key: string): Promise<string | null> {
    const path = this.pathFor(key);
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.getRaw(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      const path = this.pathFor(key);
      await rename(path, `${path}.corrupt-${Date.now()}`).catch(() => undefined);
      return fallback;
    }
  }

  async setRaw(key: string, json: string): Promise<void> {
    if (Buffer.byteLength(json, "utf8") > MAX_JSON_BYTES) throw new Error("Stored document is too large");
    const parsed = JSON.parse(json) as unknown;
    const contents = FINDINGS_KEY.test(key)
      ? await this.reserveFindingIdentities(parsed)
      : json;
    if (Buffer.byteLength(contents, "utf8") > MAX_JSON_BYTES) throw new Error("Stored document is too large");
    await this.atomicWrite(this.pathFor(key), contents);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.setRaw(key, JSON.stringify(value));
  }

  async addFindings(items: unknown, auditId?: string): Promise<Finding[]> {
    if (auditId && !/^aud-[a-z0-9-]{6,36}$/.test(auditId)) throw new Error("Invalid audit identifier");
    const key = auditId ? `findings-${auditId}` : "findings";
    const existing = await this.get<Finding[]>(key, []);
    const merged = mergeFindings(existing, items);
    await this.set(key, merged);
    return merged;
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  private reserveFindingIdentities(value: unknown): Promise<string> {
    if (
      !Array.isArray(value) ||
      value.some(
        (finding) =>
          !finding ||
          typeof finding !== "object" ||
          typeof (finding as Partial<Finding>).key !== "string",
      )
    ) {
      return Promise.reject(new Error("Invalid finding document"));
    }
    const findings = normalizeFindingReferences(value as Finding[]).findings;
    let output = "";
    const reservation = this.identityQueue.then(async () => {
      const path = this.pathFor("finding-identities");
      let ledger: FindingIdentityLedger;
      try {
        ledger = JSON.parse(await readFile(path, "utf8")) as FindingIdentityLedger;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        ledger = { version: 1, identities: {} };
      }
      if (
        ledger.version !== 1 ||
        !ledger.identities ||
        typeof ledger.identities !== "object" ||
        Object.entries(ledger.identities).some(
          ([id, key]) => !isFindingId(id) || typeof key !== "string" || !key,
        )
      ) {
        throw new Error("Invalid finding identity ledger");
      }
      const identities = { ...ledger.identities };
      const reserved = new Set(Object.keys(identities));
      const next = findings.map((finding) => {
        let id = finding.id;
        const owner = identities[id];
        if (owner && owner !== finding.key) {
          do id = createFindingId(finding.createdAt || Date.now());
          while (reserved.has(id));
        }
        identities[id] = finding.key;
        reserved.add(id);
        return id === finding.id ? finding : { ...finding, id };
      });
      await this.atomicWrite(
        path,
        JSON.stringify({ version: 1, identities } satisfies FindingIdentityLedger),
      );
      output = JSON.stringify(next);
    });
    this.identityQueue = reservation.catch(() => undefined);
    return reservation.then(() => output);
  }

  private async atomicWrite(path: string, contents: string | Buffer): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, contents, { mode: 0o600 });
    await rename(temp, path);
  }
}
