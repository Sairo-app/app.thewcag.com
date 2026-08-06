import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import ExcelJS from "exceljs";
import type { AuditLoggingField, AuditTemplateUpload, Finding } from "../../src/shared/desktop";
import { agencyValueFromNative, auditFindingLoggingErrors, auditLoggingLayouts, normalizeAuditLoggingProfile } from "../../src/shared/audit-logging-profile";

const ALLOWED_EXTENSIONS = new Set(["xlsx", "csv", "tsv", "json", "md", "txt"]);
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_CONTENT_CHARACTERS = 500_000;
const MAX_SHEETS = 12;
const MAX_ROWS_PER_SHEET = 150;
const MAX_COLUMNS_PER_SHEET = 60;
const MAX_CELL_CHARACTERS = 1_500;
const MAX_METADATA_PER_SHEET = 120;

function cleanCell(value: string): string {
  return value
    // Template contents are untrusted provider input. Remove control characters
    // while retaining tabs/newlines that describe the sheet layout.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CELL_CHARACTERS);
}

function boundedContent(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("The selected audit template is empty");
  return normalized.slice(0, MAX_CONTENT_CHARACTERS);
}

type ExtractedSheet = NonNullable<AuditTemplateUpload["sheets"]>[number];

async function spreadsheetContent(file: string): Promise<{ content: string; sheetNames: string[]; sheets: ExtractedSheet[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const worksheets = workbook.worksheets.slice(0, MAX_SHEETS);
  if (!worksheets.length) throw new Error("The spreadsheet does not contain any worksheets");
  const sections: string[] = [];
  const sheets: ExtractedSheet[] = [];
  let extractedCharacters = 0;
  for (const worksheet of worksheets) {
    const rows: string[] = [];
    const structuredRows: ExtractedSheet["rows"] = [];
    const metadata = new Set<string>();
    const rowLimit = Math.min(worksheet.actualRowCount || worksheet.rowCount, MAX_ROWS_PER_SHEET);
    for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const columnLimit = Math.min(row.cellCount, MAX_COLUMNS_PER_SHEET);
      const cells: string[] = [];
      for (let column = 1; column <= columnLimit; column += 1) {
        const cell = row.getCell(column);
        const cleanedText = cleanCell(cell.text);
        const storedText = cleanedText.slice(0, Math.max(0, MAX_CONTENT_CHARACTERS - extractedCharacters));
        extractedCharacters += storedText.length;
        cells.push(storedText);
        if (metadata.size < MAX_METADATA_PER_SHEET) {
          const addMetadata = (rawValue: string) => {
            if (extractedCharacters >= MAX_CONTENT_CHARACTERS) return;
            const bounded = rawValue.slice(0, Math.min(MAX_CELL_CHARACTERS, MAX_CONTENT_CHARACTERS - extractedCharacters));
            if (!bounded || metadata.has(bounded)) return;
            metadata.add(bounded);
            extractedCharacters += bounded.length;
          };
          const validation = cell.dataValidation;
          if (validation?.type) {
            const formulae = (validation.formulae ?? []).map((formula) => cleanCell(String(formula))).filter(Boolean);
            addMetadata(`[Cell ${cell.address} validation] type=${validation.type}${validation.operator ? ` operator=${validation.operator}` : ""}${formulae.length ? ` values=${formulae.join(" | ")}` : ""}${validation.allowBlank ? " allow-blank" : ""}`);
          }
          if (cell.value && typeof cell.value === "object" && "formula" in cell.value) {
            const formula = cleanCell(String((cell.value as { formula?: unknown }).formula ?? ""));
            if (formula) addMetadata(`[Cell ${cell.address} formula] ${formula}`);
          }
          const note = typeof cell.note === "string"
            ? cleanCell(cell.note)
            : cleanCell(cell.note?.texts?.map((part) => part.text).join("") ?? "");
          if (note) addMetadata(`[Cell ${cell.address} note] ${note}`);
        }
      }
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      if (cells.some(Boolean)) {
        rows.push(cells.join("\t"));
        structuredRows.push({ rowNumber, values: cells });
      }
    }
    const metadataRows = [...metadata];
    if (rows.length) sections.push(`[Sheet: ${cleanCell(worksheet.name)}${worksheet.state !== "visible" ? `; ${worksheet.state}` : ""}]\n${rows.join("\n")}${metadataRows.length ? `\n[Worksheet rules]\n${metadataRows.join("\n")}` : ""}`);
    sheets.push({ name: cleanCell(worksheet.name), rows: structuredRows, metadata: metadataRows });
  }
  if (!sections.length) throw new Error("The spreadsheet does not contain any readable cells");
  return {
    content: boundedContent(sections.join("\n\n")),
    sheetNames: worksheets.map((worksheet) => cleanCell(worksheet.name)),
    sheets,
  };
}

