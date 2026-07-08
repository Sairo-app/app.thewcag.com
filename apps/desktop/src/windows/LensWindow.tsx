import { useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { COLORBLIND_MATRICES, type ColorblindType } from "@accessibility-build/a11y-core";
import { GlFilter, IDENTITY_MATRIX } from "../lib/glfilter";
import { ipc } from "../lib/ipc";
import { CloseIcon, FreezeIcon, SaveIcon, SplitIcon } from "../lib/icons";

const FRAME_MS = 80; // ~12.5fps

const FILTERS: { key: ColorblindType | "off"; label: string; title: string }[] = [
  { key: "off", label: "Off", title: "No filter (compare)" },
  { key: "protanopia", label: "Protan", title: "Red-blind (~1% of men)" },
  { key: "deuteranopia", label: "Deutan", title: "Green-blind (most common CVD)" },
  { key: "tritanopia", label: "Tritan", title: "Blue-blind (rare)" },
  { key: "achromatopsia", label: "Mono", title: "No color perception" },
];

/** Anomalous trichromacy ≈ lerp(identity, dichromat matrix, severity). */
function severityMatrix(type: ColorblindType, severity: number): number[] {
  const full = COLORBLIND_MATRICES[type];
  return full.map((v, i) => IDENTITY_MATRIX[i] + (v - IDENTITY_MATRIX[i]) * severity);
}

export default function LensWindow() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const filterRef = useRef<GlFilter | null>(null);
  const [filter, setFilter] = useState<ColorblindType | "off">("deuteranopia");
  const [severity, setSeverity] = useState(100);
  const [frozen, setFrozen] = useState(false);
  const [split, setSplit] = useState(false);
  const [lowVision, setLowVision] = useState<"none" | "blur" | "lowcontrast">("none");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const stateRef = useRef({ filter, frozen, split, severity });
  stateRef.current = { filter, frozen, split, severity };

  // 1-5 filter, Space freeze, D split, B blur, L low contrast
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Escape") {
        void getCurrentWebviewWindow().close();
        return;
      }
      const index = Number(e.key) - 1;
      if (index >= 0 && index < FILTERS.length) setFilter(FILTERS[index].key);
      if (e.key === " ") {
        e.preventDefault();
        setFrozen((f) => !f);
      }
      if (e.key.toLowerCase() === "d") setSplit((s) => !s);
      if (e.key.toLowerCase() === "b") setLowVision((v) => (v === "blur" ? "none" : "blur"));
      if (e.key.toLowerCase() === "l") setLowVision((v) => (v === "lowcontrast" ? "none" : "lowcontrast"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const canvas = canvasRef.current!;
    try {
      filterRef.current = new GlFilter(canvas);
    } catch (e) {
      setError(String(e));
      return;
    }

    async function tick() {
      if (cancelled) return;
      const { filter: f, frozen: fz, split: sp, severity: sev } = stateRef.current;
      if (!fz) {
        try {
          const buf = await ipc.lensFrame();
          const view = new DataView(buf);
          const width = view.getUint32(0, true);
          const height = view.getUint32(4, true);
          const pixels = new Uint8Array(buf, 8);
          const matrix = f === "off" ? IDENTITY_MATRIX : severityMatrix(f, sev / 100);
          filterRef.current?.draw(pixels, width, height, matrix, sp && f !== "off");
          setError(null);
        } catch (e) {
          setError(String(e));
        }
      }
      if (!cancelled) timer = setTimeout(tick, FRAME_MS);
    }
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function saveShot() {
    const canvas = canvasRef.current!;
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    const name = `colorblind-${filter}-${new Date().toISOString().slice(0, 10)}.png`;
    const path = await ipc.savePng(new Uint8Array(await blob.arrayBuffer()), name);
    if (path) {
      setSaved(`Saved ${path.split("/").pop()}`);
      setTimeout(() => setSaved(null), 2200);
    }
  }

  const cssFilter =
    lowVision === "blur" ? "blur(5px)" : lowVision === "lowcontrast" ? "contrast(0.55) brightness(1.1)" : "none";

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-xl border border-border bg-card font-sans text-foreground">
      <header
        data-tauri-drag-region
        className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/80 px-2 py-1.5 backdrop-blur-xl"
      >
        <div data-tauri-drag-region className="flex flex-wrap items-center gap-2">
          <div className="seg">
            {FILTERS.map((f, i) => (
              <button key={f.key} data-active={filter === f.key} onClick={() => setFilter(f.key)} title={`${f.title} (${i + 1})`}>
                {f.label}
              </button>
            ))}
          </div>
          {filter !== "off" && filter !== "achromatopsia" && (
            <label className="flex items-center gap-1" title="Severity - 100% is full dichromacy, lower is anomalous trichromacy (more common)">
              <input
                type="range"
                min={20}
                max={100}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-16 accent-[hsl(var(--primary))]"
              />
              <span className="w-8 font-mono text-[10px] text-muted-foreground">{severity}%</span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLowVision((v) => (v === "blur" ? "none" : "blur"))}
            aria-pressed={lowVision === "blur"}
            aria-label="Low acuity blur (B)"
            title="Low acuity - blur (B)"
            className={`rounded-md px-2 py-1 text-[11px] ${
              lowVision === "blur" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Blur
          </button>
          <button
            onClick={() => setLowVision((v) => (v === "lowcontrast" ? "none" : "lowcontrast"))}
            aria-pressed={lowVision === "lowcontrast"}
            aria-label="Low contrast sensitivity (L)"
            title="Low contrast sensitivity (L)"
            className={`rounded-md px-2 py-1 text-[11px] ${
              lowVision === "lowcontrast" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Low-C
          </button>
          <span className="h-4 w-px bg-border" />
          <button
            onClick={() => setSplit((s) => !s)}
            aria-pressed={split}
            aria-label="Split view (D)"
            title="Split view: left original, right filtered (D)"
            className={`rounded-md p-1.5 ${
              split ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <SplitIcon />
          </button>
          <button
            onClick={() => setFrozen((f) => !f)}
            aria-pressed={frozen}
            aria-label={frozen ? "Resume live view (Space)" : "Freeze frame (Space)"}
            title={frozen ? "Resume (Space)" : "Freeze frame (Space)"}
            className={`rounded-md p-1.5 ${
              frozen ? "bg-yellow/20 text-yellow" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <FreezeIcon />
          </button>
          <button
            onClick={() => void saveShot()}
            aria-label="Save what the lens sees"
            title="Save what the lens sees"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <SaveIcon />
          </button>
          <button
            onClick={() => void getCurrentWebviewWindow().close()}
            aria-label="Close lens"
            title="Close lens"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-coral/20 hover:text-coral"
          >
            <CloseIcon />
          </button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 bg-black">
        <canvas ref={canvasRef} className="h-full w-full" style={{ filter: cssFilter }} />
        {split && filter !== "off" && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/60" />
            <span className="pointer-events-none absolute bottom-1.5 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white/80">
              original
            </span>
            <span className="pointer-events-none absolute bottom-1.5 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white/80">
              {filter} {severity < 100 && filter !== "achromatopsia" ? `${severity}%` : ""}
            </span>
          </>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-white/70">
            {error}
          </div>
        )}
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-3 py-1 text-[11px] text-white transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}
        >
          {saved}
        </div>
      </div>
    </div>
  );
}
