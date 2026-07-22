import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { CaptureEntry } from "../../src/shared/desktop";

const CAPTURE_ID = /^cap-[0-9a-z-]{8,80}$/i;
const AUDIT_ID = /^aud-[a-z0-9-]{6,36}$/;
const MAX_CAPTURE_BYTES = 40 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

export function assertCaptureId(id: string): void {
  if (!CAPTURE_ID.test(id)) throw new Error("Invalid capture identifier");
}

export function assertAuditId(id: string): void {
  if (!AUDIT_ID.test(id)) throw new Error("Invalid audit identifier");
}

function decodePng(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Expected a PNG image");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 8 || bytes.length > MAX_CAPTURE_BYTES) throw new Error("Capture size is not supported");
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Capture is not a valid PNG");
  return bytes;
}

function pngDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Capture has an invalid PNG header");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 32_768 || height > 32_768) {
    throw new Error("Capture dimensions are not supported");
  }
  return { width, height };
}

export class CaptureRepository {
  readonly directory: string;

  constructor(userData: string) {
    this.directory = join(userData, "captures");
  }

  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  async create(
    pngDataUrl: string,
    title = "Screen capture",
    auditId?: string,
    context?: { sampleItemId?: string; testRunId?: string },
  ): Promise<CaptureEntry> {
    if (auditId) assertAuditId(auditId);
    const bytes = decodePng(pngDataUrl);
    const id = `cap-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const createdAt = Date.now();
    const size = pngDimensions(bytes);
    await this.atomicWrite(join(this.directory, `${id}.png`), bytes);
    await this.atomicWrite(join(this.directory, `${id}.meta.json`), JSON.stringify({
      title: title.trim().slice(0, 160) || "Screen capture",
      createdAt,
      width: size.width,
      height: size.height,
      auditId,
      sampleItemId: context?.sampleItemId,
      testRunId: context?.testRunId,
    }));
    return {
      id,
      auditId,
      sampleItemId: context?.sampleItemId,
      testRunId: context?.testRunId,
      title,
      createdAt,
      modifiedAt: createdAt,
      issues: 0,
      width: size.width,
      height: size.height,
      assetUrl: this.assetUrl(id, "raw"),
      thumbnailUrl: null,
    };
  }

  async list(auditId?: string): Promise<CaptureEntry[]> {
    if (auditId) assertAuditId(auditId);
    await this.initialize();
    const names = await readdir(this.directory);
    const ids = names
      .filter((name) => name.endsWith(".png") && !name.endsWith(".thumb.png"))
      .map((name) => name.slice(0, -4))
      .filter((id) => CAPTURE_ID.test(id));
    const entries = await Promise.all(ids.map((id) => this.describe(id)));
    return entries.filter((entry): entry is CaptureEntry => Boolean(entry))
      .filter((entry) => !auditId || entry.auditId === auditId)
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 100);
  }

  async describe(id: string): Promise<CaptureEntry | null> {
    assertCaptureId(id);
    try {
      const [file, metadata, document, legacySize] = await Promise.all([
        stat(join(this.directory, `${id}.png`)),
        this.readJson<{
          title?: string;
          createdAt?: number;
          width?: number;
          height?: number;
          auditId?: string;
          sampleItemId?: string;
          testRunId?: string;
        }>(`${id}.meta.json`),
        this.readJson<{ shapes?: Array<{ kind?: string }> }>(`${id}.json`),
        this.readPngSize(join(this.directory, `${id}.png`)),
      ]);
      const thumbPath = join(this.directory, `${id}.thumb.png`);
      const hasThumb = await stat(thumbPath).then(() => true).catch(() => false);
      return {
        id,
        auditId: metadata?.auditId,
        sampleItemId: typeof metadata?.sampleItemId === "string"
          ? metadata.sampleItemId.slice(0, 100)
          : undefined,
        testRunId: typeof metadata?.testRunId === "string"
          ? metadata.testRunId.slice(0, 100)
          : undefined,
        title: metadata?.title || "Screen capture",
        createdAt: metadata?.createdAt || file.birthtimeMs || file.mtimeMs,
        modifiedAt: file.mtimeMs,
        issues: document?.shapes?.filter((shape) => shape.kind === "badge").length ?? 0,
        width: metadata?.width ?? legacySize.width,
        height: metadata?.height ?? legacySize.height,
        assetUrl: this.assetUrl(id, "raw"),
        thumbnailUrl: hasThumb ? this.assetUrl(id, "thumbnail") : null,
      };
    } catch {
      return null;
    }
  }

  async readDocument(id: string): Promise<string | null> {
    assertCaptureId(id);
    return readFile(join(this.directory, `${id}.json`), "utf8").catch(() => null);
  }

  async readDataUrl(id: string, kind: "raw" | "thumbnail"): Promise<string | null> {
    assertCaptureId(id);
    const path = this.resolveAsset(id, kind);
    try {
      const bytes = await readFile(path);
      if (bytes.length < 8 || bytes.length > MAX_CAPTURE_BYTES) return null;
      if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
      return `data:image/png;base64,${bytes.toString("base64")}`;
    } catch {
      return null;
    }
  }

  async saveDocument(id: string, json: string): Promise<void> {
    assertCaptureId(id);
    if (Buffer.byteLength(json, "utf8") > MAX_DOCUMENT_BYTES) throw new Error("Annotation document is too large");
    const parsed = JSON.parse(json) as { version?: number; shapes?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.shapes)) throw new Error("Invalid annotation document");
    await this.atomicWrite(join(this.directory, `${id}.json`), json);
  }

  async saveThumbnail(id: string, pngDataUrl: string): Promise<void> {
    assertCaptureId(id);
    await this.atomicWrite(join(this.directory, `${id}.thumb.png`), decodePng(pngDataUrl));
  }

  async delete(id: string): Promise<void> {
    assertCaptureId(id);
    await Promise.all(["png", "json", "meta.json", "thumb.png"].map((suffix) =>
      rm(join(this.directory, `${id}.${suffix}`), { force: true })));
  }

  async assignUnscoped(auditId: string): Promise<number> {
    assertAuditId(auditId);
    await this.initialize();
    const names = (await readdir(this.directory)).filter((name) => name.endsWith(".meta.json"));
    let assigned = 0;
    await Promise.all(names.map(async (name) => {
      const id = name.slice(0, -10);
      if (!CAPTURE_ID.test(id)) return;
      const metadata = await this.readJson<Record<string, unknown>>(name);
      if (!metadata || typeof metadata.auditId === "string") return;
      await this.atomicWrite(join(this.directory, name), JSON.stringify({ ...metadata, auditId }));
      assigned += 1;
    }));
    return assigned;
  }

  resolveAsset(id: string, kind: "raw" | "thumbnail"): string {
    assertCaptureId(id);
    return join(this.directory, kind === "thumbnail" ? `${id}.thumb.png` : `${id}.png`);
  }

  assetUrl(id: string, kind: "raw" | "thumbnail"): string {
    return `thewcag-asset://capture/${encodeURIComponent(id)}?kind=${kind}`;
  }

  private async readJson<T>(name: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(join(this.directory, name), "utf8")) as T;
    } catch {
      return null;
    }
  }

  private async readPngSize(path: string): Promise<{ width: number; height: number }> {
    const handle = await open(path, "r");
    try {
      const header = Buffer.alloc(24);
      await handle.read(header, 0, header.length, 0);
      return pngDimensions(header);
    } finally {
      await handle.close();
    }
  }

  private async atomicWrite(path: string, contents: string | Buffer): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, contents, { mode: 0o600 });
    await rename(temp, path);
  }
}
