import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface PickedColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  x: number;
  y: number;
}

export const ipc = {
  screenPermissionStatus: () => invoke<boolean>("screen_permission_status"),
  requestScreenPermission: () => invoke<boolean>("request_screen_permission"),
  openScreenRecordingSettings: () => invoke<void>("open_screen_recording_settings"),
  pickColorAtCursor: () => invoke<PickedColor>("pick_color_at_cursor"),
  captureFullscreen: () => invoke<string>("capture_fullscreen"),
};

export const events = {
  onColorPicked: (cb: (c: PickedColor) => void): Promise<UnlistenFn> =>
    listen<PickedColor>("color-picked", (e) => cb(e.payload)),
  onScreenshotTaken: (cb: (path: string) => void): Promise<UnlistenFn> =>
    listen<string>("screenshot-taken", (e) => cb(e.payload)),
  onCaptureError: (cb: (message: string) => void): Promise<UnlistenFn> =>
    listen<string>("capture-error", (e) => cb(e.payload)),
};
