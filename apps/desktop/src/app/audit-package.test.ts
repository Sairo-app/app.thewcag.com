import { describe, expect, it } from "vitest";
import { createFindingId } from "@accessibility-build/audit-contracts";
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

  it("round trips a confirmed scoper profile and rejects malformed profiles", async () => {
    const source = payload();
    source.audit.scopeProfile = {
      version: 1,
      targetType: "web-product",
      featureIds: ["authentication", "forms", "components"],
      templateId: "web-product-aa",
      confidence: "high",
      reasons: ["Selected by the auditor."],
      confirmedAt: Date.now(),
    };
    await expect(parseAuditPackage(await serializeAuditPackage(source))).resolves.toEqual(source);

    source.audit.scopeProfile.targetType = "unknown" as never;
    await expect(serializeAuditPackage(source)).rejects.toThrow("invalid scope profile");
  });

  it("bounds scope-profile metadata before importing it", async () => {
    const source = payload();
    source.audit.scopeProfile = {
      version: 1,
      targetType: "web-product",
      featureIds: ["forms", "forms"],
      templateId: "web-product-aa",
      confidence: "medium",
      reasons: ["Detected a web application."],
      confirmedAt: Date.now(),
    };
    await expect(serializeAuditPackage(source)).rejects.toThrow("invalid scope profile");

    source.audit.scopeProfile.featureIds = ["forms"];
    source.audit.scopeProfile.reasons = ["x".repeat(501)];
    await expect(serializeAuditPackage(source)).rejects.toThrow("invalid scope profile");
  });

  it("round trips coverage links and rejects oversized context identifiers", async () => {
    const source = payload();
    source.sections.sampleItems = [{
      id: "sample-checkout",
      kind: "flow",
      label: "Checkout",
      location: "/checkout",
      status: "in-progress",
      notes: "",
      createdAt: 1,
      modifiedAt: 1,
    }];
    source.sections.testRuns = [{
      id: "run-forms",
      scriptId: "forms",
      sampleItemId: "sample-checkout",
      title: "Forms and validation",
      category: "forms",
      status: "in-progress",
      steps: [{ id: "step-1", label: "Submit invalid data", complete: true, observation: "Error announced" }],
      notes: "",
      createdAt: 1,
      modifiedAt: 1,
    }];
    source.sections.findings = [{
      id: createFindingId(),
      key: "finding-1",
      sampleItemId: "sample-checkout",
      testRunId: "run-forms",
      title: "Error is not identified",
      wcag: "3.3.1",
      severity: "major",
      status: "open",
      note: "",
      createdAt: 1,
    }];
    await expect(parseAuditPackage(await serializeAuditPackage(source))).resolves.toEqual(source);

    source.sections.testRuns[0].sampleItemId = "x".repeat(101);
    await expect(serializeAuditPackage(source)).rejects.toThrow("invalid guided test records");
  });

  it("migrates legacy finding evidence and preserves orphaned captures in an unassigned bucket", async () => {
    const source = payload();
    source.sections.findings = [{
      id: createFindingId(),
      key: "legacy-finding",
      title: "Legacy issue",
      wcag: "1.4.3",
      severity: "major",
      status: "open",
      note: "Imported from the Evidence stage",
      captureId: "cap-linked",
      createdAt: 1,
    }];
    source.captures = [
      { id: "cap-linked", title: "Linked legacy capture", rawPngDataUrl: "data:image/png;base64,AA==" },
      { id: "cap-orphan", title: "Orphaned legacy capture", rawPngDataUrl: "data:image/png;base64,AA==", document: '{"version":1,"nextId":1,"shapes":[]}' },
    ];

    const parsed = await parseAuditPackage(await serializeAuditPackage(source));
    expect(parsed.sections.findings[0]).toMatchObject({
      captureId: "cap-linked",
      evidenceCaptureIds: ["cap-linked"],
    });
    expect(parsed.unassignedCaptureIds).toEqual(["cap-orphan"]);
    expect(parsed.captures.find((capture) => capture.id === "cap-orphan")?.document).toContain('"shapes":[]');
  });
});
