import { describe, expect, it } from "vitest";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertStoreKey, isFindingsStoreKey, JsonStore, mergeFindings } from "./store";

describe("desktop storage validation", () => {
  it("accepts filename-safe keys and rejects traversal", () => {
    expect(() => assertStoreKey("audit-brief_2")).not.toThrow();
    expect(() => assertStoreKey("../token")).toThrow();
    expect(() => assertStoreKey("")).toThrow();
  });

  it("merges new findings without overwriting triage", () => {
    const existing = [{
      id: "WCG-F-20260722-00000-00000-00000-00000-000005",
      key: "cap-1:1",
      title: "Existing",
      wcag: "1.4.3",
      severity: "major" as const,
      status: "fixed" as const,
      note: "triaged",
      createdAt: 1,
    }];
    const result = mergeFindings(existing, [
      { ...existing[0], status: "open" },
      { key: "cap-2:1", title: "New", severity: "minor" },
      { key: "cap-2:1", title: "Duplicate" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("fixed");
    expect(result[0].reference).toBe("F-001");
    expect(result[1].reference).toBe("F-002");
    expect(result[1].key).toBe("cap-2:1");
  });

  it("preserves the bounded review state and traceability of browser intake", () => {
    const result = mergeFindings([], [{
      key: "browser-finding",
      title: "Button has no accessible name",
      wcag: "4.1.2",
      severity: "major",
      status: "open",
      reviewState: "pending",
      note: "Queued for review",
      location: "https://example.com/checkout",
      evidenceCaptureIds: ["cap-browser-12345678"],
      captureId: "cap-browser-12345678",
      statusHistory: [{ status: "open", changedAt: 42 }],
      createdAt: 42,
    }]);

    expect(result[0]).toMatchObject({
      reviewState: "pending",
      location: "https://example.com/checkout",
      evidenceCaptureIds: ["cap-browser-12345678"],
      captureId: "cap-browser-12345678",
      statusHistory: [{ status: "open", changedAt: 42 }],
    });
  });

  it("keeps findings isolated by audit", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-store-"));
    try {
      const store = new JsonStore(directory);
      await store.addFindings([{ key: "finding-a", title: "Audit A issue" }], "aud-a1234567");
      await store.addFindings([{ key: "finding-b", title: "Audit B issue" }], "aud-b1234567");
      expect(await store.get("findings-aud-a1234567", [])).toHaveLength(1);
      expect(await store.get("findings-aud-b1234567", [])).toHaveLength(1);
      expect(await store.get("findings", [])).toHaveLength(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("treats standalone findings as a lock-protected finding document", () => {
    expect(isFindingsStoreKey("standalone-findings")).toBe(true);
    expect(isFindingsStoreKey("standalone:findings")).toBe(false);
  });

  it("keeps the complete bounded multi-criterion display string", () => {
    const wcag = "1.4.3, 4.1.2, 2.4.7, 2.4.11";
    const [finding] = mergeFindings([], [{
      key: "multi-criterion",
      title: "Finding with several mappings",
      wcag,
    }]);

    expect(finding.wcag).toBe(wcag);
  });

  it("merges an on-disk extension finding into a stale full-document write", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-two-writers-"));
    try {
      const rendererStore = new JsonStore(directory);
      const nativeHostStore = new JsonStore(directory);
      const key = "findings-aud-race1234";
      await rendererStore.set(key, [{
        id: "WCG-F-20260722-00000-00000-00000-00000-000011",
        key: "existing-finding",
        title: "Existing finding",
        wcag: "1.4.3",
        severity: "major",
        status: "open",
        note: "",
        createdAt: 1_800_000_000_000,
      } satisfies import("../../src/shared/desktop").Finding]);
      const staleRendererSnapshot = await rendererStore.get<import("../../src/shared/desktop").Finding[]>(key, []);

      await nativeHostStore.addFindings([{
        key: "extension-finding",
        title: "Queued by the browser extension",
        wcag: "4.1.2",
        severity: "major",
        status: "open",
        reviewState: "pending",
        note: "",
        createdAt: 1_800_000_000_100,
      }], "aud-race1234");
      await rendererStore.set(key, [{ ...staleRendererSnapshot[0], status: "fixed" }]);

      const saved = await rendererStore.get<import("../../src/shared/desktop").Finding[]>(key, []);
      expect(saved).toHaveLength(2);
      expect(saved.find((finding) => finding.key === "existing-finding")?.status).toBe("fixed");
      expect(saved.find((finding) => finding.key === "extension-finding")).toMatchObject({
        title: "Queued by the browser extension",
        reviewState: "pending",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps an extension finding when a stale renderer applies a keyed status patch", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-keyed-race-"));
    try {
      const rendererStore = new JsonStore(directory);
      const nativeHostStore = new JsonStore(directory);
      const key = "findings-aud-patch123";
      await rendererStore.addFindings([{
        key: "finding-being-edited",
        title: "Finding being edited",
        status: "open",
      }], "aud-patch123");
      const [staleFinding] = await rendererStore.get<import("../../src/shared/desktop").Finding[]>(key, []);

      await nativeHostStore.addFindings([{
        key: "extension-queued",
        title: "Extension queued finding",
        reviewState: "pending",
      }], "aud-patch123");
      await nativeHostStore.mutateFindings(key, [{
        type: "patch",
        key: staleFinding.key,
        id: staleFinding.id,
        patch: { note: "Updated by another writer" },
      }]);
      const saved = await rendererStore.mutateFindings(key, [{
        type: "patch",
        key: staleFinding.key,
        id: staleFinding.id,
        patch: { status: "fixed", modifiedAt: 1_800_000_000_200 },
      }]);

      expect(saved).toHaveLength(2);
      expect(saved.find((finding) => finding.key === staleFinding.key)?.status).toBe("fixed");
      expect(saved.find((finding) => finding.key === staleFinding.key)?.note).toBe("Updated by another writer");
      expect(saved.find((finding) => finding.key === "extension-queued")?.reviewState).toBe("pending");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes identity reservations across independent store instances", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-identity-race-"));
    try {
      const firstProcess = new JsonStore(directory);
      const secondProcess = new JsonStore(directory);
      const sharedId = "WCG-F-20260722-00000-00000-00000-00000-000013";
      const [first, second] = await Promise.all([
        firstProcess.addFindings([{
          id: sharedId,
          key: "first-process-finding",
          title: "First process",
          createdAt: 1_800_000_000_000,
        }], "aud-first1234"),
        secondProcess.addFindings([{
          id: sharedId,
          key: "second-process-finding",
          title: "Second process",
          createdAt: 1_800_000_000_000,
        }], "aud-second123"),
      ]);

      expect(new Set([first[0].id, second[0].id]).size).toBe(2);
      const ledger = await firstProcess.get<{ identities: Record<string, string> }>(
        "finding-identities",
        { identities: {} },
      );
      expect(Object.values(ledger.identities)).toEqual(expect.arrayContaining([
        "first-process-finding",
        "second-process-finding",
      ]));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("notifies the running process when another process changes findings", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-findings-watch-"));
    let stop: () => void = () => undefined;
    try {
      const runningAppStore = new JsonStore(directory);
      const nativeHostStore = new JsonStore(directory);
      await runningAppStore.initialize();
      const changed = new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => resolve("timeout"), 2_000);
        stop = runningAppStore.watchFindings((key) => {
          clearTimeout(timeout);
          resolve(key);
        });
      });

      await nativeHostStore.addFindings([{
        key: "watched-extension-finding",
        title: "Written by the native host",
      }], "aud-watch1234");

      await expect(changed).resolves.toBe("findings-aud-watch1234");
    } finally {
      stop();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("never reuses an identity for a different finding key", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-identities-"));
    try {
      const store = new JsonStore(directory);
      const id = "WCG-F-20260722-00000-00000-00000-00000-000007";
      await store.set("findings-aud-first111", [{
        id,
        key: "finding-one",
        title: "First",
        wcag: "1.1.1",
        severity: "major",
        status: "open",
        note: "",
        createdAt: 1_800_000_000_000,
      } satisfies import("../../src/shared/desktop").Finding]);
      await store.remove("findings-aud-first111");
      await store.set("findings-aud-second22", [{
        id,
        key: "finding-two",
        title: "Second",
        wcag: "1.1.1",
        severity: "major",
        status: "open",
        note: "",
        createdAt: 1_800_000_000_000,
      } satisfies import("../../src/shared/desktop").Finding]);

      const [second] = await store.get<import("../../src/shared/desktop").Finding[]>(
        "findings-aud-second22",
        [],
      );
      expect(second.id).not.toBe(id);
      expect(second.id).toMatch(/^WCG-F-20270115-/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ["truncated JSON", "{\"version\":1,"],
    ["an invalid shape", JSON.stringify({ version: 1, identities: { "not-an-id": "finding-one" } })],
  ])("quarantines %s in the identity ledger and rebuilds it from stored findings", async (_case, damagedLedger) => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-ledger-"));
    try {
      const store = new JsonStore(directory);
      await store.initialize();
      const quarantineEvents: import("./store").StoreQuarantineEvent[] = [];
      store.onQuarantine((event) => quarantineEvents.push(event));
      const [first] = await store.addFindings(
        [{ key: "finding-one", title: "First" }],
        "aud-ledger111",
      );
      await writeFile(join(store.directory, "finding-identities.json"), damagedLedger, "utf8");

      const [second] = await store.addFindings(
        [{ key: "finding-two", title: "Second" }],
        "aud-ledger222",
      );

      const ledger = await store.get<{ version: 1; identities: Record<string, string> }>(
        "finding-identities",
        { version: 1, identities: {} },
      );
      expect(ledger.identities[first.id]).toBe("finding-one");
      expect(ledger.identities[second.id]).toBe("finding-two");
      expect(quarantineEvents).toHaveLength(1);
      expect(quarantineEvents[0]).toMatchObject({ key: "finding-identities" });
      await expect(access(quarantineEvents[0].backupPath)).resolves.toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("emits a user-visible notification when a corrupt findings file is quarantined", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-corrupt-findings-"));
    try {
      const store = new JsonStore(directory);
      await store.initialize();
      const quarantineEvents: import("./store").StoreQuarantineEvent[] = [];
      store.onQuarantine((event) => quarantineEvents.push(event));
      const key = "findings-aud-corrupt1";
      await writeFile(join(store.directory, `${key}.json`), "[{", "utf8");

      await expect(store.get(key, [])).resolves.toEqual([]);

      expect(quarantineEvents).toHaveLength(1);
      expect(quarantineEvents[0].message).toBe(
        `Stored data was damaged; backup kept at ${quarantineEvents[0].backupPath}`,
      );
      await expect(access(quarantineEvents[0].backupPath)).resolves.toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("sweeps orphaned evidence while preserving packets referenced by findings", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-evidence-sweep-"));
    try {
      const store = new JsonStore(directory);
      await store.initialize();
      await store.set("findings-aud-sweep11", [{
        id: "WCG-F-20260722-00000-00000-00000-00000-000011",
        key: "finding-with-evidence",
        title: "Referenced evidence",
        wcag: "1.1.1",
        severity: "major",
        status: "open",
        note: "",
        evidenceId: "kept-packet",
        createdAt: 1,
      }]);
      await store.set("evidence-kept-packet", { id: "kept-packet" });
      await store.set("evidence-orphan-packet", { id: "orphan-packet" });

      await expect(
        store.sweepOrphanedEvidence({ minimumAgeMs: 0 }),
      ).resolves.toEqual(["evidence-orphan-packet"]);
      await expect(
        access(join(store.directory, "evidence-kept-packet.json")),
      ).resolves.toBeUndefined();
      await expect(
        access(join(store.directory, "evidence-orphan-packet.json")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
