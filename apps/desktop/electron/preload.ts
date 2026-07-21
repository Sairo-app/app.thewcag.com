import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, DesktopEvent, InvokeChannel } from "../src/shared/desktop";

const INVOKE_CHANNELS = new Set<InvokeChannel>([
  "app:platform",
  "window:minimize",
  "window:toggle-maximize",
  "window:close",
  "screen:permission",
  "screen:request-permission",
  "screen:open-settings",
  "capture:begin",
  "capture:fullscreen",
  "capture:create",
  "capture:list",
  "capture:open",
  "capture:read-document",
  "capture:read-data",
  "capture:save-document",
  "capture:save-thumbnail",
  "capture:delete",
  "capture:assign-unscoped",
  "overlay:complete",
  "overlay:sample",
  "overlay:ready",
  "overlay:cancel",
  "lens:toggle",
  "lens:frame",
  "store:get",
  "store:set",
  "store:remove",
  "store:add-findings",
  "audit:activate",
  "workspace:navigate",
  "settings:get",
  "settings:save",
  "settings:reset",
  "auth:sign-in",
  "auth:sign-out",
  "auth:account",
  "report:publish",
  "dialog:save-image",
  "dialog:save-text",
  "dialog:open-text",
  "clipboard:write-text",
  "clipboard:write-image",
  "shell:show-item",
  "shell:open-external",
  "update:check",
  "update:install",
]);

const EVENT_CHANNELS = new Set<DesktopEvent>([
  "overlay:init",
  "overlay:progress",
  "capture:result",
  "capture:saved",
  "account:changed",
  "update:state",
  "shortcut:failed",
  "notification",
  "navigation:tool",
]);

const bridge: DesktopBridge = Object.freeze({
  platform: process.platform,
  invoke<T>(channel: InvokeChannel, payload?: unknown) {
    if (!INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error("Unsupported desktop operation"));
    return ipcRenderer.invoke(channel, payload) as Promise<T>;
  },
  on<T>(event: DesktopEvent, listener: (payload: T) => void) {
    if (!EVENT_CHANNELS.has(event)) return () => undefined;
    const wrapped = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  },
});

contextBridge.exposeInMainWorld("thewcag", bridge);
