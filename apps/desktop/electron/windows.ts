import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { BrowserWindow, app, dialog, screen, type Display } from "electron";
import type { AppView, OverlaySession, ScreenFrame, WorkspaceTool } from "../src/shared/desktop";
import { hardenWebContents } from "./security";

// Pixel equivalents of the design tokens, used before the renderer paints.
const WINDOW_BACKGROUND = "#F7F0DF"; // --canvas oklch(0.968 0.026 84)
const DARK_CHROME_BACKGROUND = "#2B2118"; // --ink oklch(0.215 0.034 54)

function preloadPath(): string {
  return join(import.meta.dirname, "../preload/index.js");
}

type StoredWindowBounds = Record<string, { x: number; y: number; width: number; height: number }>;

function windowBoundsFile(): string {
  return join(app.getPath("userData"), "window-bounds.json");
}

function readStoredWindowBounds(): StoredWindowBounds {
  try {
    return JSON.parse(readFileSync(windowBoundsFile(), "utf8")) as StoredWindowBounds;
  } catch {
    return {};
  }
}

function storedWindowBounds(key: string): StoredWindowBounds[string] | null {
  const bounds = readStoredWindowBounds()[key];
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.width)) return null;
  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
  return visible ? bounds : null;
}

function rememberWindowBounds(window: BrowserWindow, key: string): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
    const all = readStoredWindowBounds();
    all[key] = window.getBounds();
    try {
      writeFileSync(windowBoundsFile(), JSON.stringify(all));
    } catch {
      // Bounds persistence is best effort.
    }
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 400);
  };
  window.on("move", schedule);
  window.on("resize", schedule);
  window.on("close", save);
}

