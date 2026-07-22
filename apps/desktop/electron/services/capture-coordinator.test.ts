import { describe, expect, it, vi } from "vitest";
import type { CaptureEntry, ScreenFrame } from "../../src/shared/desktop";
import type { WindowManager } from "../windows";
import { CaptureCoordinator } from "./capture-coordinator";
import type { CaptureRepository } from "./captures";
import type { ScreenCaptureService } from "./screen-capture";

const FRAME: ScreenFrame = {
  displayId: "display-1",
  bounds: { x: 0, y: 0, width: 100, height: 100 },
  scaleFactor: 1,
  width: 1,
  height: 1,
  dataUrl: "data:image/png;base64,image",
};

const ENTRY: CaptureEntry = {
  id: "cap-mabc1234-deadbeef",
  title: "Area capture",
  createdAt: 1,
  modifiedAt: 1,
  issues: 0,
  width: 1,
  height: 1,
  assetUrl: "thewcag-asset://capture/example",
  thumbnailUrl: null,
};

function setup() {
  const capture = {
    captureAll: vi.fn().mockResolvedValue([FRAME]),
    captureDisplayAtCursor: vi.fn().mockResolvedValue(FRAME),
  } as unknown as ScreenCaptureService;
  const captures = {
    create: vi.fn().mockResolvedValue(ENTRY),
  } as unknown as CaptureRepository;
  const windows = {
    openOverlays: vi.fn().mockResolvedValue(undefined),
    closeOverlays: vi.fn(),
    sendToMain: vi.fn(),
    broadcast: vi.fn(),
    openAnnotate: vi.fn(),
  } as unknown as WindowManager;
  return {
    coordinator: new CaptureCoordinator(capture, captures, windows),
    captures,
  };
}

describe("CaptureCoordinator scope", () => {
  it("keeps standalone region captures outside the active audit", async () => {
    const { coordinator, captures } = setup();
    coordinator.activateAudit("aud-a1234567");
    const session = await coordinator.begin("capture", undefined, true);
    await coordinator.complete(session.sessionId, {
      mode: "capture",
      rect: { x: 0, y: 0, width: 1, height: 1 },
      pngDataUrl: FRAME.dataUrl,
    });
    expect(captures.create).toHaveBeenCalledWith(
      FRAME.dataUrl,
      "Area capture",
      undefined,
    );
  });

  it("continues to scope audit evidence captures to the active audit", async () => {
    const { coordinator, captures } = setup();
    coordinator.activateAudit("aud-a1234567");
    const session = await coordinator.begin("capture");
    await coordinator.complete(session.sessionId, {
      mode: "capture",
      rect: { x: 0, y: 0, width: 1, height: 1 },
      pngDataUrl: FRAME.dataUrl,
    });
    expect(captures.create).toHaveBeenCalledWith(
      FRAME.dataUrl,
      "Area capture",
      "aud-a1234567",
    );
  });

  it("keeps standalone full-screen captures outside the active audit", async () => {
    const { coordinator, captures } = setup();
    coordinator.activateAudit("aud-a1234567");
    await coordinator.fullscreen(undefined, true);
    expect(captures.create).toHaveBeenCalledWith(
      FRAME.dataUrl,
      "Full screen capture",
      undefined,
    );
  });
});
