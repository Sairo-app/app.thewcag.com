import { describe, expect, it } from "vitest";
import { createAuditProject } from "./audits";
import {
  parseAuditPackage,
  serializeAuditPackage,
  type AuditPackagePayload,
} from "./audit-package";

function payload(): AuditPackagePayload {
  return {
    exportedAt: "2026-07-21T00:00:00.000Z",
    audit: createAuditProject("Portable audit"),
    sections: {
      sampleItems: [],
      testRuns: [],
      findings: [],
      findingViews: [],
      checklist: {},
      history: [],
      palette: [],
      activity: [],
      reports: [],
    },
    captures: [],
  };
}

describe("audit packages", () => {
  it("round trips a complete integrity-checked payload", async () => {
    const source = payload();
    const serialized = await serializeAuditPackage(source);
    await expect(parseAuditPackage(serialized)).resolves.toEqual(source);
  });

  it("rejects a payload changed after export", async () => {
    const serialized = await serializeAuditPackage(payload());
    const changed = serialized.replace("Portable audit", "Changed audit");
    await expect(parseAuditPackage(changed)).rejects.toThrow("integrity check");
  });

  it("rejects unsupported package versions", async () => {
    const serialized = await serializeAuditPackage(payload());
    const document = JSON.parse(serialized) as { schemaVersion: number };
    document.schemaVersion = 99;
    await expect(parseAuditPackage(JSON.stringify(document))).rejects.toThrow(
      "version",
    );
  });

  it("rejects malformed structured records before import", async () => {
    const source = payload();
    source.sections.findings = [null] as never;
    await expect(serializeAuditPackage(source)).rejects.toThrow(
      "invalid finding records",
    );
  });
});
