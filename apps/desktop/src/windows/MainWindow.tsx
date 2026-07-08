import { useEffect, useMemo, useRef, useState } from "react";
import {
  apcaLc,
  apcaRating,
  hexToRgb,
  rgbToHex,
  simulateRgb,
  suggestAccessible,
  wcagVerdict,
  type ColorblindType,
  type Rgb,
} from "@accessibility-build/a11y-core";
import { getVersion } from "@tauri-apps/api/app";
import { displayShortcut, events, ipc, isMac, type Account, type Shortcuts } from "../lib/ipc";
import { CheckIcon, CloseIcon, CopyIcon, FolderIcon, SwapIcon, TimerIcon } from "../lib/icons";

const SITE = "https://thewcag.com";
const HISTORY_KEY = "contrast-history-v1";

type TextMode = "normal" | "large" | "ui";
const TEXT_MODES: { key: TextMode; label: string; target: number; sc: string; aaa: number | null }[] = [
  { key: "normal", label: "Normal text", target: 4.5, sc: "1.4.3", aaa: 7 },
  { key: "large", label: "Large text", target: 3, sc: "1.4.3", aaa: 4.5 },
  { key: "ui", label: "UI / graphics", target: 3, sc: "1.4.11", aaa: null },
];

const CVD: { key: ColorblindType; label: string }[] = [
  { key: "protanopia", label: "Protan" },
  { key: "deuteranopia", label: "Deutan" },
  { key: "tritanopia", label: "Tritan" },
  { key: "achromatopsia", label: "Mono" },
];

interface Pair {
  fg: string;
  bg: string;
}

