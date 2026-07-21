import { app, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { UpdateState } from "../../src/shared/desktop";

const { autoUpdater } = electronUpdater;

export class UpdateService {
  private state: UpdateState = { status: "idle" };

  constructor(private readonly broadcast: (state: UpdateState) => void) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => this.set({ status: "checking" }));
    autoUpdater.on("update-available", (info) => this.set({ status: "available", version: info.version }));
    autoUpdater.on("update-not-available", () => this.set({ status: "current", version: app.getVersion() }));
    autoUpdater.on("download-progress", (progress) => this.set({
      status: "downloading",
      progress: Math.round(progress.percent),
    }));
    autoUpdater.on("update-downloaded", (info) => this.set({ status: "ready", version: info.version }));
    autoUpdater.on("error", (error) => this.set({ status: "error", message: error.message }));
  }

  current(): UpdateState {
    return this.state;
  }

  async check(manual = true): Promise<UpdateState> {
    if (!app.isPackaged) {
      this.set({ status: "current", version: app.getVersion(), message: "Updates are checked in installed release builds" });
      return this.state;
    }
    if (!existsSync(join(process.resourcesPath, "app-update.yml"))) {
      this.set({ status: "current", version: app.getVersion(), message: "Updates are available in installed release builds" });
      return this.state;
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.updateInfo && result.updateInfo.version !== app.getVersion()) {
        await autoUpdater.downloadUpdate();
      } else if (manual) {
        this.set({ status: "current", version: app.getVersion() });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.set({
        status: "error",
        message: message.includes("app-update.yml")
          ? "Updates are available in installed release builds"
          : message,
      });
    }
    return this.state;
  }

  install(): void {
    if (this.state.status !== "ready") throw new Error("No downloaded update is ready");
    for (const window of BrowserWindow.getAllWindows()) window.setClosable(true);
    autoUpdater.quitAndInstall(false, true);
  }

  private set(state: UpdateState): void {
    this.state = state;
    this.broadcast(state);
  }
}
