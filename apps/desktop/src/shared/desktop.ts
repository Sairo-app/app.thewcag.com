import type {
  AffectedUser,
  DraftConfidence,
  FieldConfidenceV1,
  WcagMappingV1,
} from "@accessibility-build/audit-contracts";

export type AppView = "main" | "overlay" | "annotate" | "lens";
export type WorkspaceStage = "plan" | "inspect" | "evidence" | "review" | "share";
export type WorkspaceUtility = "program" | "captures" | "vision" | "palette" | "settings";
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
  sampleItemId?: string;
  testRunId?: string;
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
  scopeProfile?: AuditScopeProfile;
}

export type AuditTargetType =
  | "content-site"
  | "web-product"
  | "commerce-service"
  | "release-regression"
  | "desktop-product"
  | "mobile-product"
  | "document-set"
  | "component-library";

export type AuditScopeFeature =
  | "authentication"
  | "checkout"
  | "forms"
  | "media"
  | "documents"
  | "components";

export interface AuditScopeProfile {
  version: 1;
  targetType: AuditTargetType;
  featureIds: AuditScopeFeature[];
  templateId: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  confirmedAt: number;
}

export interface AuditScopeDiscoveryPage {
  url: string;
  title: string;
  templateKey: string;
  signals: string[];
}

export interface AuditScopeDiscovery {
  requestedUrl: string;
  finalUrl: string;
  title: string;
  targetType: Extract<AuditTargetType, "content-site" | "web-product" | "commerce-service">;
  featureIds: AuditScopeFeature[];
  pages: AuditScopeDiscoveryPage[];
  discoveredUrlCount: number;
  templateCount: number;
  warnings: string[];
  discoveredAt: number;
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
  sampleItemId?: string;
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
  targetType?: AuditTargetType;
  featureIds?: AuditScopeFeature[];
  createdAt?: number;
}

export interface AuditProject extends AuditBrief {
  id: string;
  createdAt: number;
  archivedAt?: number;
  /** Bundled training data. Never inferred for a user's real audit. */
  demo?: boolean;
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

export type TicketConnectorId = "jira" | "linear" | "github";
export type TicketSourceField =
  | "title"
  | "description"
  | "actualResult"
  | "expectedResult"
  | "userImpact"
  | "wcagMapping"
  | "severity"
  | "evidenceLink"
  | "owner"
  | "targetDate";
export type TicketFieldMapping = Record<TicketSourceField, string>;
export type TicketFieldValues = Record<TicketSourceField, string>;

export interface TicketExternalSnapshot {
  fields: Partial<TicketFieldValues>;
  status: string;
  fetchedAt: number;
}

export interface TicketSyncConflict {
  field: TicketSourceField | "status";
  kind: "external-change" | "diverged";
  baselineValue: string;
  localValue: string;
  externalValue: string;
}

export interface FindingTicketLink {
  connector: TicketConnectorId;
  externalId: string;
  key: string;
  url: string;
  externalStatus: string;
  syncState: "in-sync" | "review" | "error";
  baseline: TicketExternalSnapshot;
  pendingExternal?: TicketExternalSnapshot;
  conflicts: TicketSyncConflict[];
  createdAt: number;
  lastSyncedAt: number;
  lastError?: string;
}

export interface TicketConnectorPublicConfig {
  id: TicketConnectorId;
  label: string;
  configured: boolean;
  credentialHint?: string;
  mapping: TicketFieldMapping;
  baseUrl?: string;
  email?: string;
  projectKey?: string;
  issueType?: string;
  teamId?: string;
  repository?: string;
}

export interface TicketConnectorConfiguration {
  secureStorageAvailable: boolean;
  connectors: TicketConnectorPublicConfig[];
}

export interface Finding {
  key: string;
  reference?: string;
  sampleItemId?: string;
  testRunId?: string;
  title: string;
  wcag: string;
  severity: "blocker" | "major" | "minor";
  status: "open" | "retest" | "fixed" | "accepted";
  note: string;
  location?: string;
  owner?: string;
  ticket?: string;
  ticketLink?: FindingTicketLink;
  dueDate?: string;
  evidenceLink?: string;
  riskAcceptance?: string;
  retestNote?: string;
  retestedAt?: number;
  /** Local auditor-authored remediation transitions used for longitudinal metrics. */
  statusHistory?: FindingStatusTransition[];
  /** Ordered, finding-owned evidence. `captureId` remains as a legacy primary pointer. */
  evidenceCaptureIds?: string[];
  captureId?: string;
  beforeCaptureId?: string;
  afterCaptureId?: string;
  comparisonNote?: string;
  duplicateOf?: string;
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

export interface FindingStatusTransition {
  status: Finding["status"];
  changedAt: number;
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

export const FUNNEL_TELEMETRY_EVENTS = [
  "guide_to_download",
  "download_to_first_plan",
  "first_plan_to_first_deliver",
] as const;

export type FunnelTelemetryEvent = (typeof FUNNEL_TELEMETRY_EVENTS)[number];

export interface AppSettings {
  shortcuts: ShortcutSettings;
  checklistShortcuts: ChecklistShortcutSettings;
  launchAtLogin: boolean;
  appearance: "light";
  reduceMotion: boolean;
  captureHighDpi: boolean;
  shareAnonymousFunnelTelemetry: boolean;
}

export interface Account {
  signedIn: boolean;
  email?: string;
  plan?: "free" | "pro";
  subscription?: {
    status: "none" | "pending" | "active" | "on_hold" | "cancelled" | "failed" | "expired" | "revoked";
    renewsAt?: string;
    endsAt?: string;
    graceEndsAt?: string;
    cancelAtPeriodEnd: boolean;
  };
  features?: {
    managedAi: { enabled: boolean; used: number; limit: number; resetsAt?: string };
    hostedReports: { enabled: boolean; active: number; limit: number };
    whiteLabelReports: boolean;
    reportAnalytics: boolean;
    publishReports: boolean;
    aiFindingDrafts: boolean;
  };
  storage?: { usedBytes: number; quotaBytes: number };
  actions?: { canUpgrade: boolean; canManageBilling: boolean; upgradeUrl: string; billingUrl?: string };
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
  | "lens:changed";

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
  | "lens:state"
  | "lens:frame"
  | "scope:discover"
  | "store:get"
  | "store:set"
  | "store:remove"
  | "store:add-findings"
  | "audit:activate"
  | "workspace:navigate"
  | "settings:get"
  | "settings:save"
  | "settings:reset"
  | "telemetry:emit"
  | "auth:sign-in"
  | "auth:sign-out"
  | "auth:account"
  | "ai:configuration"
  | "ai:save-provider"
  | "ai:test-provider"
  | "ai:remove-provider"
  | "ai:set-active"
  | "ticket:configuration"
  | "ticket:save-connector"
  | "ticket:remove-connector"
  | "ticket:create"
  | "ticket:sync"
  | "report:publish"
  | "dialog:save-image"
  | "dialog:save-pdf"
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
