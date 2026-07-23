import { watch } from "node:fs";
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  createFindingId,
  isFindingId,
  parseAiFindingDraft,
  type AiFindingDraftV1,
} from "@accessibility-build/audit-contracts";
import type { Finding, FindingMutation } from "../../src/shared/desktop";
import { normalizeFindingReferences } from "../../src/shared/finding-references";

const KEY = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_JSON_BYTES = 10 * 1024 * 1024;
const FINDINGS_KEY = /^(?:findings(?:-aud-[a-z0-9-]{6,36})?|standalone-findings)$/;
const FINDINGS_LOCK = ".findings-write.lock";
const FINDINGS_LOCK_TIMEOUT_MS = 10_000;
const FINDINGS_LOCK_STALE_MS = 30_000;
const EVIDENCE_FILE = /^evidence-([a-zA-Z0-9_-]{1,55})\.json$/;
const EVIDENCE_SWEEP_GRACE_MS = 10 * 60 * 1_000;

interface FindingIdentityLedger {
  version: 1;
  /** Identity to stable internal key. Entries are append-only. */
  identities: Record<string, string>;
}

export function assertStoreKey(key: string): void {
  if (!KEY.test(key)) throw new Error("Invalid storage key");
}

export interface StoreQuarantineEvent {
  key: string;
  backupPath: string;
  message: string;
}

export interface EvidenceSweepOptions {
  minimumAgeMs?: number;
  now?: number;
}

export function isFindingsStoreKey(key: string): boolean {
  return FINDINGS_KEY.test(key);
}

function findingDocument(value: unknown): Finding[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (finding) =>
        !finding ||
        typeof finding !== "object" ||
        typeof (finding as Partial<Finding>).key !== "string" ||
        !(finding as Partial<Finding>).key,
    )
  ) {
    throw new Error("Invalid finding document");
  }
  return normalizeFindingReferences(value as Finding[]).findings;
}

function mergeFindingDocument(existing: Finding[], incoming: Finding[]): Finding[] {
  const incomingKeys = new Set(incoming.map((finding) => finding.key));
  return normalizeFindingReferences([
    ...incoming,
    ...existing.filter((finding) => !incomingKeys.has(finding.key)),
  ]).findings;
}

function safePatch(value: unknown): Partial<Omit<Finding, "id" | "key">> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid finding patch");
  }
  const patch: Record<string, unknown> = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (["id", "key", "__proto__", "prototype", "constructor"].includes(field)) continue;
    patch[field] = fieldValue;
  }
  return patch as Partial<Omit<Finding, "id" | "key">>;
}

