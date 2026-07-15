import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface PickedColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  x: number;
  y: number;
}

export type OverlayMode = "pair" | "fg" | "bg" | "shot" | "measure";

export interface OverlayMeta {
  mode: OverlayMode;
  scale: number;
}

export const ipc = {
  screenPermissionStatus: () => invoke<boolean>("screen_permission_status"),
  requestScreenPermission: () => invoke<boolean>("request_screen_permission"),
  openScreenRecordingSettings: () => invoke<void>("open_screen_recording_settings"),
  restartApp: () => invoke<void>("restart_app"),
  captureFullscreen: () => invoke<string>("capture_fullscreen"),
  beginOverlay: (mode: OverlayMode, delayMs?: number) =>
    invoke<void>("begin_overlay", { mode, delayMs }),
  overlayMeta: () => invoke<OverlayMeta>("overlay_meta"),
  overlayPng: () => invoke<ArrayBuffer>("overlay_png"),
  closeOverlay: (reopenMain: boolean) => invoke<void>("close_overlay", { reopenMain }),
  storeAnnotation: (png: Uint8Array) => invoke<void>("store_annotation", png),
  annotationPng: () => invoke<ArrayBuffer>("annotation_png"),
  annotationMeta: () => invoke<{ id: string }>("annotation_meta"),
  saveAnnotationDoc: (id: string, json: string) =>
    invoke<void>("save_annotation_doc", { id, json }),
  loadAnnotationDoc: (id: string) => invoke<string | null>("load_annotation_doc", { id }),
  listAnnotationDocs: () =>
    invoke<{ id: string; modified_ms: number; issues: number }[]>("list_annotation_docs"),
  captureImage: (id: string, raw = false) => invoke<ArrayBuffer>("capture_image", { id, raw }),
  saveCaptureThumb: (id: string, png: Uint8Array) =>
    invoke<void>("save_capture_thumb", png, { headers: { id } }),
  openAnnotation: (id: string) => invoke<void>("open_annotation", { id }),
  deleteAnnotation: (id: string) => invoke<void>("delete_annotation", { id }),
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
  saveText: (text: string, name: string) =>
    invoke<string | null>("save_text", new TextEncoder().encode(text), {
      headers: { "x-name": name },
    }),
  checkUpdate: () => invoke<{ version: string; notes: string | null } | null>("check_update"),
  installUpdate: () => invoke<void>("install_update"),
  getShortcuts: () => invoke<Shortcuts>("get_shortcuts"),
  setShortcut: (action: keyof Shortcuts, shortcut: string) =>
    invoke<void>("set_shortcut", { action, shortcut }),
  resetShortcuts: () => invoke<Shortcuts>("reset_shortcuts"),
  signIn: () => invoke<void>("sign_in"),
  signOut: () => invoke<void>("sign_out"),
  getAccount: () => invoke<Account>("get_account"),
  publishReport: (title: string, description: string, issues: unknown, imageBase64: string) =>
    invoke<string>("publish_report", { title, description, issues, imageBase64 }),
  storeGet: (key: string) => invoke<string | null>("store_get", { key }),
  storeSet: (key: string, json: string) => invoke<void>("store_set", { key, json }),
  addFindings: (items: unknown) => invoke<void>("add_findings", { items }),
  openToolWindow: (kind: "findings" | "checklist" | "palette") =>
    invoke<void>("open_tool_window", { kind }),
};

export interface Account {
  signedIn: boolean;
  email?: string;
  credits?: number;
  plan?: string;
}

export interface Shortcuts {
  pick: string;
  shot: string;
  lens: string;
}

/** True on macOS. Used to render Mac glyphs vs. Windows key names. */
export const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

/**
 * "alt+super+KeyP" → "⌥⌘P" on macOS, "Alt+Win+P" on Windows.
 * (matches settings::display in Rust; platform-aware for glyphs vs. names).
 */
export function displayShortcut(shortcut: string): string {
  const mods: string[] = [];
  let key = "";
  for (const token of shortcut.split("+")) {
    switch (token.toLowerCase()) {
      case "ctrl":
      case "control":
        mods.push(isMac ? "⌃" : "Ctrl");
        break;
      case "alt":
      case "option":
        mods.push(isMac ? "⌥" : "Alt");
        break;
      case "shift":
        mods.push(isMac ? "⇧" : "Shift");
        break;
      case "super":
      case "cmd":
      case "command":
      case "meta":
        mods.push(isMac ? "⌘" : "Win");
        break;
      default:
        key = token.replace(/^Key/, "").replace(/^Digit/, "");
    }
  }
  const arrows: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  const keyDisp = arrows[key] ?? key.toUpperCase();
  // macOS stacks glyphs (⌥⌘P); Windows joins with + (Alt+Win+P).
  return isMac ? mods.join("") + keyDisp : [...mods, keyDisp].filter(Boolean).join("+");
}

export interface PickedPair {
  mode: OverlayMode;
  colors: PickedColor[];
  /** background is the worst-case pixel sampled from a dragged region */
  worst?: boolean;
}

function onEvent<T>(name: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  if (!isTauriRuntime) return Promise.resolve(() => {});
  return listen<T>(name, (event) => cb(event.payload));
}

export const events = {
  onPicked: (cb: (p: PickedPair) => void) => onEvent<PickedPair>("overlay-picked", cb),
  onScreenshotTaken: (cb: (path: string) => void) => onEvent<string>("screenshot-taken", cb),
  onCaptureError: (cb: (message: string) => void) => onEvent<string>("capture-error", cb),
  onPermissionNeeded: (cb: () => void) => onEvent<undefined>("permission-needed", cb),
  onAnnotateExported: (cb: (issues: string[]) => void) => onEvent<string[]>("annotate-exported", cb),
  onAccountChanged: (cb: () => void) => onEvent<undefined>("account-changed", cb),
};
