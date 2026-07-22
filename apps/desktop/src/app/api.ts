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
} from "../shared/desktop";

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
};

const listeners = new Map<DesktopEvent, Set<(payload: unknown) => void>>();

function previewPlatform(): PlatformInfo {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return {
    platform: mac ? "macos" : "windows",
    arch: "preview",
    version: "3.0.3-preview",
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
    case "capture:list": return [] as T;
    case "capture:read-document": return null as T;
    case "capture:read-data": return null as T;
    case "dialog:open-text": return null as T;
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
    case "report:publish": return `https://app.thewcag.com/s/preview-${Date.now().toString(36)}` as T;
    case "update:check": return { status: "current", message: "Preview build" } satisfies UpdateState as T;
    case "clipboard:write-text": await navigator.clipboard?.writeText(String(value.text ?? "")); return undefined as T;
    case "shell:open-external": window.open(String(value.url), "_blank", "noopener"); return undefined as T;
    case "capture:begin":
    case "capture:fullscreen":
    case "capture:open":
    case "lens:toggle":
      throw new Error("This action is available in the installed desktop app.");
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
