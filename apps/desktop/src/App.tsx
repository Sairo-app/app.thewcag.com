import { useEffect, useState } from "react";
import {
  apcaLc,
  apcaRating,
  rgbString,
  wcagVerdict,
  type Rgb,
} from "@accessibility-build/a11y-core";
import { events, ipc, type PickedColor } from "./lib/ipc";

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

export default function App() {
  const [permission, setPermission] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<PickedColor | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshPermission();
    const unlisteners = [
      events.onColorPicked((c) => {
        setPicked(c);
        setError(null);
      }),
      events.onScreenshotTaken((path) => {
        setScreenshot(path);
        setError(null);
      }),
      events.onCaptureError((message) => setError(message)),
    ];
    // Re-check permission when the user returns from System Settings.
    const onFocus = () => void refreshPermission();
    window.addEventListener("focus", onFocus);
    return () => {
      unlisteners.forEach((p) => void p.then((un) => un()));
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function refreshPermission() {
    try {
      setPermission(await ipc.screenPermissionStatus());
    } catch {
      setPermission(null);
    }
  }

  async function grantPermission() {
    const granted = await ipc.requestScreenPermission();
    if (!granted) {
      // Already denied once: the OS won't re-prompt, take them to Settings.
      await ipc.openScreenRecordingSettings();
    }
    await refreshPermission();
  }

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-6 font-sans text-slate-100">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Accessibility<span className="text-amber-400">.build</span>
          </h1>
          <p className="text-xs text-slate-400">Instant accessibility checks, anywhere on screen</p>
        </div>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400">
          M0
        </span>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <PermissionCard
        permission={permission}
        onGrant={() => void grantPermission()}
        onOpenSettings={() => void ipc.openScreenRecordingSettings()}
      />

      <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Tools
        </h2>
        <ToolRow
          name="Pick color"
          hotkey="⌥⌘P"
          onRun={() => void ipc.pickColorAtCursor().then(setPicked).catch((e) => setError(String(e)))}
        />
        <ToolRow
          name="Screenshot"
          hotkey="⌥⌘S"
          onRun={() => void ipc.captureFullscreen().then(setScreenshot).catch((e) => setError(String(e)))}
        />
        <ToolRow name="Colorblind lens" hotkey="⌥⌘L" disabled note="coming in M3" />
      </section>

      {picked && <PickedCard picked={picked} />}

      {screenshot && (
        <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Last screenshot
          </h2>
          <p className="break-all text-xs text-slate-300">{screenshot}</p>
        </section>
      )}
    </div>
  );
}

function PermissionCard(props: {
  permission: boolean | null;
  onGrant: () => void;
  onOpenSettings: () => void;
}) {
  const { permission } = props;
  return (
    <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Screen Recording permission</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Needed to read pixels for the color picker and capture screenshots.
            Nothing ever leaves your Mac.
          </p>
        </div>
        <span
          className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            permission
              ? "bg-emerald-950 text-emerald-400"
              : "bg-amber-950 text-amber-400"
          }`}
        >
          {permission === null ? "…" : permission ? "GRANTED" : "NEEDED"}
        </span>
      </div>
      {!permission && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={props.onGrant}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            Grant permission
          </button>
          <button
            onClick={props.onOpenSettings}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Open System Settings
          </button>
        </div>
      )}
    </section>
  );
}

function ToolRow(props: {
  name: string;
  hotkey: string;
  onRun?: () => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-baseline gap-2">
        <span className={`text-sm ${props.disabled ? "text-slate-500" : ""}`}>{props.name}</span>
        {props.note && <span className="text-[10px] text-slate-500">{props.note}</span>}
      </div>
      <div className="flex items-center gap-2">
        <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
          {props.hotkey}
        </kbd>
        <button
          onClick={props.onRun}
          disabled={props.disabled}
          className="rounded-md border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        >
          Run
        </button>
      </div>
    </div>
  );
}

function PickedCard({ picked }: { picked: PickedColor }) {
  const rgb: Rgb = { r: picked.r, g: picked.g, b: picked.b };
  return (
    <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Last picked color
      </h2>
      <div className="mb-3 flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg border border-slate-700"
          style={{ backgroundColor: picked.hex }}
        />
        <div>
          <button
            onClick={() => void navigator.clipboard.writeText(picked.hex)}
            title="Copy hex"
            className="block font-mono text-sm text-slate-100 hover:text-amber-400"
          >
            {picked.hex}
          </button>
          <span className="font-mono text-[11px] text-slate-400">{rgbString(rgb)}</span>
        </div>
      </div>
      <ContrastRow label="on white" fg={rgb} bg={WHITE} />
      <ContrastRow label="on black" fg={rgb} bg={BLACK} />
    </section>
  );
}

function ContrastRow({ label, fg, bg }: { label: string; fg: Rgb; bg: Rgb }) {
  const wcag = wcagVerdict(fg, bg);
  const lc = apcaLc(fg, bg);
  return (
    <div className="flex items-center justify-between border-t border-slate-800 py-1.5 text-xs">
      <span
        className="rounded px-2 py-0.5 font-medium"
        style={{
          color: `rgb(${fg.r}, ${fg.g}, ${fg.b})`,
          backgroundColor: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
        }}
      >
        Aa {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-slate-300">{wcag.ratio.toFixed(2)}:1</span>
        <Badge ok={wcag.normalAA} text="AA" />
        <Badge ok={wcag.normalAAA} text="AAA" />
        <span
          className={`font-mono ${apcaRating(lc) === "fail" ? "text-red-400" : "text-slate-400"}`}
          title="APCA Lc"
        >
          Lc {lc}
        </span>
      </div>
    </div>
  );
}

function Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
        ok ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"
      }`}
    >
      {text}
    </span>
  );
}
