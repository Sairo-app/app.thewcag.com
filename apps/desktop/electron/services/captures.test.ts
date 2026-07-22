import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertAuditId, assertCaptureId, CaptureRepository } from "./captures";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("capture identifiers", () => {
  it("accepts generated ids and rejects traversal", () => {
    expect(() => assertCaptureId("cap-mabc1234-deadbeef")).not.toThrow();
    expect(() => assertCaptureId("../../capture")).toThrow();
    expect(() => assertCaptureId("capture.png")).toThrow();
  });

  it("accepts generated audit ids and rejects unsafe values", () => {
    expect(() => assertAuditId("aud-abc12345")).not.toThrow();
    expect(() => assertAuditId("../aud-abc12345")).toThrow();
  });

  it("lists captures only inside the requested audit and migrates unscoped entries", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-captures-"));
    try {
      const captures = new CaptureRepository(directory);
      const auditA = await captures.create(PNG, "Audit A", "aud-a1234567");
      await captures.create(PNG, "Audit B", "aud-b1234567");
      await captures.create(PNG, "Legacy capture");
      expect(await captures.list(undefined, true)).toHaveLength(1);
      expect(await captures.list("aud-a1234567")).toHaveLength(1);
      expect(await captures.assignUnscoped("aud-a1234567")).toBe(1);
      expect(await captures.list(undefined, true)).toHaveLength(0);
      expect(await captures.list("aud-a1234567")).toHaveLength(2);
      expect((await captures.list("aud-b1234567"))[0].title).toBe("Audit B");
      expect(await captures.readDataUrl(auditA.id, "raw")).toBe(PNG);
      expect(await captures.readDataUrl(auditA.id, "thumbnail")).toBeNull();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves the guided session context with a capture", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-captures-"));
    try {
      const captures = new CaptureRepository(directory);
      const created = await captures.create(PNG, "Checkout error", "aud-a1234567", {
        sampleItemId: "sample-checkout",
        testRunId: "run-forms",
      });
      const restored = await captures.describe(created.id);
      expect(restored).toMatchObject({
        sampleItemId: "sample-checkout",
        testRunId: "run-forms",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
