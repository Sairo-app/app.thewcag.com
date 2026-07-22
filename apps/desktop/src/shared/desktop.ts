import type {
  AffectedUser,
  DraftConfidence,
  FieldConfidenceV1,
  WcagMappingV1,
} from "@accessibility-build/audit-contracts";

export type AppView = "main" | "overlay" | "annotate" | "lens";
export type WorkspaceStage = "plan" | "inspect" | "evidence" | "review" | "share";
export type WorkspaceUtility = "screenshot" | "vision" | "palette" | "settings";
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
  goal: string;
  scope: string;
  sample: string;
  excludedScope: string;
  environment: string;
  assistiveTechnology: string;
  methodology: string;
  executiveSummary: string;
  limitations: string;
  conclusion:
    | "not-set"
    | "in-progress"
    | "meets-target"
    | "does-not-meet-target";
  completedAt: string;
  standard: "WCAG 2.2 A" | "WCAG 2.2 AA";
  auditor: string;
  startedAt: string;
  updatedAt: number;
}

export interface AuditSampleItem {
  id: string;
  kind: "page" | "flow" | "component" | "document" | "state";
  label: string;
  location: string;
  status: "planned" | "in-progress" | "complete" | "blocked";
  notes: string;
  createdAt: number;
  modifiedAt: number;
}

export interface AuditTestStepResult {
  id: string;
  label: string;
  complete: boolean;
  observation: string;
}

export interface AuditTestRun {
  id: string;
  scriptId: string;
  title: string;
  category: "authentication" | "checkout" | "forms" | "media" | "documents" | "components";
  status: "planned" | "in-progress" | "complete" | "blocked";
  steps: AuditTestStepResult[];
  notes: string;
  createdAt: number;
  modifiedAt: number;
}

export interface AuditTemplate {
  id: string;
  name: string;
  description: string;
  source: "built-in" | "personal";
  goal: string;
  scope: string;
  sample: string;
  excludedScope: string;
  environment: string;
  assistiveTechnology: string;
  methodology: string;
  standard: AuditBrief["standard"];
  sampleItems: Array<Pick<AuditSampleItem, "kind" | "label" | "location" | "notes">>;
  testScriptIds: string[];
  createdAt?: number;
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
  /** Immutable, globally unique platform identity. Never use the audit reference as identity. */
  id: string;
  key: string;
  reference?: string;
  title: string;
  wcag: string;
  severity: "blocker" | "major" | "minor";
  status: "open" | "retest" | "fixed" | "accepted";
  note: string;
  location?: string;
  owner?: string;
  ticket?: string;
  dueDate?: string;
  riskAcceptance?: string;
  retestNote?: string;
  retestedAt?: number;
  captureId?: string;
  beforeCaptureId?: string;
  afterCaptureId?: string;
  comparisonNote?: string;
  duplicateOf?: string;
  duplicateOfId?: string;
  occurrences?: FindingOccurrence[];
  createdAt: number;
  schemaVersion?: 2;
  description?: string;
  actualResult?: string;
  expectedResult?: string;
  userImpact?: string;
  affectedUsers?: AffectedUser[];
  severityRationale?: string;
  wcagMappings?: WcagMappingV1[];
  recommendation?: string;
  exampleFix?: string;
  reproductionSteps?: string[];
  evidenceId?: string;
  source?: "manual" | "local" | "ai";
  confidence?: DraftConfidence;
  fieldConfidence?: FieldConfidenceV1[];
  assumptions?: string[];
  manualChecks?: string[];
  provenance?: {
    model: string;
    modelVersion: string;
    promptVersion: string;
    knowledgeVersion: string;
    generatedAt: number;
  };
  modifiedAt?: number;
}

export interface FindingOccurrence {
  id: string;
  location: string;
  captureId?: string;
  note: string;
  createdAt: number;
}

export interface FindingSavedView {
  id: string;
  name: string;
  query: string;
  status: "all" | Finding["status"];
  severity: "all" | Finding["severity"];
  sort: "updated" | "severity" | "criterion" | "due";
  createdAt: number;
}

export interface ShortcutSettings {
  inspect: string;
  capture: string;
  lens: string;
}

export interface ChecklistShortcutSettings {
  pass: string;
  fail: string;
  notApplicable: string;
  next: string;
  previous: string;
  expand: string;
}

export interface AppSettings {
  shortcuts: ShortcutSettings;
  checklistShortcuts: ChecklistShortcutSettings;
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

export type AiProviderId = "thewcag" | "openai" | "anthropic" | "openrouter";
export type ApiKeyProviderId = Exclude<AiProviderId, "thewcag">;

export interface AiProviderStatus {
  id: AiProviderId;
  configured: boolean;
  active: boolean;
  model: string;
  keyHint?: string;
  verifiedAt?: number;
}

export interface AiConfiguration {
  activeProvider: AiProviderId;
  secureStorageAvailable: boolean;
  providers: AiProviderStatus[];
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
  | "navigation:tool"
  | "screenshot:share";

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
  | "capture:read-data"
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
  | "store:remove"
  | "store:add-findings"
  | "audit:activate"
  | "workspace:navigate"
  | "settings:get"
  | "settings:save"
  | "settings:reset"
  | "auth:sign-in"
  | "auth:sign-out"
  | "auth:account"
  | "ai:configuration"
  | "ai:save-provider"
  | "ai:test-provider"
  | "ai:remove-provider"
  | "ai:set-active"
  | "report:publish"
  | "dialog:save-image"
  | "dialog:save-text"
  | "dialog:open-text"
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
