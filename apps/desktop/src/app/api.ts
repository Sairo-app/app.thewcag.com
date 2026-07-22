import type {
  Account,
  AiConfiguration,
  AiProviderId,
  ApiKeyProviderId,
  AppSettings,
  CaptureEntry,
  DesktopEvent,
  InvokeChannel,
  PlatformInfo,
  UpdateState,
  TicketConnectorConfiguration,
} from "../shared/desktop";
import { DEFAULT_TICKET_FIELD_MAPPINGS } from "../shared/ticket-connectors";

const AI_DEFAULT_MODELS: Record<AiProviderId, string> = {
  thewcag: "Managed automatically",
  openai: "gpt-5.6",
  anthropic: "claude-sonnet-4-6",
  openrouter: "anthropic/claude-sonnet-4.6",
};

interface PreviewAiState {
  activeProvider: AiProviderId;
  providers: Partial<Record<ApiKeyProviderId, { model: string; verifiedAt?: number }>>;
}

interface PreviewCapture extends CaptureEntry {
  rawPngDataUrl: string;
  thumbnailPngDataUrl?: string;
  document?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  shortcuts: {
    inspect: "Alt+CommandOrControl+P",
    capture: "Alt+CommandOrControl+S",
    lens: "Alt+CommandOrControl+L",
  },
  checklistShortcuts: {
    pass: "p",
    fail: "f",
    notApplicable: "n",
    next: "j",
    previous: "k",
    expand: "Enter",
  },
  launchAtLogin: false,
  appearance: "light",
  reduceMotion: false,
  captureHighDpi: true,
  shareAnonymousFunnelTelemetry: false,
};

const listeners = new Map<DesktopEvent, Set<(payload: unknown) => void>>();

