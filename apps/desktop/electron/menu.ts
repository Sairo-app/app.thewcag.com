import { Menu, Tray, app, nativeImage, shell } from "electron";
import { join } from "node:path";
import type { CaptureCoordinator } from "./services/capture-coordinator";
import type { WindowManager } from "./windows";

export interface NativeActions {
  windows: WindowManager;
  captures: CaptureCoordinator;
}

function iconPath(): string {
  return app.isPackaged ? join(process.resourcesPath, "logo.png") : join(app.getAppPath(), "public/logo.png");
}

export function installApplicationMenu(actions: NativeActions): void {
  const isMac = process.platform === "darwin";
  const run = (action: () => Promise<unknown>) => void action().catch((error) => actions.windows.broadcast("notification", { text: error instanceof Error ? error.message : String(error), error: true }));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{
      label: "TheWCAG",
      submenu: [
        { role: "about" as const },
        { type: "separator" as const },
        {
          label: "Settings…",
          accelerator: "CommandOrControl+,",
          click: () => actions.windows.navigate("settings"),
        },
        { type: "separator" as const },
        { role: "services" as const },
        { type: "separator" as const },
        { role: "hide" as const },
        { role: "hideOthers" as const },
        { role: "unhide" as const },
        { type: "separator" as const },
        { role: "quit" as const },
      ],
    }] : [{
      label: "File",
      submenu: [
        {
          label: "Settings",
          accelerator: "CommandOrControl+,",
          click: () => actions.windows.navigate("settings"),
        },
        { type: "separator" as const },
        { role: "quit" as const },
      ],
    }]),
    {
      label: "Audit",
      submenu: [
        { label: "Plan", accelerator: "CommandOrControl+1", click: () => actions.windows.navigate("plan") },
        { label: "Inspect", accelerator: "CommandOrControl+2", click: () => actions.windows.navigate("inspect") },
        { label: "Review", accelerator: "CommandOrControl+3", click: () => actions.windows.navigate("checklist") },
        { label: "Deliver", accelerator: "CommandOrControl+4", click: () => actions.windows.navigate("share") },
        { label: "Findings and capture library", click: () => actions.windows.navigate("evidence") },
        { label: "Standalone capture library", click: () => actions.windows.navigate("captures") },
        { type: "separator" },
        { label: "Sample contrast from screen", click: () => run(() => actions.captures.begin("pair")) },
        { label: "Capture region", click: () => run(() => actions.captures.begin("capture", undefined, {}, true)) },
        { label: "Capture full screen", click: () => run(() => actions.captures.fullscreen(undefined, {}, true)) },
        { type: "separator" },
        { label: "Toggle vision lens", click: () => actions.windows.toggleLens() },
      ],
    },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools", visible: !app.isPackaged }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, ...(isMac ? [{ role: "front" as const }] : [{ role: "close" as const }])] },
    {
      role: "help",
      submenu: [
        { label: "TheWCAG website", click: () => run(() => shell.openExternal("https://app.thewcag.com")) },
        { label: "Download TheWCAG", click: () => run(() => shell.openExternal("https://app.thewcag.com/download")) },
        { type: "separator" },
        { label: "Accessibility statement", click: () => run(() => shell.openExternal("https://app.thewcag.com/accessibility-statement")) },
      ],
    },
  ]));
}

export function createTray(actions: NativeActions): Tray {
  const run = (action: () => Promise<unknown>) => void action().catch((error) => actions.windows.broadcast("notification", { text: error instanceof Error ? error.message : String(error), error: true }));
  const icon = nativeImage.createFromPath(iconPath()).resize({ width: 18, height: 18 });
  if (process.platform === "darwin") icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip("TheWCAG");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open TheWCAG", click: () => actions.windows.showMain() },
    { type: "separator" },
    { label: "Inspect contrast", click: () => run(() => actions.captures.begin("pair")) },
    { label: "Capture area", click: () => run(() => actions.captures.begin("capture", undefined, {}, true)) },
    { label: "Capture full screen", click: () => run(() => actions.captures.fullscreen(undefined, {}, true)) },
    { label: "Toggle vision lens", click: () => actions.windows.toggleLens() },
    { type: "separator" },
    { label: "Standalone capture library", click: () => actions.windows.navigate("captures") },
    { label: "Audit findings", click: () => actions.windows.navigate("evidence") },
    { label: "WCAG checklist", click: () => actions.windows.navigate("checklist") },
    { label: "Settings", click: () => actions.windows.navigate("settings") },
    { type: "separator" },
    { label: "Quit TheWCAG", click: () => app.quit() },
  ]));
  tray.on("click", () => actions.windows.showMain());
  return tray;
}
