import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell, type IpcMainInvokeEvent } from "electron";
import type {
  AppSettings,
  AppView,
  InvokeChannel,
  OverlayMode,
  OverlayResult,
  PickedColor,
  Rect,
  PlatformInfo,
  WorkspaceTool,
} from "../src/shared/desktop";
import { assertTrustedSender, safeExternalUrl } from "./security";
import type { AuthService } from "./services/auth";
import type { CaptureCoordinator } from "./services/capture-coordinator";
import type { CaptureRepository } from "./services/captures";
import type { ScreenCaptureService } from "./services/screen-capture";
import type { SettingsService } from "./services/settings";
import type { JsonStore } from "./services/store";
import type { UpdateService } from "./services/updater";
import type { WindowManager } from "./windows";

interface Services {
  auth: AuthService;
  captureCoordinator: CaptureCoordinator;
  captures: CaptureRepository;
  capture: ScreenCaptureService;
  settings: SettingsService;
  store: JsonStore;
  updates: UpdateService;
  windows: WindowManager;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid desktop request");
  return value as Record<string, unknown>;
}

function stringField(value: Record<string, unknown>, key: string, max = 10_000): string {
  const field = value[key];
  if (typeof field !== "string" || field.length > max) throw new Error(`Invalid ${key}`);
  return field;
}

function currentWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error("Desktop window is unavailable");
  return window;
}

function viewFromUrl(raw: string): AppView {
  try {
    const view = new URL(raw).searchParams.get("view");
    return ["main", "overlay", "annotate", "lens"].includes(view ?? "") ? view as AppView : "main";
  } catch {
    return "main";
  }
}

function modeOf(value: unknown): OverlayMode {
  if (!["pair", "foreground", "background", "capture", "measure"].includes(String(value))) {
    throw new Error("Unsupported inspection mode");
  }
  return value as OverlayMode;
}