function textSheet(name: string, content: string, extension: string): ExtractedSheet {
  const delimiter = extension === "csv" ? "," : extension === "tsv" ? "\t" : null;
  const rows = content.split(/\r?\n/).slice(0, MAX_ROWS_PER_SHEET).map((line, index) => ({
    rowNumber: index + 1,
    values: delimiter ? line.split(delimiter).slice(0, MAX_COLUMNS_PER_SHEET).map(cleanCell) : [cleanCell(line)],
  })).filter((row) => row.values.some(Boolean));
  return { name, rows };
}

export async function readAuditTemplateFile(file: string): Promise<AuditTemplateUpload> {
  const extension = extname(file).slice(1).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Choose an XLSX, CSV, TSV, JSON, Markdown, or text audit template");
  }
  const fileStat = await stat(file);
  if (!fileStat.isFile() || fileStat.size <= 0) throw new Error("The selected audit template is empty");
  if (fileStat.size > MAX_FILE_BYTES) throw new Error("The audit template must be smaller than 25 MB");
  if (extension !== "xlsx") {
    const content = boundedContent(await readFile(file, "utf8"));
    const sheet = textSheet(basename(file), content, extension);
    return {
      name: basename(file).slice(0, 180),
      extension,
      size: fileStat.size,
      sheetNames: [sheet.name],
      content,
      sheets: [sheet],
    };
  }
  const extracted = await spreadsheetContent(file);
  return {
    name: basename(file).slice(0, 180),
    extension,
    size: fileStat.size,
    sheetNames: extracted.sheetNames,
    content: extracted.content,
    sheets: extracted.sheets,
  };
}

interface PendingTemplate {
  file: string;
  upload: AuditTemplateUpload;
  expiresAt: number;
}

interface StoredTemplateMetadata {
  version: 1;
  originalFileName: string;
  extension: string;
  sourceFile: string;
  savedAt: number;
}

function auditId(value: unknown): string {
  if (typeof value !== "string" || !/^aud-[a-z0-9-]{6,36}$/.test(value)) throw new Error("Invalid audit identifier");
  return value;
}

function findingFieldValue(field: AuditLoggingField, finding: Finding): string {
  if (field.sourceField === "custom") return finding.agencyFields?.[field.id]?.trim() ?? field.defaultValue ?? "";
  const raw = finding[field.sourceField];
  const agencyValue = Array.isArray(raw)
    ? raw.map((item) => agencyValueFromNative(field, String(item))).join("\n")
    : agencyValueFromNative(field, String(raw ?? ""));
  return agencyValue || field.defaultValue || "";
}

