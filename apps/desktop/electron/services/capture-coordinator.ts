import { randomUUID } from "node:crypto";
import type { OverlayMode, OverlayResult, PickedColor } from "../../src/shared/desktop";
import type { CaptureRepository } from "./captures";
import type { ScreenCaptureService } from "./screen-capture";
import type { WindowManager } from "../windows";

export class CaptureCoordinator {
  private sessionId: string | null = null;
  private firstColor: PickedColor | null = null;
  private activeAuditId: string | undefined;
  private sessionAuditId: string | undefined;

  constructor(
    private readonly capture: ScreenCaptureService,
    private readonly captures: CaptureRepository,
    private readonly windows: WindowManager,
  ) {}

  activateAudit(auditId: string): void {
    this.activeAuditId = auditId;
  }

  async begin(mode: OverlayMode, auditId?: string, standalone = false): Promise<{ sessionId: string }> {
    if (auditId) this.activeAuditId = auditId;
    this.sessionAuditId = standalone ? undefined : auditId ?? this.activeAuditId;
    const frames = await this.capture.captureAll();
    this.sessionId = randomUUID();
    this.firstColor = null;
    await this.windows.openOverlays(this.sessionId, mode, frames);
    return { sessionId: this.sessionId };
  }

  async fullscreen(auditId?: string, standalone = false) {
    if (auditId) this.activeAuditId = auditId;
    const frame = await this.capture.captureDisplayAtCursor();
    const entry = await this.captures.create(
      frame.dataUrl,
      "Full screen capture",
      standalone ? undefined : auditId ?? this.activeAuditId,
    );
    this.windows.sendToMain("capture:saved", entry);
    this.windows.openAnnotate(entry.id);
    return entry;
  }

  async complete(sessionId: string, result: OverlayResult) {
    if (!this.sessionId || sessionId !== this.sessionId) throw new Error("Inspection session has expired");
    const auditId = this.sessionAuditId;
    this.sessionId = null;
    this.firstColor = null;
    this.sessionAuditId = undefined;
    this.windows.closeOverlays();
    if (result?.mode === "capture") {
      const entry = await this.captures.create(result.pngDataUrl, "Area capture", auditId);
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
    this.sessionAuditId = undefined;
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
