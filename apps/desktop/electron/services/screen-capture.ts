import { desktopCapturer, nativeImage, screen, shell, systemPreferences, type Display, type Rectangle } from "electron";
import type { LensFrame, ScreenFrame } from "../../src/shared/desktop";

function displayPixelSize(display: Display): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(display.bounds.width * display.scaleFactor)),
    height: Math.max(1, Math.round(display.bounds.height * display.scaleFactor)),
  };
}

export class ScreenCaptureService {
  private highDpi = true;

  setHighDpi(enabled: boolean): void {
    this.highDpi = enabled;
  }

  permissionStatus(): "granted" | "denied" | "restricted" | "unknown" | "not-determined" {
    if (process.platform !== "darwin") return "granted";
    return systemPreferences.getMediaAccessStatus("screen");
  }

  async requestPermission(): Promise<ReturnType<ScreenCaptureService["permissionStatus"]>> {
    if (process.platform !== "darwin") return "granted";
    try {
      await this.captureAll();
    } catch {
      return this.permissionStatus();
    }
    return this.permissionStatus();
  }

  async openPermissionSettings(): Promise<void> {
    if (process.platform !== "darwin") return;
    await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
  }

  async captureAll(): Promise<ScreenFrame[]> {
    const displays = screen.getAllDisplays();
    if (displays.length === 0) throw new Error("No displays are available for capture");
    const maximum = displays.reduce((size, display) => {
      const pixels = this.highDpi ? displayPixelSize(display) : display.bounds;
      return { width: Math.max(size.width, pixels.width), height: Math.max(size.height, pixels.height) };
    }, { width: 1, height: 1 });
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: maximum,
      fetchWindowIcons: false,
    });
    const frames = displays.map((display) => {
      const source = sources.find((item) => item.display_id === String(display.id));
      if (!source || source.thumbnail.isEmpty()) return null;
      const size = source.thumbnail.getSize();
      return {
        displayId: String(display.id),
        bounds: { ...display.bounds },
        scaleFactor: display.scaleFactor,
        width: size.width,
        height: size.height,
        dataUrl: source.thumbnail.toDataURL(),
      } satisfies ScreenFrame;
    }).filter((frame): frame is ScreenFrame => Boolean(frame));
    if (frames.length === 0) throw new Error("Screen capture permission is required");
    return frames;
  }

  async captureDisplayAtCursor(): Promise<ScreenFrame> {
    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    const frames = await this.captureAll();
    const frame = frames.find((item) => item.displayId === String(display.id));
    if (!frame) throw new Error("The active display could not be captured");
    return frame;
  }

  async lensFrame(windowBounds: Rectangle): Promise<LensFrame> {
    const center = {
      x: Math.round(windowBounds.x + windowBounds.width / 2),
      y: Math.round(windowBounds.y + windowBounds.height / 2),
    };
    const display = screen.getDisplayNearestPoint(center);
    const frames = await this.captureAll();
    const frame = frames.find((item) => item.displayId === String(display.id));
    if (!frame) throw new Error("The display beneath the lens could not be captured");
    const sx = frame.width / frame.bounds.width;
    const sy = frame.height / frame.bounds.height;
    const crop = {
      x: Math.max(0, Math.round((windowBounds.x - frame.bounds.x) * sx)),
      y: Math.max(0, Math.round((windowBounds.y - frame.bounds.y) * sy)),
      width: Math.min(frame.width, Math.max(1, Math.round(windowBounds.width * sx))),
      height: Math.min(frame.height, Math.max(1, Math.round(windowBounds.height * sy))),
    };
    crop.width = Math.min(crop.width, frame.width - crop.x);
    crop.height = Math.min(crop.height, frame.height - crop.y);
    const image = nativeImage.createFromDataURL(frame.dataUrl).crop(crop);
    return {
      dataUrl: image.toDataURL(),
      sourceRect: { x: windowBounds.x, y: windowBounds.y, width: windowBounds.width, height: windowBounds.height },
      scaleFactor: display.scaleFactor,
    };
  }
}
