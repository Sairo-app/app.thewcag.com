import { useEffect, useState } from "react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  CloudCheck,
  CloudArrowUp,
  DownloadSimple,
  Eye,
  EyeSlash,
  Fingerprint,
  FloppyDisk,
  Key,
  LockKey,
  Network,
  OpenAiLogo,
  Plug,
  ShieldCheck,
  SignIn,
  SignOut,
  Sparkle,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  Account,
  AiConfiguration,
  AiProviderId,
  ApiKeyProviderId,
  AppSettings,
  PlatformInfo,
  UpdateState,
} from "../../shared/desktop";
import { desktop } from "../api";
import { Button, ConfirmDialog, Field, StatusBadge, Toast } from "../components";
import { messageFromError, useTransientMessage } from "../hooks";

const DEFAULTS: AppSettings = {
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

const PROVIDER_MODELS: Record<AiProviderId, string> = {
  thewcag: "Managed automatically",
  openai: "gpt-5.6",
  anthropic: "claude-sonnet-4-6",
  openrouter: "anthropic/claude-sonnet-4.6",
};

const EMPTY_AI_CONFIGURATION: AiConfiguration = {
  activeProvider: "thewcag",
  secureStorageAvailable: true,
  providers: (["thewcag", "openai", "anthropic", "openrouter"] as const).map((id) => ({
    id,
    active: id === "thewcag",
    configured: id === "thewcag",
    model: PROVIDER_MODELS[id],
  })),
};

const PROVIDERS = [
  {
    id: "thewcag",
    name: "TheWCAG",
    eyebrow: "Managed",
    description: "Use the signed-in service with no provider key to maintain.",
    keyUrl: "",
  },
  {
    id: "openai",
    name: "OpenAI",
    eyebrow: "Direct API",
    description: "Send approved evidence directly to the OpenAI Responses API.",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Claude",
    eyebrow: "Direct API",
    description: "Use your Anthropic key with Claude structured outputs.",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    eyebrow: "Multi-model",
    description: "Use one key and choose any compatible structured-output model.",
    keyUrl: "https://openrouter.ai/settings/keys",
  },
] as const;

function ProviderIcon({ id, size = 20 }: { id: AiProviderId; size?: number }) {
  if (id === "thewcag") return <CloudCheck size={size} weight="duotone" />;
  if (id === "openai") return <OpenAiLogo size={size} weight="duotone" />;
  if (id === "anthropic") return <Sparkle size={size} weight="duotone" />;
  return <Network size={size} weight="duotone" />;
}

export function SettingsView({
  platform,
}: {
  platform: PlatformInfo;
}) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [permission, setPermission] = useState<string>("unknown");
  const [account, setAccount] = useState<Account>({ signedIn: false });
  const [aiConfiguration, setAiConfiguration] = useState<AiConfiguration>(EMPTY_AI_CONFIGURATION);
  const [editingProvider, setEditingProvider] = useState<AiProviderId>("thewcag");
  const [apiKeys, setApiKeys] = useState<Partial<Record<ApiKeyProviderId, string>>>({});
  const [models, setModels] = useState<Record<AiProviderId, string>>(PROVIDER_MODELS);
  const [visibleKey, setVisibleKey] = useState<ApiKeyProviderId | null>(null);
  const [busyProvider, setBusyProvider] = useState<AiProviderId | null>(null);
  const [removeProvider, setRemoveProvider] = useState<ApiKeyProviderId | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });
  const [message, show] = useTransientMessage();
  useEffect(() => {
    void Promise.all([
      desktop.invoke<AppSettings>("settings:get").then(setSettings),
      desktop.invoke<string>("screen:permission").then(setPermission),
      desktop.invoke<Account>("auth:account").then(setAccount),
      desktop.invoke<AiConfiguration>("ai:configuration").then((configuration) => {
        setAiConfiguration(configuration);
        setEditingProvider(configuration.activeProvider);
        setModels((current) => Object.fromEntries(
          configuration.providers.map((provider) => [provider.id, provider.model || current[provider.id]]),
        ) as Record<AiProviderId, string>);
      }),
    ]).catch((error) => show(messageFromError(error), true));
    const stopUpdate = desktop.on<UpdateState>("update:state", setUpdate);
    const stopAccount = desktop.on(
      "account:changed",
      () => void desktop.invoke<Account>("auth:account").then(setAccount),
    );
    return () => {
      stopUpdate();
      stopAccount();
    };
  }, []);

  async function saveSettings(next: AppSettings) {
    try {
      const saved = await desktop.invoke<AppSettings>("settings:save", next);
      setSettings(saved);
      document.documentElement.dataset.motion = saved.reduceMotion
        ? "reduced"
        : "full";
      show("Settings saved");
    } catch (error) {
      const persisted = await desktop
        .invoke<AppSettings>("settings:get")
        .catch(() => null);
      if (persisted) setSettings(persisted);
      show(messageFromError(error), true);
    }
  }
  async function requestPermission() {
    try {
      const result = await desktop.invoke<string>("screen:request-permission");
      setPermission(result);
      if (result !== "granted") await desktop.invoke("screen:open-settings");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }
  async function signIn() {
    try {
      await desktop.invoke("auth:sign-in");
      show("Complete sign in in your browser");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }
  async function checkUpdate() {
    try {
      setUpdate(await desktop.invoke("update:check"));
    } catch (error) {
      show(messageFromError(error), true);
    }
  }
  function acceptAiConfiguration(configuration: AiConfiguration) {
    setAiConfiguration(configuration);
    setModels((current) => Object.fromEntries(
      configuration.providers.map((provider) => [provider.id, provider.model || current[provider.id]]),
    ) as Record<AiProviderId, string>);
  }
  async function saveAndVerifyProvider(provider: ApiKeyProviderId) {
    setBusyProvider(provider);
    try {
      const saved = await desktop.invoke<AiConfiguration>("ai:save-provider", {
        provider,
        apiKey: apiKeys[provider] || "",
        model: models[provider],
      });
      acceptAiConfiguration(saved);
      setApiKeys((current) => ({ ...current, [provider]: "" }));
      try {
        const verified = await desktop.invoke<AiConfiguration>("ai:test-provider", { provider });
        acceptAiConfiguration(verified);
        show(`${PROVIDERS.find((item) => item.id === provider)?.name} is saved and verified`);
      } catch (error) {
        show(`Key saved. ${messageFromError(error)}`, true);
      }
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setBusyProvider(null);
    }
  }
  async function useAiProvider(provider: AiProviderId) {
    setBusyProvider(provider);
    try {
      const configuration = await desktop.invoke<AiConfiguration>("ai:set-active", { provider });
      acceptAiConfiguration(configuration);
      show(`${PROVIDERS.find((item) => item.id === provider)?.name} will author new findings`);
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setBusyProvider(null);
    }
  }
  async function confirmRemoveProvider() {
    if (!removeProvider) return;
    const provider = removeProvider;
    setBusyProvider(provider);
    try {
      const configuration = await desktop.invoke<AiConfiguration>("ai:remove-provider", { provider });
      acceptAiConfiguration(configuration);
      setApiKeys((current) => ({ ...current, [provider]: "" }));
      setModels((current) => ({ ...current, [provider]: PROVIDER_MODELS[provider] }));
      setRemoveProvider(null);
      show(`${PROVIDERS.find((item) => item.id === provider)?.name} key removed`);
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setBusyProvider(null);
    }
  }
  const permissionLabel =
    permission === "granted"
      ? "Allowed"
      : permission === "denied"
        ? "Not allowed"
        : "Not checked";
  const secureStorageName =
    platform.platform === "macos"
      ? "macOS Keychain"
      : "Windows credential protection";
  const selectedProvider = PROVIDERS.find((provider) => provider.id === editingProvider) ?? PROVIDERS[0];
  const selectedStatus = aiConfiguration.providers.find((provider) => provider.id === editingProvider)
    ?? EMPTY_AI_CONFIGURATION.providers[0];
  const selectedKeyProvider = editingProvider === "thewcag" ? null : editingProvider;
  const configuredKeyCount = aiConfiguration.providers.filter((provider) => provider.id !== "thewcag" && provider.configured).length;
  const verifiedLabel = selectedStatus.verifiedAt
    ? `Verified ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(selectedStatus.verifiedAt)}`
    : selectedStatus.configured
      ? "Saved"
      : "Not configured";
  return (
    <div className="settings-view">
      <Toast message={message} />
      <section className="settings-section">
        <div className="settings-intro">
          <h2>Capture and startup</h2>
          <p>Native options that apply to this computer.</p>
        </div>
        <div className="setting-rows">
          <label className="toggle-row">
            <span>
              <strong>High-DPI capture</strong>
              <small>
                Preserve native display resolution for sharper evidence.
              </small>
            </span>
            <input
              type="checkbox"
              checked={settings.captureHighDpi}
              onChange={(event) =>
                void saveSettings({
                  ...settings,
                  captureHighDpi: event.target.checked,
                })
              }
            />
          </label>
          <label className="toggle-row">
            <span>
              <strong>Launch at login</strong>
              <small>Open TheWCAG when you sign in to this computer.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.launchAtLogin}
              onChange={(event) =>
                void saveSettings({
                  ...settings,
                  launchAtLogin: event.target.checked,
                })
              }
            />
          </label>
          <label className="toggle-row">
            <span>
              <strong>Reduce interface motion</strong>
              <small>
                Minimize view transitions and nonessential movement.
              </small>
            </span>
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(event) =>
                void saveSettings({
                  ...settings,
                  reduceMotion: event.target.checked,
                })
              }
            />
          </label>
        </div>
      </section>

      <section className="settings-section ai-settings-section">
        <div className="settings-intro">
          <h2>AI authoring</h2>
          <p>Choose who processes evidence when the extension drafts a finding.</p>
        </div>
        <div className="ai-settings">
          <div className="ai-provider-picker" aria-label="AI providers">
            {PROVIDERS.map((provider) => {
              const status = aiConfiguration.providers.find((item) => item.id === provider.id);
              return (
                <button
                  key={provider.id}
                  type="button"
                  className="ai-provider-choice"
                  aria-pressed={editingProvider === provider.id}
                  onClick={() => setEditingProvider(provider.id)}
                >
                  <span className="ai-provider-symbol"><ProviderIcon id={provider.id} /></span>
                  <span className="ai-provider-choice-copy">
                    <strong>{provider.name}</strong>
                    <small>{provider.eyebrow}</small>
                  </span>
                  {status?.active ? (
                    <span className="ai-provider-state" aria-label="Active" title="Active provider">
                      <CheckCircle size={15} weight="fill" />
                    </span>
                  ) : status?.configured && provider.id !== "thewcag" ? (
                    <span className="ai-provider-state" aria-label="Saved" title="Key saved">
                      <LockKey size={15} weight="duotone" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="ai-provider-detail">
            <div className="ai-provider-detail-heading">
              <span className="ai-provider-detail-icon"><ProviderIcon id={editingProvider} size={23} /></span>
              <div>
                <div className="ai-provider-title-line">
                  <h3>{selectedProvider.name}</h3>
                  <StatusBadge tone={
                    selectedStatus.active
                      ? "success"
                      : selectedStatus.configured
                        ? "neutral"
                        : "warning"
                  }>
                    {selectedStatus.active ? "Active" : verifiedLabel}
                  </StatusBadge>
                </div>
                <p>{selectedProvider.description}</p>
              </div>
            </div>

            {selectedKeyProvider ? (
              <div className="ai-provider-form">
                {!aiConfiguration.secureStorageAvailable ? (
                  <div className="ai-storage-warning" role="alert">
                    <WarningCircle size={18} weight="fill" />
                    Secure credential storage is unavailable. API keys cannot be saved on this computer.
                  </div>
                ) : null}
                <div className="ai-provider-fields">
                  <Field
                    label={`${selectedProvider.name} API key`}
                    hint={selectedStatus.configured
                      ? `A key ending in ${selectedStatus.keyHint?.replace("••••", "") || "••••"} is saved. Leave blank to keep it.`
                      : "The full key is never shown again after saving."}
                  >
                    <div className="secure-key-input">
                      <input
                        type={visibleKey === selectedKeyProvider ? "text" : "password"}
                        value={apiKeys[selectedKeyProvider] ?? ""}
                        placeholder={selectedStatus.configured ? "Enter a replacement key" : "Paste API key"}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        onChange={(event) => setApiKeys((current) => ({
                          ...current,
                          [selectedKeyProvider]: event.target.value,
                        }))}
                      />
                      <button
                        type="button"
                        aria-label={visibleKey === selectedKeyProvider ? "Hide API key" : "Show API key"}
                        title={visibleKey === selectedKeyProvider ? "Hide API key" : "Show API key"}
                        onClick={() => setVisibleKey(visibleKey === selectedKeyProvider ? null : selectedKeyProvider)}
                      >
                        {visibleKey === selectedKeyProvider ? <EyeSlash size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </Field>
                  <Field
                    label="Model"
                    hint={selectedKeyProvider === "openrouter"
                      ? "Use the provider/model ID shown by OpenRouter."
                      : "Use a model available to this API key."}
                  >
                    <input
                      value={models[selectedKeyProvider]}
                      list={`${selectedKeyProvider}-models`}
                      autoCapitalize="none"
                      spellCheck={false}
                      onChange={(event) => setModels((current) => ({
                        ...current,
                        [selectedKeyProvider]: event.target.value,
                      }))}
                    />
                    <datalist id={`${selectedKeyProvider}-models`}>
                      {selectedKeyProvider === "openai" ? <option value="gpt-5.6" /> : null}
                      {selectedKeyProvider === "anthropic" ? <option value="claude-sonnet-4-6" /> : null}
                      {selectedKeyProvider === "openrouter" ? (
                        <>
                          <option value="anthropic/claude-sonnet-4.6" />
                          <option value="openai/gpt-5.6" />
                        </>
                      ) : null}
                    </datalist>
                  </Field>
                </div>
                <div className="ai-provider-actions">
                  <Button
                    variant="primary"
                    icon={FloppyDisk}
                    disabled={busyProvider !== null || !aiConfiguration.secureStorageAvailable || (!selectedStatus.configured && !apiKeys[selectedKeyProvider]?.trim())}
                    onClick={() => void saveAndVerifyProvider(selectedKeyProvider)}
                  >
                    {busyProvider === selectedKeyProvider ? "Checking" : "Save and verify"}
                  </Button>
                  <Button
                    icon={Plug}
                    disabled={busyProvider !== null || !selectedStatus.configured || selectedStatus.active}
                    onClick={() => void useAiProvider(selectedKeyProvider)}
                  >
                    {selectedStatus.active ? "In use" : "Use for authoring"}
                  </Button>
                  <Button
                    variant="quiet"
                    icon={ArrowSquareOut}
                    onClick={() => void desktop.invoke("shell:open-external", { url: selectedProvider.keyUrl })}
                  >
                    Get API key
                  </Button>
                  {selectedStatus.configured ? (
                    <Button
                      variant="quiet"
                      icon={Trash}
                      disabled={busyProvider !== null}
                      onClick={() => setRemoveProvider(selectedKeyProvider)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="ai-data-note">
                  <ShieldCheck size={18} weight="duotone" />
                  <p>
                    Encrypted with {secureStorageName}. Approved evidence goes directly from this computer to {selectedProvider.name}; your key never passes through TheWCAG servers.
                  </p>
                </div>
              </div>
            ) : (
              <div className="ai-cloud-panel">
                <div>
                  <strong>{account.signedIn ? "Ready with your account" : "Sign in required"}</strong>
                  <p>
                    The managed service keeps provider setup out of the app. Evidence is sent only after the auditor reviews and approves it.
                  </p>
                </div>
                <div className="ai-provider-actions">
                  {!account.signedIn ? (
                    <Button variant="primary" icon={SignIn} onClick={() => void signIn()}>
                      Sign in
                    </Button>
                  ) : null}
                  <Button
                    icon={CloudCheck}
                    disabled={busyProvider !== null || selectedStatus.active}
                    onClick={() => void useAiProvider("thewcag")}
                  >
                    {selectedStatus.active ? "In use" : "Use for authoring"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-intro">
          <h2>Checklist keyboard</h2>
          <p>
            Decide and move through criteria without leaving the keyboard.
            Shortcuts work only while a criterion row has focus.
          </p>
        </div>
        <div className="shortcut-list checklist-shortcut-list">
          {([
            ["pass", "Mark pass"],
            ["fail", "Mark fail"],
            ["notApplicable", "Mark not applicable"],
            ["next", "Next criterion"],
            ["previous", "Previous criterion"],
            ["expand", "Open audit record"],
          ] as const).map(([key, label]) => (
            <Field key={key} label={label}>
              <div className="shortcut-input">
                <Key size={15} />
                <input
                  maxLength={12}
                  value={settings.checklistShortcuts[key]}
                  aria-label={`${label} shortcut`}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      checklistShortcuts: {
                        ...settings.checklistShortcuts,
                        [key]: event.target.value,
                      },
                    })
                  }
                  onBlur={() => void saveSettings(settings)}
                />
              </div>
            </Field>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-intro">
          <h2>Global shortcuts</h2>
          <p>Start a task while working in another application.</p>
        </div>
        <div className="shortcut-list">
          {(["inspect", "capture", "lens"] as const).map((key) => (
            <Field
              key={key}
              label={
                key === "inspect"
                  ? "Inspect contrast"
                  : key === "capture"
                    ? "Standalone screenshot"
                    : "Toggle vision lens"
              }
            >
              <div className="shortcut-input">
                <Key size={15} />
                <input
                  value={settings.shortcuts[key]}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      shortcuts: {
                        ...settings.shortcuts,
                        [key]: event.target.value,
                      },
                    })
                  }
                  onBlur={() => void saveSettings(settings)}
                />
              </div>
            </Field>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-intro">
          <h2>Permissions</h2>
          <p>The app only requests access required for on-screen inspection.</p>
        </div>
        <div className="permission-row">
          <div
            className={
              permission === "granted"
                ? "permission-icon granted"
                : "permission-icon"
            }
          >
            {permission === "granted" ? (
              <CheckCircle size={21} weight="fill" />
            ) : (
              <WarningCircle size={21} weight="fill" />
            )}
          </div>
          <div>
            <strong>Screen recording</strong>
            <p>
              {permission === "granted"
                ? "Allowed. Screen inspection and high-DPI capture are ready."
                : "Required to sample colors and capture evidence outside this app."}
            </p>
          </div>
          <StatusBadge tone={permission === "granted" ? "success" : "warning"}>
            {permissionLabel}
          </StatusBadge>
          {permission !== "granted" ? (
            <Button
              icon={ArrowSquareOut}
              onClick={() => void requestPermission()}
            >
              Open settings
            </Button>
          ) : null}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-intro">
          <h2>Account and updates</h2>
          <p>Publishing is optional. Local audits work without an account.</p>
        </div>
        <div className="account-grid">
          <article>
            <div className="settings-card-icon">
              <Fingerprint size={21} weight="duotone" />
            </div>
            <div>
              <strong>
                {account.signedIn
                  ? account.email || "Connected account"
                  : "Not signed in"}
              </strong>
              <p>
                {account.signedIn
                  ? `${account.plan || "Account"} · ${account.credits ?? 0} publish credits`
                  : "Sign in only when you are ready to publish a shareable report."}
              </p>
            </div>
            {account.signedIn ? (
              <Button
                icon={SignOut}
                onClick={() =>
                  void desktop
                    .invoke("auth:sign-out")
                    .then(() => setAccount({ signedIn: false }))
                }
              >
                Sign out
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={SignIn}
                onClick={() => void signIn()}
              >
                Sign in
              </Button>
            )}
          </article>
          <article>
            <div className="settings-card-icon">
              <CloudArrowUp size={21} weight="duotone" />
            </div>
            <div>
              <strong>TheWCAG {platform.version}</strong>
              <p>
                {update.status === "ready"
                  ? `Version ${update.version} is ready to install.`
                  : update.status === "current"
                    ? "You are running the latest available version."
                    : update.message ||
                      "Signed automatic updates keep the app current."}
              </p>
            </div>
            {update.status === "ready" ? (
              <Button
                variant="primary"
                icon={DownloadSimple}
                onClick={() => void desktop.invoke("update:install")}
              >
                Restart and update
              </Button>
            ) : (
              <Button
                icon={ArrowClockwise}
                disabled={update.status === "checking"}
                onClick={() => void checkUpdate()}
              >
                {update.status === "checking" ? "Checking" : "Check updates"}
              </Button>
            )}
          </article>
        </div>
      </section>

      <section className="privacy-strip">
        <LockKey size={20} weight="duotone" />
        <div>
          <strong>Private by default</strong>
          <p>
            Captures, annotations, and checklists stay in the app data folder.
            Connection tokens{configuredKeyCount ? ` and ${configuredKeyCount} saved AI ${configuredKeyCount === 1 ? "key" : "keys"}` : ""} are encrypted with {secureStorageName}.
          </p>
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(removeProvider)}
        title={`Remove ${PROVIDERS.find((provider) => provider.id === removeProvider)?.name ?? "provider"} key?`}
        description="The saved API key will be deleted from this computer. If it is active, authoring will return to TheWCAG managed service."
        confirmLabel="Remove key"
        busy={busyProvider !== null}
        onConfirm={() => void confirmRemoveProvider()}
        onCancel={() => setRemoveProvider(null)}
      />
    </div>
  );
}
