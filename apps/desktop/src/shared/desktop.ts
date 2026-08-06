import type {
  AffectedUser,
  DraftConfidence,
  FieldConfidenceV1,
  WcagMappingV1,
} from "@accessibility-build/audit-contracts";

export type AppView = "main" | "overlay" | "annotate" | "lens";
export type WorkspaceStage = "plan" | "inspect" | "evidence" | "review" | "share";
export type WorkspaceUtility = "screenshot" | "program" | "captures" | "vision" | "palette" | "settings";
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
  /** Optional AI-derived instructions for matching an agency's audit template. */
  loggingProfile?: AuditLoggingProfile;
  /** Previous accepted profiles retained so older findings remain traceable. */
  loggingProfileHistory?: AuditLoggingProfile[];
  loggingTemplateAsset?: {
    available: boolean;
    originalFileName: string;
    extension: string;
    savedAt: number;
  };
  /** Bundled training data. Never inferred for a user's real audit. */
  demo?: boolean;
}

export type AuditLoggingSourceField =
  | "title"
  | "description"
  | "actualResult"
  | "expectedResult"
  | "userImpact"
  | "affectedUsers"
  | "wcag"
  | "severity"
  | "severityRationale"
  | "recommendation"
  | "reproductionSteps"
  | "location"
  | "owner"
  | "dueDate"
  | "status"
  | "evidenceLink"
  | "note"
  | "ticket"
  | "riskAcceptance"
  | "retestNote"
  | "comparisonNote"
  | "custom";

export interface AuditLoggingField {
  id: string;
  label: string;
  sourceField: AuditLoggingSourceField;
  kind: "text" | "long-text" | "select" | "date" | "url" | "number";
  required: boolean;
  instructions: string;
  options: string[];
  example?: string;
  /** One-based destination column in the agency worksheet. */
  columnIndex?: number;
  defaultValue?: string;
  valueMappings?: Array<{ agencyValue: string; nativeValue: string }>;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
  requiredWhen?: Array<{
    fieldId: string;
    operator: "equals" | "not-equals" | "empty" | "not-empty";
    value: string;
  }>;
}

export interface AuditLoggingLayout {
  id: string;
  label: string;
  sheetName: string;
  description: string;
  appliesTo: string;
  headerRow: number;
  dataStartRow: number;
  fields: AuditLoggingField[];
}

export interface AuditLoggingProfile {
  version: 1;
  profileId?: string;
  revision?: number;
  templateName: string;
  sheetName?: string;
  summary: string;
  instructions: string[];
  fields: AuditLoggingField[];
  layouts?: AuditLoggingLayout[];
  analyzedAt: number;
  provenance: {
    provider: AiProviderId;
    model: string;
    promptVersion: string;
  };
}

export interface AuditTemplateUpload {
  name: string;
  extension: string;
  size: number;
  sheetNames: string[];
  content: string;
  uploadToken?: string;
  sheets?: Array<{
    name: string;
    rows: Array<{ rowNumber: number; values: string[] }>;
    metadata?: string[];
  }>;
}

export interface AuditTemplatePrefillResult {
  layoutId: string;
  values: Array<{
    fieldId: string;
    value: string;
    confidence: "high" | "medium" | "low";
    reason: string;
  }>;
  provenance: {
    provider: AiProviderId;
    model: string;
    promptVersion: string;
    generatedAt: number;
  };
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
  /** Immutable, globally unique platform identity. Never use the audit reference as identity. */
  id: string;
  key: string;
  reference?: string;
  sampleItemId?: string;
  testRunId?: string;
  title: string;
  wcag: string;
  severity: "blocker" | "major" | "minor";
  status: "open" | "retest" | "fixed" | "accepted";
  /** Extension and automated intakes remain pending until an auditor opens and saves them. */
  reviewState?: "pending" | "reviewed";
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
  /** Values for agency-template columns that do not map to a native finding field. */
  agencyFields?: Record<string, string>;
  agencyLayoutId?: string;
  agencyProfileId?: string;
  agencyProfileRevision?: number;
}

export type CaptureSavedEvent = CaptureEntry & {
  /** Present only when an overlay capture completed a coordinator session. */
  sessionId?: string;
};

export type FindingMutation =
  | {
      type: "put";
      finding: Finding;
    }
  | {
      type: "patch";
      key: string;
      id?: string;
      patch: Partial<Omit<Finding, "id" | "key">>;
      unset?: Array<Exclude<keyof Finding, "id" | "key">>;
    }
  | {
      type: "remove";
      key: string;
      id?: string;
    };

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

export const CRASH_REPORT_ORIGINS = [
  "main-uncaught-exception",
  "main-unhandled-rejection",
  "renderer-process-gone",
  "child-process-gone",
] as const;

export type CrashReportOrigin = (typeof CRASH_REPORT_ORIGINS)[number];

export interface AppSettings {
  shortcuts: ShortcutSettings;
  checklistShortcuts: ChecklistShortcutSettings;
  launchAtLogin: boolean;
  appearance: "light";
  reduceMotion: boolean;
  captureHighDpi: boolean;
  shareAnonymousFunnelTelemetry: boolean;
  shareCrashReports: boolean;
}

export interface Account {
  signedIn: boolean;
  /** Entitlements are fresh from the server or retained from the last successful refresh. */
  featuresState?: "loaded" | "unavailable";
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
  | "annotate:flush"
  | "overlay:init"
  | "overlay:progress"
  | "capture:result"
  | "capture:saved"
  | "capture:cancelled"
  | "account:changed"
  | "update:state"
  | "shortcut:failed"
  | "notification"
  | "navigation:tool"
  | "screenshot:share"
  | "findings:changed"
  | "lens:changed";

export type InvokeChannel =
  | "app:platform"
  | "annotate:flush-complete"
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
  | "store:mutate-findings"
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
  | "ai:analyze-audit-template"
  | "ai:prefill-audit-template"
  | "audit-template:attach"
  | "audit-template:remove"
  | "audit-template:export"
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
  | "dialog:open-audit-template"
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
