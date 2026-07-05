import { useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  COLORBLIND_MATRICES,
  type ColorblindType,
} from "@accessibility-build/a11y-core";
import { GlFilter, IDENTITY_MATRIX } from "../lib/glfilter";
import { ipc } from "../lib/ipc";

const FRAME_MS = 80; // ~12.5fps

const FILTERS: { key: ColorblindType | "off"; label: string; title: string }[] = [
  { key: "off", label: "Off", title: "No filter (compare)" },
  { key: "protanopia", label: "Protan", title: "Protanopia — no red cones (~1% of men)" },
  { key: "deuteranopia", label: "Deutan", title: "Deuteranopia — no green cones (~1% of men)" },
  { key: "tritanopia", label: "Tritan", title: "Tritanopia — no blue cones (rare)" },
  { key: "achromatopsia", label: "Mono", title: "Achromatopsia — no color at all" },
];

export default function LensWindow() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const filterRef = useRef<GlFilter | null>(null);
  const [filter, setFilter] = useState<ColorblindType | "off">("deuteranopia");
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef({ filter, frozen });
  stateRef.current = { filter, frozen };

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
      const { filter: f, frozen: fz } = stateRef.current;
      if (!fz) {
        try {
          const buf = await ipc.lensFrame();
          const view = new DataView(buf);
          const width = view.getUint32(0, true);
          const height = view.getUint32(4, true);
          const pixels = new Uint8Array(buf, 8);
          const matrix = f === "off" ? IDENTITY_MATRIX : COLORBLIND_MATRICES[f];
          filterRef.current?.draw(pixels, width, height, matrix);
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
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png"),
    );
    const name = `colorblind-${filter}-${new Date().toISOString().slice(0, 10)}.png`;
    await ipc.savePng(new Uint8Array(await blob.arrayBuffer()), name);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-xl border border-border bg-card font-sans text-foreground">
      <header
        data-tauri-drag-region
        className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5"
      >
        <div data-tauri-drag-region className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              title={f.title}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFrozen((f) => !f)}
            title={frozen ? "Resume" : "Freeze frame"}
            className={`rounded-md px-2 py-1 text-[11px] ${
              frozen
                ? "bg-yellow/20 text-yellow"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {frozen ? "❄ Frozen" : "❄"}
          </button>
          <button
            onClick={() => void saveShot()}
            title="Save what the lens sees"
            className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ⤓
          </button>
          <button
            onClick={() => void getCurrentWebviewWindow().close()}
            title="Close lens (⌥⌘L)"
            className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-coral/20 hover:text-coral"
          >
            ✕
          </button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 bg-black">
        <canvas ref={canvasRef} className="h-full w-full" />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-white/70">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