function previewPlatform(): PlatformInfo {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return {
    platform: mac ? "macos" : "windows",
    arch: "preview",
    version: "3.0.4-preview",
    windowId: 0,
    view: (new URLSearchParams(location.search).get("view") as PlatformInfo["view"]) || "main",
    reduceMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

function getLocal(key: string): string | null {
  try { return localStorage.getItem(`thewcag:${key}`); } catch { return null; }
}

function setLocal(key: string, json: string): void {
  try { localStorage.setItem(`thewcag:${key}`, json); } catch { /* preview storage is best effort */ }
}

function previewAiState(): PreviewAiState {
  try {
    const saved = JSON.parse(getLocal("ai-provider-settings") ?? "{}") as Partial<PreviewAiState>;
    return {
      activeProvider: ["thewcag", "openai", "anthropic", "openrouter"].includes(saved.activeProvider ?? "")
        ? saved.activeProvider as AiProviderId
        : "thewcag",
      providers: saved.providers ?? {},
    };
  } catch {
    return { activeProvider: "thewcag", providers: {} };
  }
}

function previewAiConfiguration(state = previewAiState()): AiConfiguration {
  return {
    activeProvider: state.activeProvider,
    secureStorageAvailable: true,
    providers: (["thewcag", "openai", "anthropic", "openrouter"] as const).map((id) => {
      const saved = id === "thewcag" ? undefined : state.providers[id];
      return {
        id,
        configured: id === "thewcag" || Boolean(saved),
        active: id === state.activeProvider,
        model: saved?.model ?? AI_DEFAULT_MODELS[id],
        keyHint: saved ? "••••demo" : undefined,
        verifiedAt: saved?.verifiedAt,
      };
    }),
  };
}

function previewCaptures(): PreviewCapture[] {
  try {
    const value = JSON.parse(getLocal("preview-captures") ?? "[]") as unknown;
    return Array.isArray(value) ? value as PreviewCapture[] : [];
  } catch {
    return [];
  }
}

function savePreviewCaptures(captures: PreviewCapture[]): void {
  setLocal("preview-captures", JSON.stringify(captures));
}

function dataUrlPngSize(dataUrl: string): { width: number; height: number } {
  try {
    const bytes = atob(dataUrl.split(",", 2)[1] ?? "");
    const numberAt = (offset: number) =>
      ((bytes.charCodeAt(offset) << 24) >>> 0) +
      (bytes.charCodeAt(offset + 1) << 16) +
      (bytes.charCodeAt(offset + 2) << 8) +
      bytes.charCodeAt(offset + 3);
    return { width: numberAt(16), height: numberAt(20) };
  } catch {
    return { width: 1, height: 1 };
  }
}

async function previewInvoke<T>(channel: InvokeChannel, payload?: unknown): Promise<T> {
  const value = (payload ?? {}) as Record<string, unknown>;
  switch (channel) {
    case "app:platform": return previewPlatform() as T;
    case "settings:get": {
      const saved = JSON.parse(getLocal("settings") ?? "{}") as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...saved.shortcuts },
        checklistShortcuts: {
          ...DEFAULT_SETTINGS.checklistShortcuts,
          ...saved.checklistShortcuts,
        },
      } as T;
    }
    case "settings:save": setLocal("settings", JSON.stringify(payload)); return payload as T;
    case "settings:reset": setLocal("settings", JSON.stringify(DEFAULT_SETTINGS)); return DEFAULT_SETTINGS as T;
    case "telemetry:emit": return { attempted: false, accepted: false, reason: "preview" } as T;
    case "store:get": return getLocal(String(value.key)) as T;
    case "store:set": setLocal(String(value.key), String(value.json)); return undefined as T;
    case "store:remove": try { localStorage.removeItem(`thewcag:${String(value.key)}`); } catch { /* preview storage is best effort */ } return undefined as T;
    case "store:add-findings": {
      const key = typeof value.auditId === "string" ? `findings-${value.auditId}` : "findings";
      const prior = JSON.parse(getLocal(key) ?? "[]") as unknown[];
      const items = Array.isArray(value.items) ? value.items : [];
      setLocal(key, JSON.stringify([...items, ...prior]));
      return undefined as T;
    }
    case "capture:create": {
      const rawPngDataUrl = String(value.pngDataUrl ?? "");
      const size = dataUrlPngSize(rawPngDataUrl);
      const now = Date.now();
      const capture: PreviewCapture = {
        id: `cap-preview-${crypto.randomUUID().slice(0, 8)}`,
        auditId: typeof value.auditId === "string" ? value.auditId : undefined,
        sampleItemId: typeof value.sampleItemId === "string" ? value.sampleItemId : undefined,
        testRunId: typeof value.testRunId === "string" ? value.testRunId : undefined,
        title: String(value.title ?? "Screen capture"),
        createdAt: now,
        modifiedAt: now,
        issues: 0,
        width: size.width,
        height: size.height,
        assetUrl: rawPngDataUrl,
        thumbnailUrl: null,
        rawPngDataUrl,
      };
      savePreviewCaptures([capture, ...previewCaptures()]);
      return capture as T;
    }
    case "capture:list": {
      const auditId = typeof value.auditId === "string" ? value.auditId : undefined;
      return previewCaptures().filter((capture) => !auditId || capture.auditId === auditId) as T;
    }
    case "capture:read-document":
      return (previewCaptures().find((capture) => capture.id === value.id)?.document ?? null) as T;
    case "capture:read-data": {
      const capture = previewCaptures().find((item) => item.id === value.id);
      return (value.kind === "thumbnail"
        ? capture?.thumbnailPngDataUrl ?? null
        : capture?.rawPngDataUrl ?? null) as T;
    }
    case "capture:save-document": {
      savePreviewCaptures(previewCaptures().map((capture) =>
        capture.id === value.id
          ? { ...capture, document: String(value.json ?? ""), issues: (String(value.json ?? "").match(/"kind":"badge"/g) ?? []).length }
          : capture));
      return undefined as T;
    }
    case "capture:save-thumbnail": {
      const thumbnail = String(value.pngDataUrl ?? "");
      savePreviewCaptures(previewCaptures().map((capture) =>
        capture.id === value.id
          ? { ...capture, thumbnailPngDataUrl: thumbnail, thumbnailUrl: thumbnail }
          : capture));
      return undefined as T;
    }
    case "capture:delete":
      savePreviewCaptures(previewCaptures().filter((capture) => capture.id !== value.id));
      return undefined as T;
    case "dialog:open-text": return null as T;
    case "dialog:save-pdf": return null as T;
    case "screen:permission":
    case "screen:request-permission": return "granted" as T;
    case "auth:account": return { signedIn: false } satisfies Account as T;
    case "ai:configuration": return previewAiConfiguration() as T;
    case "ai:save-provider": {
      const provider = String(value.provider) as ApiKeyProviderId;
      if (!["openai", "anthropic", "openrouter"].includes(provider)) throw new Error("Choose a supported AI provider");
      const state = previewAiState();
      if (!String(value.apiKey ?? "").trim() && !state.providers[provider]) throw new Error("Enter an API key before saving");
      const model = String(value.model ?? "").trim();
      if (!model) throw new Error("Enter a model name");
      state.providers[provider] = { model };
      setLocal("ai-provider-settings", JSON.stringify(state));
      return previewAiConfiguration(state) as T;
    }
    case "ai:test-provider": {
      const provider = String(value.provider) as ApiKeyProviderId;
      const state = previewAiState();
      if (!state.providers[provider]) throw new Error("Save this provider before testing it");
      state.providers[provider] = { ...state.providers[provider], verifiedAt: Date.now() };
      setLocal("ai-provider-settings", JSON.stringify(state));
      return previewAiConfiguration(state) as T;
    }
    case "ai:remove-provider": {
      const provider = String(value.provider) as ApiKeyProviderId;
      const state = previewAiState();
      delete state.providers[provider];
      if (state.activeProvider === provider) state.activeProvider = "thewcag";
      setLocal("ai-provider-settings", JSON.stringify(state));
      return previewAiConfiguration(state) as T;
    }
    case "ai:set-active": {
      const provider = String(value.provider) as AiProviderId;
      const state = previewAiState();
      if (provider !== "thewcag" && !state.providers[provider]) throw new Error("Save this provider before using it for authoring");
      state.activeProvider = provider;
      setLocal("ai-provider-settings", JSON.stringify(state));
      return previewAiConfiguration(state) as T;
    }
    case "ticket:configuration": return {
      secureStorageAvailable: false,
      connectors: (["jira", "linear", "github"] as const).map((id) => ({
        id,
        label: id === "jira" ? "Jira" : id === "linear" ? "Linear" : "GitHub Issues",
        configured: false,
        mapping: DEFAULT_TICKET_FIELD_MAPPINGS[id],
      })),
    } satisfies TicketConnectorConfiguration as T;
    case "ticket:save-connector":
    case "ticket:remove-connector":
    case "ticket:create":
    case "ticket:sync":
      throw new Error("Ticket connectors are available in the installed desktop app.");
    case "report:publish": return `https://app.thewcag.com/s/preview-${Date.now().toString(36)}` as T;
    case "update:check": return { status: "current", message: "Preview build" } satisfies UpdateState as T;
    case "clipboard:write-text": await navigator.clipboard?.writeText(String(value.text ?? "")); return undefined as T;
    case "shell:open-external": window.open(String(value.url), "_blank", "noopener"); return undefined as T;
    case "capture:begin":
    case "capture:fullscreen":
    case "capture:open":
    case "lens:toggle":
      throw new Error("This action is available in the installed desktop app.");
    case "lens:state":
      return false as T;
    case "scope:discover":
      throw new Error("Website scope discovery is available in the installed desktop app.");
    case "capture:assign-unscoped":
    case "audit:activate":
    case "workspace:navigate":
      return undefined as T;
    default: return undefined as T;
  }
}

export const desktop = {
  get available(): boolean { return Boolean(window.thewcag); },
  invoke<T = unknown>(channel: InvokeChannel, payload?: unknown): Promise<T> {
    return window.thewcag ? window.thewcag.invoke<T>(channel, payload) : previewInvoke<T>(channel, payload);
  },
  on<T = unknown>(event: DesktopEvent, listener: (payload: T) => void): () => void {
    if (window.thewcag) return window.thewcag.on(event, listener);
    const set = listeners.get(event) ?? new Set();
    set.add(listener as (payload: unknown) => void);
    listeners.set(event, set);
    return () => set.delete(listener as (payload: unknown) => void);
  },
};

export async function getStored<T>(key: string, fallback: T): Promise<T> {
  const raw = await desktop.invoke<string | null>("store:get", { key });
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function setStored<T>(key: string, value: T): Promise<void> {
  return desktop.invoke("store:set", { key, json: JSON.stringify(value) });
}

export async function listCaptures(
  auditId?: string,
  options?: { unscoped?: boolean },
): Promise<CaptureEntry[]> {
  return desktop.invoke("capture:list", {
    ...(auditId ? { auditId } : {}),
    ...(options?.unscoped ? { unscoped: true } : {}),
  });
}