function loadHistory(): Pair[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const LOG_KEY = "session-log-v1";

interface LogEntry {
  ts: number;
  kind: "pair" | "capture" | "annotate";
  text: string;
}

function loadLog(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function MainWindow() {
  const [permission, setPermission] = useState<boolean | null>(null);
  const [fg, setFg] = useState("#1E293B");
  const [bg, setBg] = useState("#FFFFFF");
  const [worst, setWorst] = useState(false);
  const [history, setHistory] = useState<Pair[]>(loadHistory);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autostart, setAutostartState] = useState(false);
  const [shortcuts, setShortcuts] = useState<Shortcuts | null>(null);
  const [log, setLog] = useState<LogEntry[]>(loadLog);
  const [update, setUpdate] = useState<{ version: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [onboarding, setOnboarding] = useState(() => !localStorage.getItem("onboarded-v1"));
  const [account, setAccount] = useState<Account | null>(null);
  const [version, setVersion] = useState("");

  function appendLog(kind: LogEntry["kind"], text: string) {
    setLog((prev) => {
      const next = [...prev, { ts: Date.now(), kind, text }].slice(-200);
      localStorage.setItem(LOG_KEY, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    void refreshPermission();
    void ipc.autostartEnabled().then(setAutostartState).catch(() => {});
    void ipc.getShortcuts().then(setShortcuts).catch(() => {});
    // silent: dev builds have no manifest yet; failures are expected offline
    void ipc.checkUpdate().then(setUpdate).catch(() => {});
    void ipc.getAccount().then(setAccount).catch(() => {});
    void getVersion().then(setVersion).catch(() => {});
    const unlisteners = [
      events.onPicked((p) => {
        setError(null);
        setWorst(Boolean(p.worst));
        if (p.mode === "pair" && p.colors.length === 2) {
          applyPair(p.colors[0].hex, p.colors[1].hex);
        } else if (p.mode === "fg" && p.colors.length === 1) {
          setFg(p.colors[0].hex);
        } else if (p.mode === "bg" && p.colors.length === 1) {
          setBg(p.colors[0].hex);
        }
      }),
      events.onScreenshotTaken((path) => {
        setScreenshot(path);
        setError(null);
        appendLog("capture", `Full-screen capture saved: ${path.split("/").pop()}`);
      }),
      events.onCaptureError((message) => setError(message)),
      events.onPermissionNeeded(() => void refreshPermission()),
      events.onAnnotateExported((issues) => {
        appendLog(
          "annotate",
          issues.length > 0
            ? `Annotated capture exported with ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${issues.map((i) => `    - ${i}`).join("\n")}`
            : "Annotated capture exported",
        );
      }),
      events.onAccountChanged(() => void ipc.getAccount().then(setAccount).catch(() => {})),
    ];
    const onFocus = () => void refreshPermission();
    window.addEventListener("focus", onFocus);
    return () => {
      unlisteners.forEach((p) => void p.then((un) => un()));
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPair(newFg: string, newBg: string) {
    setFg(newFg);
    setBg(newBg);
    const a = hexToRgb(newFg);
    const b = hexToRgb(newBg);
    if (a && b) {
      const v = wcagVerdict(a, b);
      appendLog(
        "pair",
        `${newFg} on ${newBg} - ${v.ratio.toFixed(2)}:1 - ${v.normalAA ? "passes" : "fails"} WCAG 1.4.3 AA (normal text)`,
      );
    }
    setHistory((prev) => {
      const next = [
        { fg: newFg, bg: newBg },
        ...prev.filter((p) => p.fg !== newFg || p.bg !== newBg),
      ].slice(0, 12);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function refreshPermission() {
    try {
      setPermission(await ipc.screenPermissionStatus());
    } catch {
      setPermission(null);
    }
  }

  async function grantPermission() {
    const granted = await ipc.requestScreenPermission();
    if (!granted) await ipc.openScreenRecordingSettings();
    await refreshPermission();
  }

  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);

  // macOS uses an overlay titlebar (traffic lights sit over the content, so we
  // pad the top); Windows shows a real titlebar. `isMac` comes from ipc.
  return (
    <div className="app-bg flex h-screen flex-col overflow-hidden font-sans text-[13px] text-foreground">
      {/* titlebar overlay: draggable strip under the traffic lights (macOS) */}
      <header
        data-tauri-drag-region
        className={`flex shrink-0 justify-center px-6 pb-4 ${isMac ? "pt-9" : "pt-4"}`}
      >
        <div data-tauri-drag-region className="flex w-full max-w-[1040px] items-center justify-between">
          <button
            onClick={() => void ipc.openSite(SITE)}
            className="flex items-center gap-2.5 text-left"
            title="Open thewcag.com"
          >
            <img src="/logo.png" alt="" className="h-9 w-9 shrink-0" draggable={false} />
            <span>
              <span className="block text-[19px] font-extrabold leading-none tracking-tight">
                The<span className="text-primary">WCAG</span>
              </span>
              <span className="mt-1 block text-[11px] font-medium text-muted-foreground">
                Accessibility, anywhere on screen
              </span>
            </span>
          </button>
        </div>
      </header>

      {/* scroll region: fills the window, scrolls internally (no visible bar).
          Inner wrapper caps the width so a maximized window stays readable. */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1040px] px-6 pb-4 pt-1">
      {error && (
        <div
          role="alert"
          className="rise mb-3 flex items-start justify-between gap-2 rounded-xl border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral"
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="shrink-0 rounded p-0.5 text-coral/70 hover:text-coral"
          >
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      {update && (
        <div className="rise mb-3 flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
          <span className="text-xs">
            Version <strong>{update.version}</strong> is available
          </span>
          <button
            disabled={installing}
            onClick={() => {
              setInstalling(true);
              void ipc.installUpdate().catch((e) => {
                setError(String(e));
                setInstalling(false);
              });
            }}
            className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {installing ? "Installing…" : "Update & restart"}
          </button>
        </div>
      )}

      {screenshot && (
        <section className="rise card mb-3 flex items-center justify-between px-3 py-2">
          <p className="mr-2 truncate text-xs text-muted-foreground" title={screenshot}>
            Saved: {screenshot.split("/").pop()}
          </p>
          <button
            onClick={() => void ipc.revealPath(screenshot)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
          >
            <FolderIcon size={12} />
            Reveal
          </button>
        </section>
      )}

      {permission === false && (
        <PermissionCard
          onGrant={() => void grantPermission()}
          onOpenSettings={() => void ipc.openScreenRecordingSettings()}
        />
      )}

      {/* Primary actions — what you reach for the moment the app opens. */}
      <section aria-label="Capture tools" className="mb-4 grid grid-cols-3 gap-3">
        <ToolCard
          title="Pick pair"
          hotkey={shortcuts ? displayShortcut(shortcuts.pick) : ""}
          hint="Text + background"
          onClick={() => void ipc.beginOverlay("pair")}
          onDelayed={() => void ipc.beginOverlay("pair", 3000)}
        />
        <ToolCard
          title="Capture"
          hotkey={shortcuts ? displayShortcut(shortcuts.shot) : ""}
          hint="Region + annotate"
          onClick={() => void ipc.beginOverlay("shot")}
          onDelayed={() => void ipc.beginOverlay("shot", 3000)}
        />
        <ToolCard
          title="Lens"
          hotkey={shortcuts ? displayShortcut(shortcuts.lens) : ""}
          hint="Colorblind view"
          onClick={() => void ipc.toggleLens()}
        />
      </section>

      {/* Workspace: live contrast + auditor tools on the left, your library on the right. */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(264px,1fr)]">
        <div className="min-w-0">
          {fgRgb && bgRgb && (
            <ContrastPanel
              fg={fg}
              bg={bg}
              fgRgb={fgRgb}
              bgRgb={bgRgb}
              worst={worst}
              onFg={(v) => {
                setFg(v);
                setWorst(false);
              }}
              onBg={(v) => {
                setBg(v);
                setWorst(false);
              }}
              onSwap={() => {
                setFg(bg);
                setBg(fg);
              }}
              onApply={applyPair}
              onError={setError}
            />
          )}

          <section aria-label="Auditor tools" className="mb-3">
            <h2 className="label mb-1.5">Auditor tools</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AuditButton label="Measure" hint="24px targets" onClick={() => void ipc.beginOverlay("measure")} />
              <AuditButton label="Findings" hint="Issue log" onClick={() => void ipc.openToolWindow("findings")} />
              <AuditButton label="Checklist" hint="WCAG 2.2" onClick={() => void ipc.openToolWindow("checklist")} />
              <AuditButton label="Palette" hint="Contrast grid" onClick={() => void ipc.openToolWindow("palette")} />
            </div>
          </section>
        </div>

        <aside className="min-w-0">
          <AccountCard account={account} />

          <CapturesCard />

          {history.length > 0 && (
            <section className="card mb-3 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="label">Recent pairs</h2>
                <button
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem(HISTORY_KEY);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-coral"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((p, i) => (
                  <button
                    key={`${p.fg}${p.bg}${i}`}
                    onClick={() => {
                      setWorst(false);
                      applyPair(p.fg, p.bg);
                    }}
                    className="rounded-md border border-border px-2 py-1 font-mono text-[10px] hover:-translate-y-px hover:shadow-sm"
                    style={{ color: p.fg, backgroundColor: p.bg }}
                    aria-label={`Re-check ${p.fg} on ${p.bg}`}
                    title={`${p.fg} on ${p.bg}`}
                  >
                    Aa
                  </button>
                ))}
              </div>
            </section>
          )}

          {log.length > 0 && (
            <SessionLogCard
              log={log}
              onClear={() => {
                setLog([]);
                localStorage.removeItem(LOG_KEY);
              }}
            />
          )}

          {shortcuts && (
            <ShortcutsCard shortcuts={shortcuts} onChanged={setShortcuts} onError={setError} />
          )}
        </aside>
      </div>

      </div>
      </div>

      <footer className="flex shrink-0 justify-center border-t border-border/70 px-6 pb-4 pt-3">
        <div className="flex w-full max-w-[1040px] items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <button
            role="switch"
            aria-checked={autostart}
            aria-label="Launch at login"
            onClick={() => {
              const next = !autostart;
              setAutostartState(next);
              // Roll back the optimistic toggle if the OS call fails.
              void ipc.setAutostart(next).catch((e) => {
                setAutostartState(!next);
                setError(`Couldn't change launch-at-login: ${e}`);
              });
            }}
            className="switch"
            data-on={autostart}
          />
          Launch at login
        </label>
        <span className="text-[10px] text-muted-foreground">v{version}</span>
        </div>
      </footer>

      {onboarding && (
        <Onboarding
          shortcuts={shortcuts}
          permission={permission}
          onGrant={() => void grantPermission()}
          onDone={() => {
            localStorage.setItem("onboarded-v1", "1");
            setOnboarding(false);
          }}
        />
      )}
    </div>
  );
}

/** A single capture's screenshot thumbnail, loaded from disk over IPC. */
function CaptureThumb({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    ipc
      .captureImage(id)
      .then((buf) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([buf], { type: "image/png" }));
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url ? (
    <img src={url} alt="" className="h-full w-full object-cover" />
  ) : (
    <div className="h-full w-full animate-pulse bg-muted" />
  );
}

function CapturesCard() {
  const [docs, setDocs] = useState<{ id: string; modified_ms: number; issues: number }[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = () => void ipc.listAnnotationDocs().then(setDocs).catch(() => {});
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  if (docs.length === 0) return null;
  return (
    <section className="card mb-3 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="label">Captures</h2>
        <span className="text-[10px] text-muted-foreground">Click to edit &amp; share</span>
      </div>
      <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-0.5">
        {docs.map((d) => (
          <div
            key={d.id}
            className="group relative overflow-hidden rounded-lg border border-border bg-muted/40"
          >
            <button
              onClick={() => void ipc.openAnnotation(d.id)}
              className="block w-full text-left"
              title="Reopen to edit and share this capture"
            >
              <div className="aspect-video overflow-hidden bg-muted">
                <CaptureThumb id={d.id} />
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate text-[10px] text-muted-foreground">
                  {new Date(d.modified_ms).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {d.issues > 0 && (
                  <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-[9px] font-medium text-primary">
                    {d.issues}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => {
                if (confirmId === d.id) {
                  setConfirmId(null);
                  void ipc.deleteAnnotation(d.id).then(refresh).catch(refresh);
                } else {
                  setConfirmId(d.id);
                  // Auto-revert the armed state so a stray first click is harmless.
                  setTimeout(() => setConfirmId((c) => (c === d.id ? null : c)), 2500);
                }
              }}
              aria-label={confirmId === d.id ? "Confirm delete capture" : "Delete capture"}
              title={confirmId === d.id ? "Click again to delete" : "Delete capture"}
              className={`absolute right-1 top-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm transition ${
                confirmId === d.id
                  ? "bg-coral text-white opacity-100"
                  : "bg-black/45 text-white/90 opacity-0 hover:bg-coral focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
              }`}
            >
              {confirmId === d.id ? "Delete?" : "Delete"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AccountCard({ account }: { account: Account | null }) {
  if (account === null) return null; // still loading
  if (!account.signedIn) {
    return (
      <section className="card mb-3 flex items-center justify-between p-3">
        <div>
          <h2 className="text-xs font-semibold">TheWCAG account</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sign in to publish & share reports
          </p>
        </div>
        <button
          onClick={() => void ipc.signIn()}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Sign in
        </button>
      </section>
    );
  }
  return (
    <section className="card mb-3 flex items-center justify-between p-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold" title={account.email}>
          {account.email || "Signed in"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {typeof account.credits === "number"
            ? `${account.credits} credit${account.credits === 1 ? "" : "s"}`
            : "Connected"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => void ipc.openSite("https://app.thewcag.com/screenshots")}
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
        >
          Screenshots
        </button>
        <button
          onClick={() => void ipc.signOut()}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </section>
  );
}

function SessionLogCard(props: { log: LogEntry[]; onClear: () => void }) {
  const [copied, setCopied] = useState(false);

  function toMarkdown(): string {
    const day = new Date().toISOString().slice(0, 10);
    const lines = props.log.map((e) => {
      const time = new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `- **${time}** ${e.text}`;
    });
    return [
      `# Accessibility audit session - ${day}`,
      "",
      ...lines,
      "",
      "Generated with [TheWCAG](https://thewcag.com) desktop.",
    ].join("\n");
  }

  return (
    <section className="card mb-3 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Session log ({props.log.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void ipc.copyText(toMarkdown());
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            {copied ? "Copied" : "Copy Markdown"}
          </button>
          <button
            onClick={() =>
              void ipc.saveText(toMarkdown(), `a11y-session-${new Date().toISOString().slice(0, 10)}.md`)
            }
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Save…
          </button>
          <button onClick={props.onClear} className="text-[10px] text-muted-foreground hover:text-coral">
            Clear
          </button>
        </div>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto">
        {[...props.log].reverse().map((e) => (
          <p key={e.ts + e.text} className="truncate font-mono text-[10px] text-muted-foreground" title={e.text}>
            <span className="text-foreground/70">
              {new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>{" "}
            {e.text.split("\n")[0]}
          </p>
        ))}
      </div>
    </section>
  );
}

function Onboarding(props: {
  shortcuts: Shortcuts | null;
  permission: boolean | null;
  onGrant: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const s = props.shortcuts;
  const steps = [
    {
      title: "Check contrast anywhere",
      body: `Press ${s ? displayShortcut(s.pick) : "the pick shortcut"} - the screen freezes with a magnified loupe. Click the text color, then the background. Drag across gradients to find the worst-case pixel.`,
    },
    {
      title: "Capture and annotate issues",
      body: `Press ${s ? displayShortcut(s.shot) : "the capture shortcut"} and drag a region. Drop numbered issue badges mapped to WCAG criteria, measure target sizes, then copy a GitHub or Jira-ready list.`,
    },
    {
      title: "See through different eyes",
      body: `Press ${s ? displayShortcut(s.lens) : "the lens shortcut"} for a floating lens that simulates color-blindness and low vision over anything on screen. Press D for a before/after split.`,
    },
  ];
  const last = step === steps.length - 1;
  const nextRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog on each step; close on Escape.
  useEffect(() => {
    nextRef.current?.focus();
  }, [step]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Getting started: ${steps[step].title}`}
      className="fade fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm"
    >
      <div className="rise card w-full max-w-sm p-5">
        <div className="mb-3 flex gap-1" aria-hidden="true">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <h2 className="mb-1 text-sm font-bold">{steps[step].title}</h2>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{steps[step].body}</p>
        {props.permission === false && (
          <button
            onClick={props.onGrant}
            className="mb-3 w-full rounded-lg border border-yellow/50 bg-yellow/10 px-3 py-2 text-xs font-medium text-foreground hover:bg-yellow/20"
          >
            Grant Screen Recording first - everything needs it
          </button>
        )}
        <div className="flex items-center justify-between">
          <button onClick={props.onDone} className="text-[11px] text-muted-foreground hover:text-foreground">
            Skip
          </button>
          <button
            ref={nextRef}
            onClick={() => (last ? props.onDone() : setStep(step + 1))}
            className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            {last ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutsCard(props: {
  shortcuts: Shortcuts;
  onChanged: (s: Shortcuts) => void;
  onError: (message: string | null) => void;
}) {
  const [recording, setRecording] = useState<keyof Shortcuts | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(null);
        return;
      }
      if (/^(Control|Alt|Shift|Meta)/.test(e.code)) return;
      const mods = [
        e.ctrlKey && "ctrl",
        e.altKey && "alt",
        e.shiftKey && "shift",
        e.metaKey && "super",
      ].filter(Boolean) as string[];
      if (mods.length === 0) {
        props.onError(
          `Shortcuts need at least one modifier (${isMac ? "⌘, ⌥, ⌃ or ⇧" : "Ctrl, Alt, Shift or Win"})`,
        );
        setRecording(null);
        return;
      }
      const combo = [...mods, e.code].join("+");
      try {
        await ipc.setShortcut(recording, combo);
        props.onChanged({ ...props.shortcuts, [recording]: combo });
        props.onError(null);
      } catch (err) {
        props.onError(String(err));
      }
      setRecording(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // Labels match the tool tiles for one consistent vocabulary.
  const rows: { action: keyof Shortcuts; label: string }[] = [
    { action: "pick", label: "Pick pair" },
    { action: "shot", label: "Capture" },
    { action: "lens", label: "Lens" },
  ];

  return (
    <section className="card mb-3 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="label">Keyboard shortcuts</h2>
        <button
          onClick={() =>
            void ipc.resetShortcuts().then((s) => {
              props.onChanged(s);
              props.onError(null);
            })
          }
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>
      {rows.map(({ action, label }) => (
        <div key={action} className="flex items-center justify-between py-1">
          <span className="text-xs">{label}</span>
          <button
            onClick={() => setRecording(recording === action ? null : action)}
            className={`min-w-20 rounded-md border px-2 py-1 font-mono text-[11px] ${
              recording === action
                ? "animate-pulse border-primary bg-primary/10 text-primary"
                : "border-border bg-card-2/70 hover:border-primary/50"
            }`}
          >
            {recording === action ? "press keys…" : displayShortcut(props.shortcuts[action])}
          </button>
        </div>
      ))}
    </section>
  );
}

function PermissionCard(props: { onGrant: () => void; onOpenSettings: () => void }) {
  return (
    <section className="rise mb-3 rounded-xl border border-yellow/40 bg-yellow/10 p-4">
      <h2 className="text-sm font-semibold">One-time setup: Screen Recording</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The color picker, screenshots and lens read your screen locally.
        Nothing ever leaves your device.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={props.onGrant}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Grant permission
        </button>
        <button
          onClick={props.onOpenSettings}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Open System Settings
        </button>
        <button
          onClick={() => void ipc.restartApp()}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
          title="macOS applies the permission when the app relaunches"
        >
          Already granted? Restart app
        </button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        macOS applies this permission only when the app relaunches - if the
        toggle is already on in System Settings, use Restart. If it still
        asks after restarting, remove the stale entry in System Settings
        with the − button and grant again.
      </p>
    </section>
  );
}

function ContrastPanel(props: {
  fg: string;
  bg: string;
  fgRgb: Rgb;
  bgRgb: Rgb;
  worst: boolean;
  onFg: (hex: string) => void;
  onBg: (hex: string) => void;
  onSwap: () => void;
  onApply: (fg: string, bg: string) => void;
  onError: (message: string | null) => void;
}) {
  const { fgRgb, bgRgb } = props;
  const [mode, setMode] = useState<TextMode>("normal");
  const [copied, setCopied] = useState(false);
  const modeInfo = TEXT_MODES.find((m) => m.key === mode)!;
  const wcag = wcagVerdict(fgRgb, bgRgb);
  const lc = apcaLc(fgRgb, bgRgb);
  const rating = apcaRating(lc);
  const passes = wcag.ratio >= modeInfo.target;
  const passesAAA = modeInfo.aaa !== null && wcag.ratio >= modeInfo.aaa;

  const fgFixes = useMemo(
    () => (passes ? [] : suggestAccessible(fgRgb, bgRgb, modeInfo.target)),
    [props.fg, props.bg, mode], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const bgFixes = useMemo(
    () => (passes ? [] : suggestAccessible(bgRgb, fgRgb, modeInfo.target)),
    [props.fg, props.bg, mode], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const cvdRows = useMemo(
    () =>
      CVD.map(({ key, label }) => {
        const simFg = simulateRgb(fgRgb, key);
        const simBg = simulateRgb(bgRgb, key);
        return { key, label, ratio: wcagVerdict(simFg, simBg).ratio };
      }),
    [props.fg, props.bg], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function copyFinding() {
    const verdict = passes ? "passes" : "fails";
    const text = `${props.fg} on ${props.bg}${props.worst ? " (worst-case pixel of sampled region)" : ""} - ${wcag.ratio.toFixed(2)}:1 - ${verdict} WCAG ${modeInfo.sc} AA (${modeInfo.label.toLowerCase()}); APCA Lc ${lc.toFixed(1)}`;
    await ipc.copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="rise card mb-3 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Swatch label="Text" hex={props.fg} onChange={props.onFg} pickMode="fg" />
        <button
          onClick={props.onSwap}
          aria-label="Swap text and background"
          title="Swap text and background"
          className="mt-4 rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <SwapIcon />
        </button>
        <Swatch label="Background" hex={props.bg} onChange={props.onBg} pickMode="bg" />
      </div>

      <div
        className="mb-3 rounded-lg border border-border px-4 py-3 text-center"
        style={{ backgroundColor: props.bg, color: props.fg }}
      >
        <span className={mode === "large" ? "text-2xl font-semibold" : "text-lg font-semibold"}>
          The quick brown fox
        </span>
        {mode !== "large" && <span className="ml-2 text-xs">jumps over the lazy dog</span>}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="seg" role="radiogroup" aria-label="Text size">
          {TEXT_MODES.map((m) => (
            <button
              key={m.key}
              role="radio"
              aria-checked={mode === m.key}
              data-active={mode === m.key}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {props.worst && (
          <span className="rounded-full bg-yellow/15 px-2 py-0.5 text-[9px] font-semibold text-yellow">
            region worst-case
          </span>
        )}
      </div>

      <div className="mb-2 flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[2.6rem] font-extrabold leading-none tracking-tight tabular-nums">
            {wcag.ratio.toFixed(2)}
          </span>
          <span className="text-sm font-medium text-muted-foreground">: 1</span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
              passes ? "bg-ok/15 text-ok" : "bg-coral/15 text-coral"
            }`}
          >
            {passes ? `AA ✓${passesAAA ? " AAA ✓" : ""}` : `AA ✕ (needs ${modeInfo.target}:1)`}
          </span>
        </div>
        <div className="text-right">
          <span
            className={`font-mono text-sm font-semibold ${
              rating === "fail" ? "text-coral" : "text-foreground"
            }`}
          >
            APCA {lc > 0 ? "+" : ""}
            {lc.toFixed(1)}
          </span>
          <p className="text-[10px] text-muted-foreground">
            {rating === "body-good" && "great for body text"}
            {rating === "body-min" && "ok for body text"}
            {rating === "large-only" && "large text only"}
            {rating === "fail" && "insufficient"}
          </p>
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <div className="flex gap-1.5" title="Ratio as seen with color-vision deficiencies">
          {cvdRows.map((row) => {
            const bad = row.ratio < 3 && wcag.ratio >= modeInfo.target;
            return (
              <span
                key={row.key}
                className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] ${
                  bad ? "bg-coral/15 font-bold text-coral" : "bg-muted/70 text-muted-foreground"
                }`}
                aria-label={`${row.label}: ${row.ratio.toFixed(2)} to 1${bad ? ", passes normally but fails under this color-vision deficiency" : ""}`}
                title={`${row.key}: ${row.ratio.toFixed(2)}:1${bad ? " - passes normally but fails under this CVD" : ""}`}
              >
                {row.label} {row.ratio.toFixed(1)}
                {bad && <span aria-hidden="true"> !</span>}
              </span>
            );
          })}
        </div>
        <button
          onClick={() => void copyFinding()}
          className="btn flex shrink-0 items-center gap-1 px-2 py-1 text-[11px]"
          title={`Copy as audit finding (WCAG ${modeInfo.sc})`}
        >
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
          {copied ? "Copied" : "Copy finding"}
        </button>
      </div>

      {(fgFixes.length > 0 || bgFixes.length > 0) && (
        <div className="mt-3 border-t border-border/70 pt-3">
          <h3 className="label mb-2">Make it pass - nearest {modeInfo.target}:1 fixes</h3>
          <div className="flex flex-wrap gap-2">
            {fgFixes.map((s) => (
              <FixButton
                key={`fg${rgbToHex(s.color)}`}
                hex={rgbToHex(s.color)}
                ratio={s.ratio}
                which="text"
                onApply={(hex) => props.onApply(hex, props.bg)}
              />
            ))}
            {bgFixes.map((s) => (
              <FixButton
                key={`bg${rgbToHex(s.color)}`}
                hex={rgbToHex(s.color)}
                ratio={s.ratio}
                which="bg"
                onApply={(hex) => props.onApply(props.fg, hex)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function FixButton(props: {
  hex: string;
  ratio: number;
  which: "text" | "bg";
  onApply: (hex: string) => void;
}) {
  return (
    <button
      onClick={() => props.onApply(props.hex)}
      className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 hover:bg-muted"
      title={`Apply as ${props.which}`}
    >
      <span className="h-5 w-5 rounded border border-border" style={{ backgroundColor: props.hex }} />
      <span className="text-left">
        <span className="block font-mono text-[11px]">{props.hex}</span>
        <span className="block text-[10px] text-muted-foreground">
          {props.ratio.toFixed(2)}:1, {props.which}
        </span>
      </span>
    </button>
  );
}

function Swatch(props: {
  label: string;
  hex: string;
  onChange: (hex: string) => void;
  pickMode: "fg" | "bg";
}) {
  const [draft, setDraft] = useState(props.hex);
  const [copied, setCopied] = useState(false);
  useEffect(() => setDraft(props.hex), [props.hex]);
  return (
    <div className="min-w-0 flex-1">
      <span className="label">{props.label}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <button
          onClick={() => void ipc.beginOverlay(props.pickMode)}
          aria-label={`Pick ${props.label.toLowerCase()} color from screen`}
          title={`Pick ${props.label.toLowerCase()} from screen`}
          className="h-8 w-8 shrink-0 rounded-lg border border-border shadow-sm hover:scale-105"
          style={{ backgroundColor: props.hex }}
        />
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (hexToRgb(e.target.value)) props.onChange(e.target.value.toUpperCase());
          }}
          spellCheck={false}
          aria-label={`${props.label} hex value`}
          className="w-full min-w-0 rounded-md border border-border bg-card-2/70 px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={() => {
            void ipc.copyText(props.hex);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          aria-label={`Copy ${props.label.toLowerCase()} hex`}
          title="Copy hex"
          className={`shrink-0 rounded-md border border-border p-1.5 hover:bg-muted ${
            copied ? "text-ok" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
        </button>
      </div>
    </div>
  );
}

function AuditButton(props: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className="card tile p-2.5 text-left"
    >
      <span className="block text-xs font-semibold">{props.label}</span>
      <span className="block text-[10px] text-muted-foreground">{props.hint}</span>
    </button>
  );
}

function ToolCard(props: {
  title: string;
  hotkey: string;
  hint: string;
  onClick: () => void;
  onDelayed?: () => void;
}) {
  return (
    <div className="card tile group relative p-3">
      <button onClick={props.onClick} className="w-full text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">{props.title}</span>
          {props.hotkey && (
            <kbd className="rounded border border-border bg-card-2/70 px-1 py-0.5 text-[9px] text-muted-foreground">
              {props.hotkey}
            </kbd>
          )}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground group-hover:text-foreground">
          {props.hint}
        </p>
      </button>
      {props.onDelayed && (
        <button
          onClick={props.onDelayed}
          aria-label={`${props.title} after a 3 second delay`}
          title="Start after a 3s delay - time to open hover states and menus"
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <TimerIcon size={10} />
          3s
        </button>
      )}
    </div>
  );
}
