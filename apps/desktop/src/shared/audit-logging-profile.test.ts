import { describe, expect, it } from "vitest";
import {
  agencyValueFromNative,
  auditFindingLoggingErrors,
  auditFieldIsRequired,
  auditFieldValidationError,
  auditLoggingLayouts,
  migrateFindingsToAuditLoggingProfile,
  nativeValueFromAgency,
  auditLoggingProfileFromStored,
  normalizeAuditLoggingProfile,
} from "./audit-logging-profile";
import type { Finding } from "./desktop";

function profile() {
  return {
    version: 1,
    templateName: " Agency audit.xlsx ",
    sheetName: "Issues",
    summary: "One row per accessibility issue.",
    instructions: ["Use the agency severity vocabulary."],
    fields: [
      {
        id: "issue-title",
        label: "Issue title",
        sourceField: "title",
        kind: "text",
        required: true,
        instructions: "Write one concise barrier.",
        options: [],
        example: "Checkout button has no name",
      },
      {
        id: "business-unit",
        label: "Business unit",
        sourceField: "custom",
        kind: "select",
        required: true,
        instructions: "Choose the owning unit.",
        options: ["Retail", "Support"],
        example: "Retail",
      },
    ],
    analyzedAt: 1_800_000_000_000,
    provenance: {
      provider: "openai",
      model: "gpt-5.6",
      promptVersion: "audit-template-profile-v1",
    },
  };
}

describe("audit logging profiles", () => {
  it("normalizes a bounded AI-derived field contract", () => {
    const normalized = normalizeAuditLoggingProfile(profile());
    expect(normalized.templateName).toBe("Agency audit.xlsx");
    expect(normalized.fields.map((field) => field.id)).toEqual(["issue-title", "business-unit"]);
    expect(normalized.fields[1]).toEqual(expect.objectContaining({ sourceField: "custom", required: true }));
  });

  it("rejects duplicate field identifiers and unusable selects", () => {
    const duplicate = profile();
    duplicate.fields[1].id = "issue-title";
    expect(() => normalizeAuditLoggingProfile(duplicate)).toThrow(/duplicate or invalid/i);

    const missingOptions = profile();
    missingOptions.fields[1].options = [];
    expect(() => normalizeAuditLoggingProfile(missingOptions)).toThrow(/allowed values/i);
  });

  it("drops malformed stored profiles without breaking older projects", () => {
    expect(auditLoggingProfileFromStored({ version: 9 })).toBeUndefined();
    expect(auditLoggingProfileFromStored(undefined)).toBeUndefined();
  });

  it("normalizes multiple layouts, conditional rules, validation, and vocabulary mappings", () => {
    const rich = profile();
    delete (rich as { fields?: unknown }).fields;
    (rich as unknown as Record<string, unknown>).layouts = [{
      id: "web-issues",
      label: "Web issues",
      sheetName: "Issue Log",
      description: "Web accessibility issues",
      appliesTo: "Web findings",
      headerRow: 3,
      dataStartRow: 4,
      fields: [
        {
          id: "impact",
          label: "Impact",
          sourceField: "severity",
          kind: "select",
          required: true,
          instructions: "Use agency impact language.",
          options: ["Critical", "High", "Low"],
          columnIndex: 2,
          valueMappings: [
            { agencyValue: "Critical", nativeValue: "blocker" },
            { agencyValue: "High", nativeValue: "major" },
            { agencyValue: "Low", nativeValue: "minor" },
          ],
        },
        {
          id: "exception-owner",
          label: "Exception owner",
          sourceField: "custom",
          kind: "text",
          required: false,
          instructions: "Required for critical issues.",
          options: [],
          columnIndex: 4,
          validation: { pattern: "^[A-Z].+", minLength: 3, maxLength: 80 },
          requiredWhen: [{ fieldId: "impact", operator: "equals", value: "Critical" }],
        },
      ],
    }];
    const normalized = normalizeAuditLoggingProfile(rich);
    const [layout] = auditLoggingLayouts(normalized);
    const impact = layout.fields[0];
    const owner = layout.fields[1];
    expect(layout).toEqual(expect.objectContaining({ headerRow: 3, dataStartRow: 4 }));
    expect(agencyValueFromNative(impact, "major")).toBe("High");
    expect(nativeValueFromAgency(impact, "Critical")).toBe("blocker");
    expect(auditFieldIsRequired(owner, (id) => id === "impact" ? "Critical" : "")).toBe(true);
    expect(auditFieldValidationError(owner, "ab")).toMatch(/at least 3/i);
    expect(auditFieldValidationError(owner, "Alice")).toBeNull();
  });

  it("rejects agency status vocabularies that do not map to valid native states", () => {
    const invalid = profile();
    invalid.fields = [{
      id: "workflow-status",
      label: "Status",
      sourceField: "status",
      kind: "select",
      required: true,
      instructions: "",
      options: ["New", "Closed"],
      example: "New",
    }];
    expect(() => normalizeAuditLoggingProfile(invalid)).toThrow(/map every agency option/i);
  });

  it("migrates accepted profile revisions without dropping agency-specific values", () => {
    const previous = normalizeAuditLoggingProfile(profile());
    const nextSource = profile();
    nextSource.fields[1].id = "business-area";
    const next = normalizeAuditLoggingProfile({ ...nextSource, profileId: previous.profileId, revision: 2 });
    const finding = {
      title: "Missing label",
      severity: "major",
      status: "open",
      agencyLayoutId: "default",
      agencyFields: { "business-unit": "Retail", "legacy-value": "Preserve me" },
    } as unknown as Finding;
    const [migrated] = migrateFindingsToAuditLoggingProfile([finding], previous, next);
    expect(migrated.agencyFields).toEqual({
      "business-unit": "Retail",
      "business-area": "Retail",
      "legacy-value": "Preserve me",
    });
    expect(migrated).toEqual(expect.objectContaining({
      agencyLayoutId: "default",
      agencyProfileId: next.profileId,
      agencyProfileRevision: 2,
    }));
  });

  it("reports incomplete agency fields before workbook export", () => {
    const normalized = normalizeAuditLoggingProfile(profile());
    const incomplete = { title: "Missing label", agencyFields: {} } as Finding;
    expect(auditFindingLoggingErrors(normalized, incomplete)).toEqual([
      expect.objectContaining({ fieldId: "business-unit", message: expect.stringMatching(/required/i) }),
    ]);
    expect(auditFindingLoggingErrors(normalized, {
      ...incomplete,
      agencyFields: { "business-unit": "Retail" },
    })).toEqual([]);
  });

  it("rejects validation patterns that can cause unsafe backtracking", () => {
    const unsafe = profile();
    unsafe.fields[0] = {
      ...unsafe.fields[0],
      validation: { pattern: "^(a+)+$" },
    } as typeof unsafe.fields[0];
    expect(() => normalizeAuditLoggingProfile(unsafe)).toThrow(/unsafe validation pattern/i);
  });
});
