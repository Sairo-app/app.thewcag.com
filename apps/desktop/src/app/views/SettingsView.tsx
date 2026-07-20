import { useEffect, useState } from "react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  CloudArrowUp,
  DownloadSimple,
  Fingerprint,
  Key,
  LockKey,
  SignIn,
  SignOut,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  Account,
  AppSettings,
  AuditProject,
  PlatformInfo,
  UpdateState,
} from "../../shared/desktop";
import { desktop } from "../api";
import { Button, Field, StatusBadge, Toast } from "../components";
import { useTransientMessage } from "../hooks";

const DEFAULTS: AppSettings = {
  shortcuts: {
    inspect: "Alt+CommandOrControl+P",
    capture: "Alt+CommandOrControl+S",
    lens: "Alt+CommandOrControl+L",
  },
  launchAtLogin: false,
  appearance: "light",
  reduceMotion: false,
  captureHighDpi: true,
};

export function SettingsView({
  platform,
  audit,
  onAuditChange,
}: {
  platform: PlatformInfo;
  audit: AuditProject;
  onAuditChange: (patch: Partial<AuditProject>) => void;
}) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [permission, setPermission] = useState<string>("unknown");
  const [account, setAccount] = useState<Account>({ signedIn: false });
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });
  const [message, show] = useTransientMessage();
  useEffect(() => {
    void Promise.all([
      desktop.invoke<AppSettings>("settings:get").then(setSettings),
      desktop.invoke<string>("screen:permission").then(setPermission),
      desktop.invoke<Account>("auth:account").then(setAccount),
    ]).catch((error) => show(String(error), true));
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
      show(String(error), true);
    }
  }
  function patchAudit(patch: Partial<AuditProject>) {
    onAuditChange(patch);
  }
  async function requestPermission() {
    try {
      const result = await desktop.invoke<string>("screen:request-permission");
      setPermission(result);
      if (result !== "granted") await desktop.invoke("screen:open-settings");
    } catch (error) {
      show(String(error), true);
    }
  }
  async function signIn() {
    try {
      await desktop.invoke("auth:sign-in");
      show("Complete sign in in your browser");
    } catch (error) {
      show(String(error), true);
    }
  }
  async function checkUpdate() {
    try {
      setUpdate(await desktop.invoke("update:check"));
    } catch (error) {
      show(String(error), true);
    }
  }

  return (
    <div className="settings-view">
      <Toast message={message} />
      <section className="settings-section">
        <div className="settings-intro">
          <h2>Audit context</h2>
          <p>This information travels with checklist and findings exports.</p>
        </div>
        <div className="settings-form grid-two">
          <Field label="Project name">
            <input
              value={audit.project}
              onChange={(event) => patchAudit({ project: event.target.value })}
            />
          </Field>
          <Field label="Target URL or application">
            <input
              value={audit.target}
              onChange={(event) => patchAudit({ target: event.target.value })}
              placeholder="https://example.com or Product app"
            />
          </Field>
          <Field label="Scope">
            <textarea
              value={audit.scope}
              onChange={(event) => patchAudit({ scope: event.target.value })}
              placeholder="Pages, flows, components, or release being audited"
            />
          </Field>
          <div className="field-stack">
            <Field label="Conformance target">
              <select
                value={audit.standard}
                onChange={(event) =>
                  patchAudit({
                    standard: event.target.value as AuditProject["standard"],
                  })
                }
              >
                <option>WCAG 2.2 A</option>
                <option>WCAG 2.2 AA</option>
              </select>
            </Field>
            <Field label="Auditor">
              <input
                value={audit.auditor}
                onChange={(event) =>
                  patchAudit({ auditor: event.target.value })
                }
                placeholder="Name or team"
              />
            </Field>
          </div>
        </div>
      </section>

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
                    ? "Capture region"
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
            {permission}
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
                {account.signedIn ? account.email : "Not signed in"}
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
            Captures, annotations, checklists, and tokens are stored in the
            operating system application-data directory. Authentication tokens
            are encrypted with the OS secure-storage service.
          </p>
        </div>
      </section>
    </div>
  );
}