function csvCell(value: string): string {
  const safeValue = /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
  return /[",\r\n]/.test(safeValue) ? `"${safeValue.replaceAll('"', '""')}"` : safeValue;
}

export class AuditTemplateService {
  private readonly directory: string;
  private readonly pending = new Map<string, PendingTemplate>();

  constructor(userData: string) {
    this.directory = join(userData, "audit-templates");
  }

  async open(file: string): Promise<AuditTemplateUpload> {
    this.prunePending();
    const upload = await readAuditTemplateFile(file);
    const uploadToken = randomUUID();
    this.pending.set(uploadToken, { file, upload, expiresAt: Date.now() + 30 * 60 * 1_000 });
    return { ...upload, uploadToken };
  }

  async attach(rawAuditId: unknown, rawToken: unknown): Promise<Omit<StoredTemplateMetadata, "version" | "sourceFile">> {
    const id = auditId(rawAuditId);
    if (typeof rawToken !== "string") throw new Error("Choose the audit template again before saving it");
    const pending = this.pending.get(rawToken);
    if (!pending || pending.expiresAt < Date.now()) throw new Error("The audit template selection expired. Choose the file again");
    const targetDirectory = join(this.directory, id);
    await mkdir(targetDirectory, { recursive: true });
    const sourceFile = `source.${pending.upload.extension}`;
    await copyFile(pending.file, join(targetDirectory, sourceFile));
    const metadata: StoredTemplateMetadata = {
      version: 1,
      originalFileName: pending.upload.name,
      extension: pending.upload.extension,
      sourceFile,
      savedAt: Date.now(),
    };
    await writeFile(join(targetDirectory, "metadata.json"), JSON.stringify(metadata), "utf8");
    const files = await readdir(targetDirectory);
    await Promise.all(files
      .filter((name) => /^source\./.test(name) && name !== sourceFile)
      .map((name) => rm(join(targetDirectory, name), { force: true })));
    this.pending.delete(rawToken);
    return {
      originalFileName: metadata.originalFileName,
      extension: metadata.extension,
      savedAt: metadata.savedAt,
    };
  }

  async remove(rawAuditId: unknown): Promise<void> {
    const id = auditId(rawAuditId);
    await rm(join(this.directory, id), { recursive: true, force: true });
  }

  async exportInfo(rawAuditId: unknown, rawProfile?: unknown): Promise<{ name: string; extension: string }> {
    const metadata = await this.metadataOrUndefined(auditId(rawAuditId));
    const extension = metadata?.extension === "csv" || metadata?.extension === "tsv" ? metadata.extension : "xlsx";
    const templateName = metadata?.originalFileName
      ?? (rawProfile ? normalizeAuditLoggingProfile(rawProfile).templateName : "agency-audit");
    const stem = templateName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "-") || "agency-audit";
    return { name: `${stem}-completed.${extension}`, extension };
  }

  async export(rawAuditId: unknown, rawProfile: unknown, rawFindings: unknown, outputPath: string): Promise<void> {
    const id = auditId(rawAuditId);
    const profile = normalizeAuditLoggingProfile(rawProfile);
    if (!Array.isArray(rawFindings) || rawFindings.length > 5_000) throw new Error("Invalid findings for agency export");
    const findings = rawFindings as Finding[];
    const invalidFindings = findings.flatMap((finding) => {
      const errors = auditFindingLoggingErrors(profile, finding);
      return errors.length ? [{ finding, errors }] : [];
    });
    if (invalidFindings.length) {
      const first = invalidFindings[0];
      throw new Error(`Complete the agency format before export: ${invalidFindings.length} ${invalidFindings.length === 1 ? "finding needs" : "findings need"} attention. ${first.finding.title || "Untitled finding"}: ${first.errors[0].message}`);
    }
    const metadata = await this.metadataOrUndefined(id);
    const source = metadata ? join(this.directory, id, metadata.sourceFile) : undefined;
    const layouts = auditLoggingLayouts(profile);
    if (metadata?.extension === "csv" || metadata?.extension === "tsv") {
      if (layouts.length > 1) throw new Error("A CSV or TSV source can export only one agency issue layout. Use XLSX for multiple worksheets");
      const layout = layouts[0];
      const delimiter = metadata.extension === "csv" ? "," : "\t";
      const selected = findings.filter((finding) => !finding.agencyLayoutId || finding.agencyLayoutId === layout.id);
      const rows = [layout.fields.map((field) => field.label), ...selected.map((finding) => layout.fields.map((field) => findingFieldValue(field, finding)))];
      const text = rows.map((row) => row.map((cell) => metadata.extension === "csv"
        ? csvCell(cell)
        : (/^[=+\-@]/.test(cell.trimStart()) ? `'${cell}` : cell).replaceAll("\t", " ")).join(delimiter)).join("\r\n");
      await writeFile(outputPath, text, "utf8");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    if (metadata?.extension === "xlsx" && source) await workbook.xlsx.readFile(source);
    for (const layout of layouts) {
      const worksheet = workbook.getWorksheet(layout.sheetName) ?? workbook.addWorksheet(layout.sheetName.slice(0, 31));
      const templateRow = worksheet.getRow(layout.dataStartRow);
      for (const field of layout.fields) worksheet.getRow(layout.headerRow).getCell(field.columnIndex ?? 1).value = field.label;
      const selected = findings.filter((finding) => (finding.agencyLayoutId ?? layouts[0].id) === layout.id);
      selected.forEach((finding, index) => {
        const row = worksheet.getRow(layout.dataStartRow + index);
        if (index > 0) {
          row.height = templateRow.height;
          for (const field of layout.fields) {
            const column = field.columnIndex ?? 1;
            row.getCell(column).style = { ...templateRow.getCell(column).style };
          }
        }
        for (const field of layout.fields) row.getCell(field.columnIndex ?? 1).value = findingFieldValue(field, finding);
        row.commit();
      });
      for (let rowNumber = layout.dataStartRow + selected.length; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        for (const field of layout.fields) row.getCell(field.columnIndex ?? 1).value = null;
      }
    }
    await workbook.xlsx.writeFile(outputPath);
  }

  private async metadata(id: string): Promise<StoredTemplateMetadata> {
    try {
      const value = JSON.parse(await readFile(join(this.directory, id, "metadata.json"), "utf8")) as StoredTemplateMetadata;
      if (value.version !== 1 || typeof value.sourceFile !== "string" || typeof value.extension !== "string") throw new Error();
      return value;
    } catch {
      throw new Error("The original agency template is not available on this computer");
    }
  }

  private async metadataOrUndefined(id: string): Promise<StoredTemplateMetadata | undefined> {
    try {
      return await this.metadata(id);
    } catch {
      return undefined;
    }
  }

  private prunePending(): void {
    const now = Date.now();
    for (const [token, pending] of this.pending) if (pending.expiresAt < now) this.pending.delete(token);
  }
}
