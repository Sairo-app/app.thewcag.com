import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { AuditTemplateService, readAuditTemplateFile } from "./audit-template";
import type { AuditLoggingProfile, Finding } from "../../src/shared/desktop";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("audit template extraction", () => {
  it("extracts worksheet names, headers, and representative rows from XLSX", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-audit-template-"));
    directories.push(directory);
    const file = join(directory, "agency-audit.xlsx");
    const workbook = new ExcelJS.Workbook();
    const issues = workbook.addWorksheet("Issue Log");
    issues.addRow(["Issue title", "Severity", "Required evidence"]);
    issues.addRow(["Checkout button has no name", "High", "Screenshot and steps"]);
    issues.getCell("B2").dataValidation = { type: "list", formulae: ['"Critical,High,Low"'] };
    issues.getCell("C1").note = "Required when impact is Critical";
    await workbook.xlsx.writeFile(file);

    const upload = await readAuditTemplateFile(file);
    expect(upload).toEqual(expect.objectContaining({
      name: "agency-audit.xlsx",
      extension: "xlsx",
      sheetNames: ["Issue Log"],
    }));
    expect(upload.content).toContain("[Sheet: Issue Log]");
    expect(upload.content).toContain("Issue title\tSeverity\tRequired evidence");
    expect(upload.content).toContain("[Cell B2 validation] type=list values=\"Critical,High,Low\"");
    expect(upload.content).toContain("[Cell C1 note] Required when impact is Critical");
  });

  it("accepts text-based templates and rejects unsupported files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-audit-template-"));
    directories.push(directory);
    const csv = join(directory, "issues.csv");
    await writeFile(csv, "Title,Impact\nMissing label,High", "utf8");
    await expect(readAuditTemplateFile(csv)).resolves.toEqual(expect.objectContaining({ extension: "csv" }));

    const executable = join(directory, "issues.exe");
    await writeFile(executable, "not a template", "utf8");
    await expect(readAuditTemplateFile(executable)).rejects.toThrow(/XLSX/i);
  });

  it("retains an original workbook and writes findings into the approved cells", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-audit-template-"));
    directories.push(directory);
    const file = join(directory, "agency-audit.xlsx");
    const output = join(directory, "completed.xlsx");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Issue Log");
    sheet.addRow(["Issue", "Impact", "Business unit"]);
    const example = sheet.addRow(["Example", "High", "Retail"]);
    example.getCell(1).font = { bold: true };
    await workbook.xlsx.writeFile(file);

    const service = new AuditTemplateService(directory);
    const upload = await service.open(file);
    await service.attach("aud-123456", upload.uploadToken);
    const profile: AuditLoggingProfile = {
      version: 1,
      profileId: "profile-agency",
      revision: 1,
      templateName: "agency-audit.xlsx",
      sheetName: "Issue Log",
      summary: "One issue per row.",
      instructions: [],
      fields: [],
      layouts: [{
        id: "web-issues",
        label: "Web issues",
        sheetName: "Issue Log",
        description: "",
        appliesTo: "Web findings",
        headerRow: 1,
        dataStartRow: 2,
        fields: [
          { id: "issue", label: "Issue", sourceField: "title", kind: "text", required: true, instructions: "", options: [], columnIndex: 1 },
          { id: "impact", label: "Impact", sourceField: "severity", kind: "select", required: true, instructions: "", options: ["Critical", "High", "Low"], columnIndex: 2, valueMappings: [{ agencyValue: "Critical", nativeValue: "blocker" }, { agencyValue: "High", nativeValue: "major" }, { agencyValue: "Low", nativeValue: "minor" }] },
          { id: "business-unit", label: "Business unit", sourceField: "custom", kind: "select", required: true, instructions: "", options: ["Retail", "Support"], columnIndex: 3 },
        ],
      }],
      analyzedAt: 1_800_000_000_000,
      provenance: { provider: "openai", model: "gpt-test", promptVersion: "audit-template-profile-v2" },
    };
    const finding = {
      id: "WCG-F-20260807-00000-00000-00000-00000-000001",
      key: "manual-1",
      title: "Checkout control has no name",
      wcag: "4.1.2",
      severity: "major",
      status: "open",
      note: "",
      agencyLayoutId: "web-issues",
      agencyFields: { "business-unit": "Retail" },
      createdAt: 1_800_000_000_000,
      modifiedAt: 1_800_000_000_000,
      schemaVersion: 2,
      source: "manual",
    } as Finding;

    await service.export("aud-123456", profile, [finding], output);
    const completed = new ExcelJS.Workbook();
    await completed.xlsx.readFile(output);
    expect(completed.getWorksheet("Issue Log")?.getRow(2).values).toEqual([
      undefined,
      "Checkout control has no name",
      "High",
      "Retail",
    ]);
    expect(completed.getWorksheet("Issue Log")?.getRow(2).getCell(1).font.bold).toBe(true);
  });

  it("generates a mapped workbook when an imported project has no retained source file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-audit-template-"));
    directories.push(directory);
    const output = join(directory, "generated.xlsx");
    const service = new AuditTemplateService(directory);
    const profile: AuditLoggingProfile = {
      version: 1,
      templateName: "Imported agency format",
      summary: "One issue per row.",
      instructions: [],
      sheetName: "Issues",
      fields: [{ id: "title", label: "Issue title", sourceField: "title", kind: "text", required: true, instructions: "", options: [], columnIndex: 1 }],
      analyzedAt: 1_800_000_000_000,
      provenance: { provider: "thewcag", model: "gpt-test", promptVersion: "audit-template-profile-v2" },
    };
    const finding = { title: "Missing label", severity: "major", status: "open", agencyFields: {} } as Finding;
    await expect(service.exportInfo("aud-abcdef", profile)).resolves.toEqual({ name: "Imported-agency-format-completed.xlsx", extension: "xlsx" });
    await service.export("aud-abcdef", profile, [finding], output);
    const completed = new ExcelJS.Workbook();
    await completed.xlsx.readFile(output);
    expect(completed.getWorksheet("Issues")?.getCell("A2").value).toBe("Missing label");
  });
});