export class WindowManager {
  private main: BrowserWindow | null = null;
  private annotate: BrowserWindow | null = null;
  private annotateTransition: Promise<void> = Promise.resolve();
  private annotateFlushes = new Map<string, {
    contentsId: number;
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private lens: BrowserWindow | null = null;
  private overlays = new Map<number, BrowserWindow>();
  private overlaySessions = new Map<number, OverlaySession>();
  private quitting = false;
  private mainFailureReported = false;

  constructor(private readonly reportError: (error: Error) => void = () => undefined) {
    app.on("before-quit", () => { this.quitting = true; });
  }

  createMain(): BrowserWindow {
    if (this.main && !this.main.isDestroyed()) {
      return this.main;
    }
    const isMac = process.platform === "darwin";
    const savedBounds = storedWindowBounds("main");
    const window = new BrowserWindow({
      title: "TheWCAG",
      width: 1240,
      height: 800,
      ...(savedBounds ?? {}),
      minWidth: 640,
      minHeight: 520,
      backgroundColor: WINDOW_BACKGROUND,
      show: false,
      frame: true,
      titleBarStyle: isMac ? "hiddenInset" : "default",
      trafficLightPosition: isMac ? { x: 16, y: 18 } : undefined,
      webPreferences: this.webPreferences(),
    });
    if (isMac) window.setWindowButtonVisibility(true);
    this.secure(window, "main");
    void this.load(window, "main").catch((error) => this.reportLoadFailure("main", error));
    window.once("ready-to-show", () => window.show());
    window.on("close", (event) => {
      if (!this.quitting && process.platform === "darwin") {
        event.preventDefault();
        window.hide();
      }
    });
    window.on("closed", () => { if (this.main === window) this.main = null; });
    rememberWindowBounds(window, "main");
    this.main = window;
    return window;
  }

  isAnnotateWindow(window: BrowserWindow | null): boolean {
    return Boolean(window && this.annotate === window && !window.isDestroyed());
  }

  showMain(): void {
    const window = this.createMain();
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }

  navigate(tool: WorkspaceTool): void {
    this.showMain();
    this.sendToMain("navigation:tool", tool);
  }

  async openOverlays(sessionId: string, mode: OverlaySession["mode"], frames: ScreenFrame[]): Promise<void> {
    this.closeOverlays();
    const displays = screen.getAllDisplays();
    for (const frame of frames) {
      const display = displays.find((item) => String(item.id) === frame.displayId);
      if (!display) continue;
      const window = this.createOverlayWindow(display);
      this.overlays.set(window.id, window);
      this.overlaySessions.set(window.webContents.id, { id: sessionId, mode, display: frame });
      await this.load(window, "overlay", { session: sessionId, display: frame.displayId, mode });
      window.webContents.send("overlay:init", { id: sessionId, mode, display: frame });
      window.showInactive();
    }
    // Give keyboard focus to the overlay on the display under the cursor so the
    // advertised arrow/Enter/Escape controls work without a click first.
    const cursor = screen.getCursorScreenPoint();
    const cursorDisplay = screen.getDisplayNearestPoint(cursor);
    for (const [, overlay] of this.overlays) {
      const bounds = overlay.getBounds();
      const matches =
        cursor.x >= bounds.x && cursor.x < bounds.x + bounds.width &&
        cursor.y >= bounds.y && cursor.y < bounds.y + bounds.height;
      if (matches || String(cursorDisplay.id) === String(this.overlaySessions.get(overlay.webContents.id)?.display.displayId ?? "")) {
        overlay.show();
        overlay.focus();
        break;
      }
    }
  }

  closeOverlays(): void {
    for (const window of this.overlays.values()) {
      if (!window.isDestroyed()) window.destroy();
    }
    this.overlays.clear();
    this.overlaySessions.clear();
  }

  openAnnotate(captureId: string): Promise<BrowserWindow> {
    const replace = async (): Promise<BrowserWindow> => {
      const existing = this.annotate;
      if (existing && !existing.isDestroyed()) {
        await this.flushAnnotate(existing);
        if (!existing.isDestroyed()) existing.destroy();
      }
      return this.createAnnotate(captureId);
    };
    const transition = this.annotateTransition.then(replace, replace);
    this.annotateTransition = transition.then(() => undefined, () => undefined);
    return transition;
  }

  acknowledgeAnnotationFlush(
    contentsId: number,
    token: string,
    ok: boolean,
    message?: string,
  ): boolean {
    const pending = this.annotateFlushes.get(token);
    if (!pending || pending.contentsId !== contentsId) return false;
    clearTimeout(pending.timer);
    this.annotateFlushes.delete(token);
    if (ok) pending.resolve();
    else pending.reject(new Error(message || "The open annotation could not be saved"));
    return true;
  }

  private createAnnotate(captureId: string): BrowserWindow {
    const savedBounds = storedWindowBounds("annotate");
    const window = new BrowserWindow({
      title: "Annotate capture - TheWCAG",
      width: 1240,
      height: 820,
      ...(savedBounds ?? {}),
      minWidth: 640,
      minHeight: 520,
      backgroundColor: WINDOW_BACKGROUND,
      show: false,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
      trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 18 } : undefined,
      webPreferences: this.webPreferences(),
    });
    this.secure(window, "annotate");
    void this.load(window, "annotate", { capture: captureId }).catch((error) => this.reportLoadFailure("annotate", error));
    window.once("ready-to-show", () => window.show());
    rememberWindowBounds(window, "annotate");
    window.on("closed", () => { if (this.annotate === window) this.annotate = null; });
    this.annotate = window;
    return window;
  }

