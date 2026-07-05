import { useEffect, useMemo, useState } from "react";
import {
  apcaLc,
  apcaRating,
  hexToRgb,
  rgbToHex,
  suggestAccessible,
  wcagVerdict,
  type Rgb,
} from "@accessibility-build/a11y-core";
import { events, ipc } from "../lib/ipc";

const SITE = "https://accessibility.build";
const HISTORY_KEY = "contrast-history-v1";

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

export default function MainWindow() {
  const [permission, setPermission] = useState<boolean | null>(null);
  const [fg, setFg] = useState("#1E293B");
  const [bg, setBg] = useState("#FFFFFF");
  const [history, setHistory] = useState<Pair[]>(loadHistory);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autostart, setAutostartState] = useState(false);

  useEffect(() => {
    void refreshPermission();
    void ipc.autostartEnabled().then(setAutostartState).catch(() => {});
    const unlisteners = [
      events.onPicked((p) => {
        setError(null);
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
      }),
      events.onCaptureError((message) => setError(message)),
      events.onPermissionNeeded(() => void refreshPermission()),
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

  return (
    <div className="app-bg min-h-screen px-5 pb-5 pt-6 font-sans text-foreground">
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => void ipc.openSite(SITE)}
          className="text-left"
          title="Open accessibility.build"
        >
          <h1 className="text-lg font-bold tracking-tight">
            Accessibility<span className="text-primary">.build</span>
          </h1>
          <p className="text-xs text-muted-foreground">Instant checks, anywhere on screen</p>
        </button>
        <PermissionDot granted={permission} />
      </header>

      {error && (
        <div className="rise mb-3 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">
          {error}
        </div>
      )}

      {permission === false && (
        <PermissionCard
          onGrant={() => void grantPermission()}
          onOpenSettings={() => void ipc.openScreenRecordingSettings()}
        />
      )}

      {fgRgb && bgRgb && (
        <ContrastPanel
          fg={fg}
          bg={bg}
          fgRgb={fgRgb}
          bgRgb={bgRgb}
          onFg={setFg}
          onBg={setBg}
          onSwap={() => {
            setFg(bg);
            setBg(fg);
          }}
          onApply={applyPair}
        />
      )}

      <section className="mb-3 grid grid-cols-3 gap-2">
        <ToolCard
          title="Pick pair"
          hotkey="⌥⌘P"
          hint="fg + bg from screen"
          onClick={() => void ipc.beginOverlay("pair")}
        />
        <ToolCard
          title="Capture"
          hotkey="⌥⌘S"
          hint="region + annotate"
          onClick={() => void ipc.beginOverlay("shot")}
        />
        <ToolCard
          title="Lens"
          hotkey="⌥⌘L"
          hint="colorblind view"
          onClick={() => void ipc.toggleLens()}
        />
      </section>

      {history.length > 0 && (
        <section className="mb-3 rounded-xl border border-border bg-card p-3">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent pairs
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {history.map((p, i) => (
              <button
                key={`${p.fg}${p.bg}${i}`}
                onClick={() => {
                  setFg(p.fg);
                  setBg(p.bg);
                }}
                className="rounded-md border border-border px-2 py-1 font-mono text-[10px] transition-transform hover:scale-105"
                style={{ color: p.fg, backgroundColor: p.bg }}
                title={`${p.fg} on ${p.bg}`}
              >
                Aa
              </button>
            ))}
          </div>
        </section>
      )}

      {screenshot && (
        <section className="rise mb-3 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
          <p className="mr-2 truncate text-xs text-muted-foreground" title={screenshot}>
            Saved: {screenshot.split("/").pop()}
          </p>
          <button
            onClick={() => void ipc.revealPath(screenshot)}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
          >
            Reveal
          </button>
        </section>
      )}

      <footer className="flex items-center justify-between border-t border-border pt-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={autostart}
            onChange={(e) => {
              setAutostartState(e.target.checked);
              void ipc.setAutostart(e.target.checked).catch(() => {});
            }}
            className="accent-[hsl(var(--primary))]"
          />
          Launch at login
        </label>
        <span className="text-[10px] text-muted-foreground">v1.0.0</span>
      </footer>
    </div>
  );
}

function PermissionDot({ granted }: { granted: boolean | null }) {
  return (
    <span
      title={granted ? "Screen Recording granted" : "Screen Recording needed"}
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        granted === null ? "bg-muted" : granted ? "bg-ok" : "bg-yellow"
      }`}
    />
  );
}

function PermissionCard(props: { onGrant: () => void; onOpenSettings: () => void }) {
  return (
    <section className="rise mb-3 rounded-xl border border-yellow/40 bg-yellow/10 p-4">
      <h2 className="text-sm font-semibold">One-time setup: Screen Recording</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The color picker, screenshots and lens read your screen locally.
        Nothing ever leaves your Mac.
      </p>
      <div className="mt-3 flex gap-2">
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
      </div>
    </section>
  );
}

function ContrastPanel(props: {
  fg: string;
  bg: string;
  fgRgb: Rgb;
  bgRgb: Rgb;
  onFg: (hex: string) => void;
  onBg: (hex: string) => void;
  onSwap: () => void;
  onApply: (fg: string, bg: string) => void;
}) {
  const { fgRgb, bgRgb } = props;
  const wcag = wcagVerdict(fgRgb, bgRgb);
  const lc = apcaLc(fgRgb, bgRgb);
  const rating = apcaRating(lc);
  const suggestions = useMemo(
    () => (wcag.normalAA ? [] : suggestAccessible(fgRgb, bgRgb, 4.5)),
    [props.fg, props.bg], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <section className="rise mb-3 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Swatch label="Text" hex={props.fg} onChange={props.onFg} pickMode="fg" />
        <button
          onClick={props.onSwap}
          title="Swap"
          className="mt-4 rounded-md border border-border px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          ⇄
        </button>
        <Swatch label="Background" hex={props.bg} onChange={props.onBg} pickMode="bg" />
      </div>

      <div
        className="mb-3 rounded-lg border border-border px-4 py-3 text-center"
        style={{ backgroundColor: props.bg, color: props.fg }}
      >
        <span className="text-lg font-semibold">The quick brown fox</span>
        <span className="ml-2 text-xs">jumps over the lazy dog</span>
      </div>

      <div className="mb-2 flex items-end justify-between">
        <div>
          <span className="font-mono text-3xl font-bold tabular-nums">
            {wcag.ratio.toFixed(2)}
          </span>
          <span className="ml-1 text-sm text-muted-foreground">: 1</span>
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

      <div className="grid grid-cols-5 gap-1.5">
        <Verdict label="AA" sub="normal" ok={wcag.normalAA} />
        <Verdict label="AAA" sub="normal" ok={wcag.normalAAA} />
        <Verdict label="AA" sub="large" ok={wcag.largeAA} />
        <Verdict label="AAA" sub="large" ok={wcag.largeAAA} />
        <Verdict label="AA" sub="UI" ok={wcag.uiAA} />
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Make it pass — nearest AA fixes
          </h3>
          <div className="flex gap-2">
            {suggestions.map((s) => {
              const hex = rgbToHex(s.color);
              return (
                <button
                  key={hex}
                  onClick={() => props.onApply(hex, props.bg)}
                  className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 hover:bg-muted"
                  title={`Apply ${hex}`}
                >
                  <span
                    className="h-5 w-5 rounded border border-border"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-left">
                    <span className="block font-mono text-[11px]">{hex}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {s.ratio.toFixed(2)}:1 · {s.direction}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function Swatch(props: {
  label: string;
  hex: string;
  onChange: (hex: string) => void;
  pickMode: "fg" | "bg";
}) {
  const [draft, setDraft] = useState(props.hex);
  useEffect(() => setDraft(props.hex), [props.hex]);
  return (
    <div className="min-w-0 flex-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {props.label}
      </span>
      <div className="mt-1 flex items-center gap-1.5">
        <button
          onClick={() => void ipc.beginOverlay(props.pickMode)}
          title={`Pick ${props.label.toLowerCase()} from screen`}
          className="h-8 w-8 shrink-0 rounded-lg border border-border shadow-sm transition-transform hover:scale-105"
          style={{ backgroundColor: props.hex }}
        />
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (hexToRgb(e.target.value)) props.onChange(e.target.value.toUpperCase());
          }}
          spellCheck={false}
          className="w-full min-w-0 rounded-md border border-border bg-card-2 px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}

function Verdict({ label, sub, ok }: { label: string; sub: string; ok: boolean }) {
  return (
    <div
      className={`rounded-md border px-1 py-1 text-center ${
        ok ? "border-ok/40 bg-ok/10" : "border-coral/40 bg-coral/10"
      }`}
    >
      <span className={`block text-[11px] font-bold ${ok ? "text-ok" : "text-coral"}`}>
        {ok ? label : `${label} ✕`}
      </span>
      <span className="block text-[9px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function ToolCard(props: { title: string; hotkey: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className="group rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/50"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{props.title}</span>
        <kbd className="rounded border border-border bg-card-2 px-1 py-0.5 text-[9px] text-muted-foreground">
          {props.hotkey}
        </kbd>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground group-hover:text-foreground">
        {props.hint}
      </p>
    </button>
  );
}
