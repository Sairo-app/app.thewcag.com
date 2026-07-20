import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertStoreKey, JsonStore, mergeFindings } from "./store";

describe("desktop storage validation", () => {
  it("accepts filename-safe keys and rejects traversal", () => {
    expect(() => assertStoreKey("audit-brief_2")).not.toThrow();
    expect(() => assertStoreKey("../token")).toThrow();
    expect(() => assertStoreKey("")).toThrow();
  });

  it("merges new findings without overwriting triage", () => {
    const existing = [{
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
    expect(result[1].key).toBe("cap-2:1");
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
});
