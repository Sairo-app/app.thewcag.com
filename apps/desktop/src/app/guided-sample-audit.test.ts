import { describe, expect, it, vi } from "vitest";
import { auditStartReadiness, auditTestRunComplete } from "./audit-plan";
import { parseAuditPackage, serializeAuditPackage } from "./audit-package";
import { auditDeletionKeys, deleteAuditData } from "./audits";
import { createGuidedSampleAuditPackage, GUIDED_SAMPLE_NAME } from "./guided-sample-audit";

describe("guided sample audit", () => {
  it("creates a valid four-stage package without a network target", async () => {
    const source = createGuidedSampleAuditPackage(1_800_000_000_000);
    const parsed = await parseAuditPackage(await serializeAuditPackage(source));

    expect(parsed.audit.project).toBe(GUIDED_SAMPLE_NAME);
    expect(parsed.audit.demo).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/https?:\/\//i);
    expect(
      auditStartReadiness(
        parsed.audit,
        parsed.sections.sampleItems,
        parsed.sections.testRuns,
      ).ready,
    ).toBe(true);
    expect(parsed.sections.testRuns.every(auditTestRunComplete)).toBe(true);
    expect(parsed.sections.history).toHaveLength(2);
    expect(parsed.captures[0].document).toContain('"kind":"badge"');
    expect(parsed.sections.findings[0].captureId).toBe(parsed.captures[0].id);
    expect(parsed.sections.findings[0].evidenceCaptureIds).toEqual([parsed.captures[0].id]);
    expect(parsed.sections.checklist["1.4.3"]).toMatchObject({
      result: "fail",
      findingKey: parsed.sections.findings[0].key,
    });
    expect(parsed.audit.conclusion).toBe("does-not-meet-target");
  });

  it("has one complete deletion plan for every package record", async () => {
    const source = createGuidedSampleAuditPackage(1_800_000_000_000);
    source.sections.findings[0].evidenceId = "browser-packet-1";
    const deletedCaptures: string[] = [];
    const removedKeys: string[] = [];
    const listCaptures = vi.fn(async () => source.captures.map(({ id }) => ({ id })));
    const getFindings = vi.fn(async () => source.sections.findings);

    await deleteAuditData(source.audit.id, {
      listCaptures,
      getFindings,
      deleteCapture: async (id) => { deletedCaptures.push(id); },
      removeStoreKey: async (key) => { removedKeys.push(key); },
    });

    expect(listCaptures).toHaveBeenCalledWith(source.audit.id);
    expect(getFindings).toHaveBeenCalledWith(`findings-${source.audit.id}`);
    expect(deletedCaptures).toEqual(source.captures.map(({ id }) => id));
    expect(removedKeys.sort()).toEqual([
      ...auditDeletionKeys(source.audit.id),
      "evidence-browser-packet-1",
    ].sort());
    expect(removedKeys).toHaveLength(11);
  });
});
