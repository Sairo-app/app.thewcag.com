import { Menu, Tray, app, nativeImage } from "electron";
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
        { role: "services" as const },
        { type: "separator" as const },
        { role: "hide" as const },
        { role: "hideOthers" as const },
        { role: "unhide" as const },
        { type: "separator" as const },
        { role: "quit" as const },
      ],
    }] : []),
    {
      label: "Audit",
      submenu: [
        { label: "Inspect contrast", click: () => run(() => actions.captures.begin("pair")) },
        { label: "Capture area", click: () => run(() => actions.captures.begin("capture")) },
        { label: "Capture full screen", click: () => run(() => actions.captures.fullscreen()) },
        { type: "separator" },
        { label: "Toggle vision lens", click: () => actions.windows.toggleLens() },
      ],
    },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools", visible: !app.isPackaged }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, ...(isMac ? [{ role: "front" as const }] : [{ role: "close" as const }])] },
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
    { label: "Capture area", click: () => run(() => actions.captures.begin("capture")) },
    { label: "Capture full screen", click: () => run(() => actions.captures.fullscreen()) },
    { label: "Toggle vision lens", click: () => actions.windows.toggleLens() },
    { type: "separator" },
    { label: "Findings", click: () => actions.windows.navigate("evidence") },
    { label: "WCAG checklist", click: () => actions.windows.navigate("checklist") },
    { label: "Settings", click: () => actions.windows.navigate("settings") },
    { type: "separator" },
    { label: "Quit TheWCAG", click: () => app.quit() },
  ]));
  tray.on("click", () => actions.windows.showMain());
  return tray;
}