function findingMutations(value: unknown): FindingMutation[] {
  if (!Array.isArray(value) || value.length > 10_000) {
    throw new Error("Invalid finding mutations");
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Invalid finding mutation");
    }
    const mutation = entry as Record<string, unknown>;
    if (mutation.type === "put") {
      return { type: "put", finding: findingDocument([mutation.finding])[0] };
    }
    if (mutation.type !== "patch" && mutation.type !== "remove") {
      throw new Error("Invalid finding mutation type");
    }
    if (typeof mutation.key !== "string" || !mutation.key) {
      throw new Error("Invalid finding mutation key");
    }
    const identity = {
      key: mutation.key,
      ...(typeof mutation.id === "string" && mutation.id ? { id: mutation.id } : {}),
    };
    if (mutation.type === "remove") return { type: "remove", ...identity };
    const unset = Array.isArray(mutation.unset)
      ? mutation.unset.filter(
          (field): field is Exclude<keyof Finding, "id" | "key"> =>
            typeof field === "string" &&
            !["id", "key", "__proto__", "prototype", "constructor"].includes(field),
        )
      : undefined;
    return {
      type: "patch",
      ...identity,
      patch: safePatch(mutation.patch),
      ...(unset?.length ? { unset } : {}),
    };
  });
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
      wcag: typeof finding.wcag === "string" ? finding.wcag.slice(0, 160) : "",
      severity: ["blocker", "major", "minor"].includes(finding.severity ?? "")
        ? finding.severity as Finding["severity"]
        : "major",
      status: ["open", "retest", "fixed", "accepted"].includes(finding.status ?? "")
        ? finding.status as Finding["status"]
        : "open",
      reviewState: finding.reviewState === "pending" ? "pending" : "reviewed",
      note: typeof finding.note === "string" ? finding.note.slice(0, 5_000) : "",
      location: typeof finding.location === "string" ? finding.location.slice(0, 2_048) : "",
      evidenceCaptureIds: Array.isArray(finding.evidenceCaptureIds)
        ? [...new Set(finding.evidenceCaptureIds)]
            .filter((captureId): captureId is string => typeof captureId === "string" && Boolean(captureId.trim()))
            .slice(0, 100)
        : typeof finding.captureId === "string"
          ? [finding.captureId]
          : undefined,
      captureId: typeof finding.captureId === "string" ? finding.captureId : undefined,
      statusHistory: Array.isArray(finding.statusHistory)
        ? finding.statusHistory
            .filter((entry) =>
              Boolean(entry) &&
              ["open", "retest", "fixed", "accepted"].includes(entry.status) &&
              typeof entry.changedAt === "number" &&
              Number.isFinite(entry.changedAt),
            )
            .slice(-5_000)
            .map((entry) => ({ status: entry.status, changedAt: entry.changedAt }))
        : undefined,
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
  private readonly quarantineListeners = new Set<(event: StoreQuarantineEvent) => void>();

  constructor(userData: string) {
    this.directory = join(userData, "store");
  }

  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  /** Removes evidence packets no finding document references anymore. */
  async sweepOrphanedEvidence(
    options: EvidenceSweepOptions = {},
  ): Promise<string[]> {
    const minimumAgeMs = options.minimumAgeMs ?? EVIDENCE_SWEEP_GRACE_MS;
    const now = options.now ?? Date.now();
    return this.withFindingsLock(async () => {
      const entries = await readdir(this.directory, { withFileTypes: true });
      const referenced = new Set<string>();
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const key = entry.name.slice(0, -5);
        if (!isFindingsStoreKey(key)) continue;
        let findings: unknown;
        try {
          findings = JSON.parse(
            await readFile(join(this.directory, entry.name), "utf8"),
          ) as unknown;
        } catch {
          // A damaged findings file may still be the only pointer to evidence.
          // Quarantine handles it on normal read; the privacy sweep stays safe.
          return [];
        }
        if (!Array.isArray(findings)) return [];
        for (const finding of findings) {
          const evidenceId =
            finding && typeof finding === "object"
              ? (finding as Partial<Finding>).evidenceId
              : undefined;
          if (
            typeof evidenceId === "string" &&
            /^[a-zA-Z0-9_-]{1,55}$/.test(evidenceId)
          ) {
            referenced.add(`evidence-${evidenceId}`);
          }
        }
      }

      const removed: string[] = [];
      for (const entry of entries) {
        const match = entry.isFile() ? entry.name.match(EVIDENCE_FILE) : null;
        if (!match) continue;
        const key = entry.name.slice(0, -5);
        if (referenced.has(key)) continue;
        const path = join(this.directory, entry.name);
        const metadata = await stat(path).catch(() => null);
        if (!metadata || now - metadata.mtimeMs < minimumAgeMs) continue;
        await rm(path, { force: true });
        removed.push(key);
      }
      return removed;
    });
  }

  onQuarantine(listener: (event: StoreQuarantineEvent) => void): () => void {
    this.quarantineListeners.add(listener);
    return () => this.quarantineListeners.delete(listener);
  }

  private pathFor(key: string): string {
    assertStoreKey(key);
    return join(this.directory, `${key}.json`);
  }

  async getRaw(key: string): Promise<string | null> {
    const path = this.pathFor(key);
    try {
      const raw = await readFile(path, "utf8");
      try {
        JSON.parse(raw);
        return raw;
      } catch {
        await this.quarantine(key, path);
        return null;
      }
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
      await this.quarantine(key, path);
      return fallback;
    }
  }

  async setRaw(key: string, json: string): Promise<void> {
    if (Buffer.byteLength(json, "utf8") > MAX_JSON_BYTES) throw new Error("Stored document is too large");
    const parsed = JSON.parse(json) as unknown;
    if (isFindingsStoreKey(key)) {
      const incoming = findingDocument(parsed);
      await this.withFindingsLock(async () => {
        const existing = await this.readFindingDocument(key);
        // Compatibility callers may still hold a stale full snapshot. Missing
        // on-disk records are additions from another process, not deletions.
        await this.writeFindingDocument(key, mergeFindingDocument(existing, incoming));
      });
      return;
    }
    if (key === "finding-identities") {
      await this.withFindingsLock(() => this.atomicWrite(this.pathFor(key), json));
      return;
    }
    await this.atomicWrite(this.pathFor(key), json);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.setRaw(key, JSON.stringify(value));
  }

  async addFindings(items: unknown, auditId?: string): Promise<Finding[]> {
    if (auditId && !/^aud-[a-z0-9-]{6,36}$/.test(auditId)) throw new Error("Invalid audit identifier");
    const key = auditId ? `findings-${auditId}` : "findings";
    return this.withFindingsLock(async () => {
      const existing = await this.readFindingDocument(key);
      return this.writeFindingDocument(key, mergeFindings(existing, items));
    });
  }

  async mutateFindings(key: string, value: unknown): Promise<Finding[]> {
    if (!isFindingsStoreKey(key)) throw new Error("Invalid findings storage key");
    const mutations = findingMutations(value);
    return this.withFindingsLock(async () => {
      const next = await this.readFindingDocument(key);
      for (const mutation of mutations) {
        if (mutation.type === "put") {
          const index = next.findIndex((finding) => finding.key === mutation.finding.key);
          if (index < 0) next.push(mutation.finding);
          else next[index] = mutation.finding;
          continue;
        }
        const index = next.findIndex(
          (finding) => finding.key === mutation.key || Boolean(mutation.id && finding.id === mutation.id),
        );
        if (mutation.type === "remove") {
          if (index >= 0) next.splice(index, 1);
          continue;
        }
        if (index < 0) throw new Error(`Finding ${mutation.key} no longer exists`);
        const current = next[index];
        const updated: Finding = { ...current, ...mutation.patch, id: current.id, key: current.key };
        for (const field of mutation.unset ?? []) delete (updated as unknown as Record<string, unknown>)[field];
        next[index] = updated;
      }
      return this.writeFindingDocument(key, normalizeFindingReferences(next).findings);
    });
  }

  async remove(key: string): Promise<void> {
    if (isFindingsStoreKey(key) || key === "finding-identities") {
      await this.withFindingsLock(() => rm(this.pathFor(key), { force: true }));
      return;
    }
    await rm(this.pathFor(key), { force: true });
  }

  watchFindings(listener: (key: string | null) => void): () => void {
    const pending = new Map<string, NodeJS.Timeout>();
    const schedule = (key: string | null) => {
      const token = key ?? "*";
      const prior = pending.get(token);
      if (prior) clearTimeout(prior);
      pending.set(token, setTimeout(() => {
        pending.delete(token);
        listener(key);
      }, 40));
    };
    const watcher = watch(this.directory, { persistent: false }, (_event, filename) => {
      if (!filename) {
        schedule(null);
        return;
      }
      const name = filename.toString();
      if (!name.endsWith(".json")) return;
      const key = name.slice(0, -5);
      if (isFindingsStoreKey(key)) schedule(key);
    });
    watcher.on("error", () => undefined);
    return () => {
      watcher.close();
      for (const timeout of pending.values()) clearTimeout(timeout);
      pending.clear();
    };
  }

  private async readFindingDocument(key: string): Promise<Finding[]> {
    const raw = await this.getRaw(key);
    if (!raw) return [];
    try {
      return findingDocument(JSON.parse(raw) as unknown);
    } catch {
      throw new Error(`Invalid finding document for ${key}`);
    }
  }

  private async writeFindingDocument(key: string, findings: Finding[]): Promise<Finding[]> {
    const reserved = await this.reserveFindingIdentities(findings);
    const contents = JSON.stringify(reserved);
    if (Buffer.byteLength(contents, "utf8") > MAX_JSON_BYTES) throw new Error("Stored document is too large");
    await this.atomicWrite(this.pathFor(key), contents);
    return reserved;
  }

  private async reserveFindingIdentities(findings: Finding[]): Promise<Finding[]> {
    const path = this.pathFor("finding-identities");
    const ledger = await this.readOrRebuildIdentityLedger(path);
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
    return next;
  }

  private async readOrRebuildIdentityLedger(path: string): Promise<FindingIdentityLedger> {
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return this.rebuildIdentityLedger();
      }
      throw error;
    }
    try {
      const ledger = JSON.parse(raw) as FindingIdentityLedger;
      if (
        ledger.version !== 1 ||
        !ledger.identities ||
        typeof ledger.identities !== "object" ||
        Array.isArray(ledger.identities) ||
        Object.entries(ledger.identities).some(
          ([id, key]) => !isFindingId(id) || typeof key !== "string" || !key,
        )
      ) {
        throw new Error("Invalid finding identity ledger");
      }
      return ledger;
    } catch {
      await this.quarantine("finding-identities", path);
      return this.rebuildIdentityLedger();
    }
  }

  private async rebuildIdentityLedger(): Promise<FindingIdentityLedger> {
    const identities: Record<string, string> = {};
    const entries = await readdir(this.directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const key = entry.name.slice(0, -5);
      if (!isFindingsStoreKey(key)) continue;
      const path = this.pathFor(key);
      let stored: unknown;
      try {
        stored = JSON.parse(await readFile(path, "utf8")) as unknown;
        if (
          !Array.isArray(stored) ||
          stored.some(
            (finding) =>
              !finding ||
              typeof finding !== "object" ||
              typeof (finding as Partial<Finding>).key !== "string" ||
              !(finding as Partial<Finding>).key,
          )
        ) {
          throw new Error("Invalid finding document");
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        await this.quarantine(key, path);
        continue;
      }
      for (const finding of stored as Array<Partial<Finding>>) {
        if (!isFindingId(finding.id) || typeof finding.key !== "string" || !finding.key) continue;
        identities[finding.id] ??= finding.key;
      }
    }
    return { version: 1, identities };
  }

  private async quarantine(key: string, path: string): Promise<string | null> {
    const backupPath = `${path}.corrupt-${Date.now()}`;
    try {
      await rename(path, backupPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    const event: StoreQuarantineEvent = {
      key,
      backupPath,
      message: `Stored data was damaged; backup kept at ${backupPath}`,
    };
    for (const listener of this.quarantineListeners) {
      try {
        listener(event);
      } catch {
        // Recovery must not fail because a notification listener failed.
      }
    }
    return backupPath;
  }

  private async withFindingsLock<T>(action: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, FINDINGS_LOCK);
    const startedAt = Date.now();
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    while (!handle) {
      try {
        // Exclusive file creation is shared by the Electron main process and
        // the separate native-messaging process; an in-memory queue is not.
        handle = await open(path, "wx", 0o600);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // Windows can report EPERM, rather than EEXIST, while another process
        // still has the exclusively-created lock file open. That process may
        // delete the lock before our follow-up stat, so a missing file is also
        // retryable. Persistent permission failures remain bounded by the lock
        // timeout instead of escaping the cross-process serialization path.
        if (code !== "EEXIST" && code !== "EPERM") throw error;
        const lockStat = await stat(path).catch(() => null);
        if (lockStat && Date.now() - lockStat.mtimeMs > FINDINGS_LOCK_STALE_MS) {
          await rm(path, { force: true }).catch(() => undefined);
          continue;
        }
        if (Date.now() - startedAt >= FINDINGS_LOCK_TIMEOUT_MS) {
          throw new Error("Timed out waiting for the findings store lock");
        }
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    }
    try {
      return await action();
    } finally {
      await handle.close().catch(() => undefined);
      await rm(path, { force: true }).catch(() => undefined);
    }
  }

  private async atomicWrite(path: string, contents: string | Buffer): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, contents, { mode: 0o600 });
    await rename(temp, path);
  }
}
