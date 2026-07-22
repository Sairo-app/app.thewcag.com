import { randomUUID } from "node:crypto";
import type { OverlayMode, OverlayResult, PickedColor } from "../../src/shared/desktop";
import type { CaptureRepository } from "./captures";
import type { ScreenCaptureService } from "./screen-capture";
import type { WindowManager } from "../windows";

export class CaptureCoordinator {
  private sessionId: string | null = null;
  private firstColor: PickedColor | null = null;
  private activeAuditId: string | undefined;
  private activeContext: { sampleItemId?: string; testRunId?: string } = {};

  constructor(
    private readonly capture: ScreenCaptureService,
    private readonly captures: CaptureRepository,
    private readonly windows: WindowManager,
  ) {}

  activateAudit(auditId: string): void {
    this.activeAuditId = auditId;
  }

  async begin(
    mode: OverlayMode,
    auditId?: string,
    context: { sampleItemId?: string; testRunId?: string } = {},
  ): Promise<{ sessionId: string }> {
    if (auditId) this.activeAuditId = auditId;
    this.activeContext = context;
    const frames = await this.capture.captureAll();
    this.sessionId = randomUUID();
    this.firstColor = null;
    await this.windows.openOverlays(this.sessionId, mode, frames);
    return { sessionId: this.sessionId };
  }

  async fullscreen(
    auditId?: string,
    context: { sampleItemId?: string; testRunId?: string } = {},
  ) {
    if (auditId) this.activeAuditId = auditId;
    this.activeContext = context;
    const frame = await this.capture.captureDisplayAtCursor();
    const entry = await this.captures.create(
      frame.dataUrl,
      "Full screen capture",
      this.activeAuditId,
      this.activeContext,
    );
    this.windows.sendToMain("capture:saved", entry);
    this.windows.openAnnotate(entry.id);
    return entry;
  }

  async complete(sessionId: string, result: OverlayResult) {
    if (!this.sessionId || sessionId !== this.sessionId) throw new Error("Inspection session has expired");
    this.sessionId = null;
    this.firstColor = null;
    this.windows.closeOverlays();
    if (result?.mode === "capture") {
      const entry = await this.captures.create(
        result.pngDataUrl,
        "Area capture",
        this.activeAuditId,
        this.activeContext,
      );
      this.windows.sendToMain("capture:saved", entry);
      this.windows.openAnnotate(entry.id);
      return entry;
    }
    this.windows.sendToMain("capture:result", result);
    return result;
  }

  cancel(): void {
    this.sessionId = null;
    this.firstColor = null;
    this.windows.closeOverlays();
  }

  async sample(sessionId: string, color: PickedColor): Promise<{ complete: boolean }> {
    if (!this.sessionId || sessionId !== this.sessionId) throw new Error("Inspection session has expired");
    if (!this.firstColor) {
      this.firstColor = color;
      this.windows.broadcast("overlay:progress", { sessionId, color });
      return { complete: false };
    }
    await this.complete(sessionId, { mode: "pair", colors: [this.firstColor, color] });
    return { complete: true };
  }
}
