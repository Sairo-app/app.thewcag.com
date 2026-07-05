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

export type OverlayMode = "pair" | "fg" | "bg" | "shot";

export interface OverlayMeta {
  mode: OverlayMode;
  scale: number;
}

export const ipc = {
  screenPermissionStatus: () => invoke<boolean>("screen_permission_status"),
  requestScreenPermission: () => invoke<boolean>("request_screen_permission"),
  openScreenRecordingSettings: () => invoke<void>("open_screen_recording_settings"),
  captureFullscreen: () => invoke<string>("capture_fullscreen"),
  beginOverlay: (mode: OverlayMode) => invoke<void>("begin_overlay", { mode }),
  overlayMeta: () => invoke<OverlayMeta>("overlay_meta"),
  overlayPng: () => invoke<ArrayBuffer>("overlay_png"),
  closeOverlay: (reopenMain: boolean) => invoke<void>("close_overlay", { reopenMain }),
  storeAnnotation: (png: Uint8Array) => invoke<void>("store_annotation", png),
  annotationPng: () => invoke<ArrayBuffer>("annotation_png"),
  toggleLens: () => invoke<void>("toggle_lens"),
  lensFrame: () => invoke<ArrayBuffer>("lens_frame"),
  copyPng: (png: Uint8Array) => invoke<void>("copy_png", png),
  savePng: (png: Uint8Array, name: string) =>
    invoke<string | null>("save_png", png, { headers: { "x-name": name } }),
  copyText: (text: string) => invoke<void>("copy_text", { text }),
  revealPath: (path: string) => invoke<void>("reveal_path", { path }),
  openSite: (url: string) => invoke<void>("open_site", { url }),
  autostartEnabled: () => invoke<boolean>("autostart_enabled"),
  setAutostart: (enabled: boolean) => invoke<void>("set_autostart", { enabled }),
};

export interface PickedPair {
  mode: OverlayMode;
  colors: PickedColor[];
}

export const events = {
  onPicked: (cb: (p: PickedPair) => void): Promise<UnlistenFn> =>
    listen<PickedPair>("overlay-picked", (e) => cb(e.payload)),
  onScreenshotTaken: (cb: (path: string) => void): Promise<UnlistenFn> =>
    listen<string>("screenshot-taken", (e) => cb(e.payload)),
  onCaptureError: (cb: (message: string) => void): Promise<UnlistenFn> =>
    listen<string>("capture-error", (e) => cb(e.payload)),
  onPermissionNeeded: (cb: () => void): Promise<UnlistenFn> =>
    listen("permission-needed", () => cb()),
};
