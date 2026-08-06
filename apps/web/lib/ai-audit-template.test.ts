import { describe, expect, it, vi } from "vitest";
import { generateAuditLoggingProfile, generateAuditTemplatePrefill } from "./ai-audit-template";

const generated = {
  summary: "One issue per row.",
  instructions: ["Use the provided impact values."],
  layouts: [{
    id: "web-issues",
    label: "Web issues",
    sheetName: "Accessibility Issues",
    description: "One issue per row.",
    appliesTo: "Web findings",
    headerRow: 1,
    dataStartRow: 2,
    fields: [{
      id: "issue-title",
      label: "Issue title",
      sourceField: "title",
      kind: "text",
      required: true,
      instructions: "Name the barrier.",
      options: [],
      example: "Dialog has no accessible name",
      columnIndex: 1,
      defaultValue: "",
      valueMappings: [],
      validation: { pattern: "", minLength: 1, maxLength: 240 },
      requiredWhen: [],
    }],
  }],
};

describe("managed audit template analysis", () => {
  it("uses a non-stored structured response and returns project provenance", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(generated) }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const profile = await generateAuditLoggingProfile({
      name: "client.xlsx",
      extension: "xlsx",
      size: 1_024,
      sheetNames: ["Accessibility Issues"],
      content: "[Sheet: Accessibility Issues]\nIssue title\tImpact",
    }, {
      apiKey: "test-key",
      model: "gpt-test",
      safetyIdentifier: "safe-user",
      fetchImpl,
    });
    const body = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body));

    expect(body).toEqual(expect.objectContaining({ model: "gpt-test", store: false, safety_identifier: "safe-user" }));
    expect(JSON.stringify(body)).toContain("audit_logging_profile");
    expect(JSON.stringify(body)).not.toContain("client.xlsx");
    expect(profile).toEqual(expect.objectContaining({ templateName: "client.xlsx", version: 1 }));
    expect(profile.provenance).toEqual(expect.objectContaining({ provider: "thewcag", model: "gpt-test" }));
  });

  it("requests a non-stored structured prefill for an accepted layout", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        layoutId: "web-issues",
        values: [{ fieldId: "issue-title", value: "Dialog has no accessible name", confidence: "high", reason: "Taken from the finding title." }],
      }) }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const result = await generateAuditTemplatePrefill({
      profile: { ...generated, version: 1 },
      layoutId: "web-issues",
      finding: { title: "Dialog has no accessible name" },
    }, {
      apiKey: "test-key",
      model: "gpt-test",
      safetyIdentifier: "safe-user",
      fetchImpl,
    });
    const body = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(body).toEqual(expect.objectContaining({ model: "gpt-test", store: false, safety_identifier: "safe-user" }));
    expect(JSON.stringify(body)).toContain("audit_template_prefill");
    expect(result).toEqual(expect.objectContaining({ layoutId: "web-issues", provenance: expect.objectContaining({ promptVersion: "audit-template-prefill-v1" }) }));
  });
});