  private flushAnnotate(window: BrowserWindow): Promise<void> {
    const token = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.annotateFlushes.delete(token);
        reject(new Error("The open annotation did not finish saving; its window was kept open"));
      }, 10_000);
      this.annotateFlushes.set(token, {
        contentsId: window.webContents.id,
        resolve,
        reject,
        timer,
      });
      window.webContents.send("annotate:flush", { token });
    });
  }

  toggleLens(): boolean {
    if (this.lens && !this.lens.isDestroyed()) {
      this.lens.destroy();
      this.lens = null;
      this.broadcast("lens:changed", false);
      return false;
    }
    const savedLensBounds = storedWindowBounds("lens");
    const window = new BrowserWindow({
      title: "Vision lens - TheWCAG",
      width: 560,
      height: 420,
      ...(savedLensBounds ?? {}),
      minWidth: 360,
      minHeight: 260,
      backgroundColor: DARK_CHROME_BACKGROUND,
      show: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      frame: false,
      transparent: false,
      hasShadow: true,
      webPreferences: this.webPreferences(),
    });
    window.setAlwaysOnTop(true, "floating");
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.setContentProtection(true);
    this.secure(window, "lens");
    void this.load(window, "lens").catch((error) => this.reportLoadFailure("lens", error));
    window.once("ready-to-show", () => window.show());
    rememberWindowBounds(window, "lens");
    window.on("closed", () => {
      if (this.lens === window) {
        this.lens = null;
        this.broadcast("lens:changed", false);
      }
    });
    this.lens = window;
    this.broadcast("lens:changed", true);
    return true;
  }

  lensOpen(): boolean {
    return Boolean(this.lens && !this.lens.isDestroyed());
  }

  lensWindow(): BrowserWindow | null {
    return this.lens && !this.lens.isDestroyed() ? this.lens : null;
  }

  windowForContentsId(id: number): BrowserWindow | null {
    return BrowserWindow.getAllWindows().find((window) => window.webContents.id === id) ?? null;
  }

  overlaySessionForContents(id: number): OverlaySession | null {
    return this.overlaySessions.get(id) ?? null;
  }

  sendToMain(channel: string, payload: unknown): void {
    if (this.main && !this.main.isDestroyed()) this.main.webContents.send(channel, payload);
  }

  broadcast(channel: string, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload);
    }
  }

  private createOverlayWindow(display: Display): BrowserWindow {
    const window = new BrowserWindow({
      title: "Screen inspection - TheWCAG",
      ...display.bounds,
      frame: false,
      transparent: false,
      backgroundColor: DARK_CHROME_BACKGROUND,
      alwaysOnTop: true,
      skipTaskbar: true,
      movable: false,
      resizable: false,
      fullscreenable: false,
      show: false,
      webPreferences: this.webPreferences(),
    });
    window.setAlwaysOnTop(true, "screen-saver");
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.secure(window, "overlay");
    const contentsId = window.webContents.id;
    window.on("closed", () => {
      this.overlays.delete(window.id);
      this.overlaySessions.delete(contentsId);
    });
    return window;
  }

  private webPreferences(): Electron.WebPreferences {
    return {
      preload: preloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    };
  }

  private secure(window: BrowserWindow, view: AppView): void {
    hardenWebContents(window.webContents);
    window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
      if (isMainFrame && code !== -3) {
        this.reportRendererFailure(view, new Error(`Renderer failed to load ${url} (${code}: ${description})`));
      }
    });
    window.webContents.on("render-process-gone", (_event, details) => {
      if (details.reason !== "clean-exit") {
        this.reportRendererFailure(view, new Error(`Renderer process ended (${details.reason}, exit code ${details.exitCode})`));
      }
    });
  }

  private reportLoadFailure(view: AppView, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    this.reportRendererFailure(view, new Error(`Unable to open the ${view} renderer: ${detail}`));
  }

  private reportRendererFailure(view: AppView, error: Error): void {
    this.reportError(error);
    if (view !== "main" || this.mainFailureReported || this.quitting) return;
    this.mainFailureReported = true;
    dialog.showErrorBox(
      "TheWCAG could not open",
      `The application window failed to load. Restart TheWCAG or reinstall the latest version.\n\n${error.message}`,
    );
  }

  private async load(window: BrowserWindow, view: AppView, extra: Record<string, string> = {}): Promise<void> {
    const query = { view, ...extra };
    if (process.env.ELECTRON_RENDERER_URL) {
      const url = new URL(process.env.ELECTRON_RENDERER_URL);
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
      await window.loadURL(url.toString());
    } else {
      await window.loadFile(join(import.meta.dirname, "../renderer/index.html"), { query });
    }
  }
}
