import { join } from "node:path";
import { BrowserWindow, app, screen, type Display } from "electron";
import type { AppView, OverlaySession, ScreenFrame, WorkspaceTool } from "../src/shared/desktop";
import { hardenWebContents } from "./security";

const WINDOW_BACKGROUND = "#F7F0DF";

function preloadPath(): string {
  return join(import.meta.dirname, "../preload/index.js");
}

export class WindowManager {
  private main: BrowserWindow | null = null;
  private annotate: BrowserWindow | null = null;
  private lens: BrowserWindow | null = null;
  private overlays = new Map<number, BrowserWindow>();
  private overlaySessions = new Map<number, OverlaySession>();
  private quitting = false;

  constructor() {
    app.on("before-quit", () => { this.quitting = true; });
  }

  createMain(): BrowserWindow {
    if (this.main && !this.main.isDestroyed()) {
      this.showMain();
      return this.main;
    }
    const isMac = process.platform === "darwin";
    const window = new BrowserWindow({
      title: "TheWCAG",
      width: isMac ? 1240 : 1180,
      height: 800,
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
    this.secure(window);
    this.load(window, "main");
    window.once("ready-to-show", () => window.show());
    window.on("close", (event) => {
      if (!this.quitting && process.platform === "darwin") {
        event.preventDefault();
        window.hide();
      }
    });
    window.on("closed", () => { if (this.main === window) this.main = null; });
    this.main = window;
    return window;
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
  }

  closeOverlays(): void {
    for (const window of this.overlays.values()) {
      if (!window.isDestroyed()) window.destroy();
    }
    this.overlays.clear();
    this.overlaySessions.clear();
  }

  openAnnotate(captureId: string): BrowserWindow {
    if (this.annotate && !this.annotate.isDestroyed()) this.annotate.destroy();
    const window = new BrowserWindow({
      title: "Annotate capture - TheWCAG",
      width: 1240,
      height: 820,
      minWidth: 640,
      minHeight: 520,
      backgroundColor: WINDOW_BACKGROUND,
      show: false,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
      webPreferences: this.webPreferences(),
    });
    this.secure(window);
    this.load(window, "annotate", { capture: captureId });
    window.once("ready-to-show", () => window.show());
    window.on("closed", () => { if (this.annotate === window) this.annotate = null; });
    this.annotate = window;
    return window;
  }

  toggleLens(): boolean {
    if (this.lens && !this.lens.isDestroyed()) {
      this.lens.destroy();
      this.lens = null;
      return false;
    }
    const window = new BrowserWindow({
      title: "Vision lens - TheWCAG",
      width: 560,
      height: 420,
      minWidth: 360,
      minHeight: 260,
      backgroundColor: "#FFFDF7",
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
    this.secure(window);
    this.load(window, "lens");
    window.once("ready-to-show", () => window.show());
    window.on("closed", () => { if (this.lens === window) this.lens = null; });
    this.lens = window;
    return true;
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
      backgroundColor: "#10100F",
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
    this.secure(window);
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

  private secure(window: BrowserWindow): void {
    hardenWebContents(window.webContents);
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