function finiteNumber(value: unknown, label: string, min = -1_000_000, max = 1_000_000): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${label}`);
  return value;
}

function pickedColor(value: unknown): PickedColor {
  const color = asObject(value);
  const hex = stringField(color, "hex", 7).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) throw new Error("Invalid sampled color");
  return {
    hex,
    r: finiteNumber(color.r, "red channel", 0, 255),
    g: finiteNumber(color.g, "green channel", 0, 255),
    b: finiteNumber(color.b, "blue channel", 0, 255),
    x: finiteNumber(color.x, "screen x"),
    y: finiteNumber(color.y, "screen y"),
  };
}

function selectionRect(value: unknown): Rect {
  const rect = asObject(value);
  return {
    x: finiteNumber(rect.x, "selection x"),
    y: finiteNumber(rect.y, "selection y"),
    width: finiteNumber(rect.width, "selection width", 1, 100_000),
    height: finiteNumber(rect.height, "selection height", 1, 100_000),
  };
}

function overlayResult(value: unknown): OverlayResult {
  const result = asObject(value);
  const mode = modeOf(result.mode);
  if (mode === "capture") return { mode, rect: selectionRect(result.rect), pngDataUrl: stringField(result, "pngDataUrl", 50 * 1024 * 1024) };
  if (mode === "measure") return { mode, rect: selectionRect(result.rect) };
  if (!Array.isArray(result.colors)) throw new Error("Invalid sampled colors");
  if (mode === "pair") {
    if (result.colors.length !== 2) throw new Error("A contrast pair needs two colors");
    return { mode, colors: [pickedColor(result.colors[0]), pickedColor(result.colors[1])] };
  }
  if (result.colors.length !== 1) throw new Error("Expected one sampled color");
  return { mode, colors: [pickedColor(result.colors[0])] };
}

function register(channel: InvokeChannel, callback: (event: IpcMainInvokeEvent, payload: unknown) => unknown): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, payload) => {
    assertTrustedSender(event);
    return callback(event, payload);
  });
}

export function registerIpc(services: Services): void {
  register("app:platform", async (event) => {
    const settings = await services.settings.get();
    return {
      platform: process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux",
      arch: process.arch,
      version: app.getVersion(),
      windowId: currentWindow(event).id,
      view: viewFromUrl(event.sender.getURL()),
      reduceMotion: settings.reduceMotion,
    } satisfies PlatformInfo;
  });

  register("window:minimize", (event) => currentWindow(event).minimize());
  register("window:toggle-maximize", (event) => {
    const window = currentWindow(event);
    window.isMaximized() ? window.unmaximize() : window.maximize();
  });
  register("window:close", (event) => currentWindow(event).close());

  register("screen:permission", () => services.capture.permissionStatus());
  register("screen:request-permission", () => services.capture.requestPermission());
  register("screen:open-settings", () => services.capture.openPermissionSettings());

  register("capture:begin", async (_event, payload) => {
    const request = asObject(payload);
    const mode = modeOf(request.mode);
    const auditId = typeof request.auditId === "string" ? stringField(request, "auditId", 48) : undefined;
    return services.captureCoordinator.begin(mode, auditId);
  });

  register("capture:fullscreen", (_event, payload) => {
    const value = payload ? asObject(payload) : {};
    const auditId = typeof value.auditId === "string" ? stringField(value, "auditId", 48) : undefined;
    return services.captureCoordinator.fullscreen(auditId);
  });

  register("capture:create", async (_event, payload) => {
    const value = asObject(payload);
    const entry = await services.captures.create(
      stringField(value, "pngDataUrl", 50 * 1024 * 1024),
      stringField(value, "title", 160),
      typeof value.auditId === "string" ? stringField(value, "auditId", 48) : undefined,
    );
    services.windows.sendToMain("capture:saved", entry);
    if (value.silent !== true) services.windows.openAnnotate(entry.id);
    return entry;
  });

  register("capture:list", (_event, payload) => {
    const value = payload ? asObject(payload) : {};
    return services.captures.list(typeof value.auditId === "string" ? stringField(value, "auditId", 48) : undefined);
  });
  register("capture:open", (_event, payload) => {
    const id = stringField(asObject(payload), "id", 100);
    services.windows.openAnnotate(id);
  });
  register("capture:read-document", (_event, payload) => services.captures.readDocument(stringField(asObject(payload), "id", 100)));
  register("capture:read-data", (_event, payload) => {
    const value = asObject(payload);
    const kind = value.kind === "thumbnail" ? "thumbnail" : "raw";
    return services.captures.readDataUrl(stringField(value, "id", 100), kind);
  });
  register("capture:save-document", async (_event, payload) => {
    const value = asObject(payload);
    await services.captures.saveDocument(stringField(value, "id", 100), stringField(value, "json", 8 * 1024 * 1024));
  });
  register("capture:save-thumbnail", async (_event, payload) => {
    const value = asObject(payload);
    await services.captures.saveThumbnail(stringField(value, "id", 100), stringField(value, "pngDataUrl", 50 * 1024 * 1024));
  });
  register("capture:delete", (_event, payload) => services.captures.delete(stringField(asObject(payload), "id", 100)));
  register("capture:assign-unscoped", (_event, payload) => services.captures.assignUnscoped(stringField(asObject(payload), "auditId", 48)));

  register("overlay:complete", async (event, payload) => {
    const value = asObject(payload);
    const sessionId = stringField(value, "sessionId", 100);
    if (viewFromUrl(event.sender.getURL()) !== "overlay") throw new Error("Inspection result came from the wrong window");
    const result = overlayResult(value.result);
    return services.captureCoordinator.complete(sessionId, result);
  });
  register("overlay:sample", (event, payload) => {
    if (viewFromUrl(event.sender.getURL()) !== "overlay") throw new Error("Color sample came from the wrong window");
    const value = asObject(payload);
    return services.captureCoordinator.sample(stringField(value, "sessionId", 100), pickedColor(value.color));
  });
  register("overlay:ready", (event) => {
    if (viewFromUrl(event.sender.getURL()) !== "overlay") throw new Error("Overlay state was requested from the wrong window");
    const session = services.windows.overlaySessionForContents(event.sender.id);
    if (!session) throw new Error("Inspection session is unavailable");
    return session;
  });
  register("overlay:cancel", () => {
    services.captureCoordinator.cancel();
  });

  register("lens:toggle", () => services.windows.toggleLens());
  register("lens:frame", async (event) => {
    const window = currentWindow(event);
    if (window !== services.windows.lensWindow()) throw new Error("Lens frames are only available to the lens window");
    return services.capture.lensFrame(window.getBounds());
  });

  register("store:get", (_event, payload) => services.store.getRaw(stringField(asObject(payload), "key", 64)));
  register("store:set", async (_event, payload) => {
    const value = asObject(payload);
    await services.store.setRaw(stringField(value, "key", 64), stringField(value, "json", 10 * 1024 * 1024));
  });
  register("store:remove", (_event, payload) =>
    services.store.remove(stringField(asObject(payload), "key", 64)),
  );
  register("store:add-findings", (_event, payload) => {
    const value = asObject(payload);
    return services.store.addFindings(value.items, typeof value.auditId === "string" ? stringField(value, "auditId", 48) : undefined);
  });
  register("audit:activate", (_event, payload) => services.captureCoordinator.activateAudit(stringField(asObject(payload), "auditId", 48)));
  register("workspace:navigate", (event, payload) => {
    const tool = stringField(asObject(payload), "tool", 24);
    const allowed: WorkspaceTool[] = ["plan", "inspect", "evidence", "review", "share", "vision", "palette", "settings", "capture", "checklist"];
    if (!allowed.includes(tool as WorkspaceTool)) throw new Error("Unsupported workspace destination");
    services.windows.navigate(tool as WorkspaceTool);
    if (viewFromUrl(event.sender.getURL()) !== "main") currentWindow(event).close();
  });

  register("settings:get", () => services.settings.get());
  register("settings:save", (_event, payload) => services.settings.save(payload as AppSettings));
  register("settings:reset", () => services.settings.reset());

  register("auth:sign-in", () => services.auth.signIn());
  register("auth:sign-out", async () => {
    await services.auth.signOut();
    services.windows.broadcast("account:changed", null);
  });
  register("auth:account", () => services.auth.getAccount());
  register("report:publish", (_event, payload) => services.auth.publish(payload));

  register("dialog:save-image", async (event, payload) => {
    const value = asObject(payload);
    const dataUrl = stringField(value, "pngDataUrl", 50 * 1024 * 1024);
    const name = stringField(value, "name", 140).replace(/[^a-zA-Z0-9._-]/g, "-");
    const response = await dialog.showSaveDialog(currentWindow(event), {
      defaultPath: name.endsWith(".png") ? name : `${name}.png`,
      filters: [{ name: "PNG image", extensions: ["png"] }],
    });
    if (response.canceled || !response.filePath) return null;
    const image = nativeImage.createFromDataURL(dataUrl);
    await import("node:fs/promises").then(({ writeFile }) => writeFile(response.filePath!, image.toPNG()));
    return response.filePath;
  });
  register("dialog:save-text", async (event, payload) => {
    const value = asObject(payload);
    const name = stringField(value, "name", 140).replace(/[^a-zA-Z0-9._-]/g, "-");
    const maximum = name.endsWith(".thewcag-audit.json")
      ? 300 * 1024 * 1024
      : 10 * 1024 * 1024;
    const text = stringField(value, "text", maximum);
    const response = await dialog.showSaveDialog(currentWindow(event), { defaultPath: name });
    if (response.canceled || !response.filePath) return null;
    await import("node:fs/promises").then(({ writeFile }) => writeFile(response.filePath!, text, "utf8"));
    return response.filePath;
  });
  register("dialog:open-text", async (event, payload) => {
    const value = asObject(payload);
    const extension = typeof value.extension === "string"
      ? value.extension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)
      : "json";
    const response = await dialog.showOpenDialog(currentWindow(event), {
      properties: ["openFile"],
      filters: [{ name: "TheWCAG audit package", extensions: [extension || "json"] }],
    });
    if (response.canceled || !response.filePaths[0]) return null;
    const { readFile, stat } = await import("node:fs/promises");
    const file = response.filePaths[0];
    const size = await stat(file);
    if (size.size > 300 * 1024 * 1024) throw new Error("The audit package is too large");
    return readFile(file, "utf8");
  });
  register("clipboard:write-text", (_event, payload) => clipboard.writeText(stringField(asObject(payload), "text", 2 * 1024 * 1024)));
  register("clipboard:write-image", (_event, payload) => clipboard.writeImage(nativeImage.createFromDataURL(stringField(asObject(payload), "pngDataUrl", 50 * 1024 * 1024))));
  register("shell:show-item", (_event, payload) => shell.showItemInFolder(stringField(asObject(payload), "path", 4_096)));
  register("shell:open-external", (_event, payload) => shell.openExternal(safeExternalUrl(stringField(asObject(payload), "url", 2_048))));

  register("update:check", () => services.updates.check(true));
  register("update:install", () => services.updates.install());
}
