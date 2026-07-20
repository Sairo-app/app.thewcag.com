export type AppView = "main" | "overlay" | "annotate" | "lens";
export type WorkspaceStage = "inspect" | "evidence" | "review" | "share";
export type WorkspaceUtility = "vision" | "palette" | "settings";
export type WorkspaceTool = WorkspaceStage | WorkspaceUtility | "capture" | "checklist";
export type OverlayMode = "pair" | "foreground" | "background" | "capture" | "measure";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PickedColor extends Point {
  hex: string;
  r: number;
  g: number;
  b: number;
}

export interface PlatformInfo {
  platform: "macos" | "windows" | "linux";
  arch: string;
  version: string;
  windowId: number;
  view: AppView;
  reduceMotion: boolean;
}

export interface ScreenFrame {
  displayId: string;
  bounds: Rect;
  scaleFactor: number;
  width: number;
  height: number;
  dataUrl: string;
}

export interface OverlaySession {
  id: string;
  mode: OverlayMode;
  display: ScreenFrame;
}

export type OverlayResult =
  | { mode: "pair"; colors: [PickedColor, PickedColor] }
  | { mode: "foreground" | "background"; colors: [PickedColor] }
  | { mode: "measure"; rect: Rect }
  | { mode: "capture"; rect: Rect; pngDataUrl: string };

export interface CaptureEntry {
  id: string;
  auditId?: string;
  title: string;
  createdAt: number;
  modifiedAt: number;
  issues: number;
  width: number;
  height: number;
  assetUrl: string;
  thumbnailUrl: string | null;
}

export interface AuditBrief {
  project: string;
  target: string;
  scope: string;
  standard: "WCAG 2.2 A" | "WCAG 2.2 AA";
  auditor: string;
  startedAt: string;
  updatedAt: number;
}

export interface AuditProject extends AuditBrief {
  id: string;
  createdAt: number;
  archivedAt?: number;
}

export interface AuditActivity {
  id: string;
  auditId: string;
  kind: "created" | "captured" | "finding" | "review" | "exported" | "published" | "updated";
  title: string;
  detail?: string;
  createdAt: number;
  url?: string;
}

export interface PublishedReport {
  id: string;
  auditId: string;
  captureId: string;
  title: string;
  url: string;
  findingCount: number;
  createdAt: number;
}

export interface Finding {
  key: string;
  title: string;
  wcag: string;
  severity: "blocker" | "major" | "minor";
  status: "open" | "fixed" | "accepted";
  note: string;
  captureId?: string;
  createdAt: number;
}

export interface ShortcutSettings {
  inspect: string;
  capture: string;
  lens: string;
}

export interface AppSettings {
  shortcuts: ShortcutSettings;
  launchAtLogin: boolean;
  appearance: "light";
  reduceMotion: boolean;
  captureHighDpi: boolean;
}

export interface Account {
  signedIn: boolean;
  email?: string;
  credits?: number;
  plan?: string;
}

export interface UpdateState {
  status: "idle" | "checking" | "available" | "downloading" | "ready" | "current" | "error";
  version?: string;
  progress?: number;
  message?: string;
}

export interface LensFrame {
  dataUrl: string;
  sourceRect: Rect;
  scaleFactor: number;
}

export type DesktopEvent =
  | "overlay:init"
  | "overlay:progress"
  | "capture:result"
  | "capture:saved"
  | "account:changed"
  | "update:state"
  | "shortcut:failed"
  | "notification"
  | "navigation:tool";

export type InvokeChannel =
  | "app:platform"
  | "window:minimize"
  | "window:toggle-maximize"
  | "window:close"
  | "screen:permission"
  | "screen:request-permission"
  | "screen:open-settings"
  | "capture:begin"
  | "capture:fullscreen"
  | "capture:create"
  | "capture:list"
  | "capture:open"
  | "capture:read-document"
  | "capture:save-document"
  | "capture:save-thumbnail"
  | "capture:delete"
  | "capture:assign-unscoped"
  | "overlay:complete"
  | "overlay:sample"
  | "overlay:ready"
  | "overlay:cancel"
  | "lens:toggle"
  | "lens:frame"
  | "store:get"
  | "store:set"
  | "store:add-findings"
  | "audit:activate"
  | "workspace:navigate"
  | "settings:get"
  | "settings:save"
  | "settings:reset"
  | "auth:sign-in"
  | "auth:sign-out"
  | "auth:account"
  | "report:publish"
  | "dialog:save-image"
  | "dialog:save-text"
  | "clipboard:write-text"
  | "clipboard:write-image"
  | "shell:show-item"
  | "shell:open-external"
  | "update:check"
  | "update:install";

export interface DesktopBridge {
  invoke<T = unknown>(channel: InvokeChannel, payload?: unknown): Promise<T>;
  on<T = unknown>(event: DesktopEvent, listener: (payload: T) => void): () => void;
  platform: NodeJS.Platform;
}
