import { useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { contrastRatio, type Rgb } from "@accessibility-build/a11y-core";
import { ipc, type OverlayMeta, type PickedColor } from "../lib/ipc";

const LOUPE = { cells: 13, zoom: 14 }; // 13x13 physical pixels at 14x
const LOUPE_SIZE = LOUPE.cells * LOUPE.zoom;

/**
 * Fullscreen frozen-frame overlay. Two jobs:
 *  - pick modes ("pair" | "fg" | "bg"): magnified loupe, click to pick
 *  - "shot": drag to select a region, opens the annotation editor
 */
export default function OverlayWindow() {
  const [meta, setMeta] = useState<OverlayMeta | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imgDataRef = useRef<ImageData | null>(null);
  const imgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [firstPick, setFirstPick] = useState<PickedColor | null>(null);
  const [drag, setDrag] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    void (async () => {
      const [m, buf] = await Promise.all([ipc.overlayMeta(), ipc.overlayPng()]);
      setMeta(m);
      const blob = new Blob([buf], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      revoke = url;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        imgCanvasRef.current = canvas;
        imgDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setImageUrl(url);
      };
      img.src = url;
    })().catch(() => void ipc.closeOverlay(false));

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, []);

  // Keyboard: Esc cancel · arrows nudge by 1 physical px (⇧ = 10) ·
  // Enter/Space pick (or full-screen capture in shot mode) · C copy hex.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void ipc.closeOverlay(false);
        return;
      }
      if (!meta) return;
      const scale = meta.scale || 1;
      const step = (e.shiftKey ? 10 : 1) / scale;
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setMouse((m) => {
          const base = m ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
          return {
            x: Math.min(Math.max(base.x + dx, 0), window.innerWidth - 1),
            y: Math.min(Math.max(base.y + dy, 0), window.innerHeight - 1),
          };
        });
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (meta.mode === "shot") {
          void captureFull();
        } else if (mouse) {
          void pickAt(mouse.x, mouse.y);
        }
        return;
      }
      if ((e.key === "c" || e.key === "C") && meta.mode !== "shot" && mouse) {
        const loc = physical(mouse.x, mouse.y);
        if (loc) {
          void ipc.copyText(colorAt(loc.px, loc.py).hex).then(() => ipc.closeOverlay(false));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, mouse, firstPick]);

  function physical(clientX: number, clientY: number) {
    const scale = meta?.scale ?? 1;
    const data = imgDataRef.current;
    if (!data) return null;
    const px = Math.min(Math.max(Math.round(clientX * scale), 0), data.width - 1);
    const py = Math.min(Math.max(Math.round(clientY * scale), 0), data.height - 1);
    return { px, py };
  }

  function colorAt(px: number, py: number): PickedColor {
    const data = imgDataRef.current!;
    const i = (py * data.width + px) * 4;
    const [r, g, b] = [data.data[i], data.data[i + 1], data.data[i + 2]];
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    return { hex, r, g, b, x: px, y: py };
  }

  // Loupe rendering
  useEffect(() => {
    if (!mouse || !meta || meta.mode === "shot") return;
    const loc = physical(mouse.x, mouse.y);
    const src = imgCanvasRef.current;
    const canvas = loupeRef.current;
    if (!loc || !src || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const half = Math.floor(LOUPE.cells / 2);
    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.drawImage(
      src,
      loc.px - half,
      loc.py - half,
      LOUPE.cells,
      LOUPE.cells,
      0,
      0,
      LOUPE_SIZE,
      LOUPE_SIZE,
    );
    // pixel grid
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (let i = 1; i < LOUPE.cells; i++) {
      ctx.beginPath();
      ctx.moveTo(i * LOUPE.zoom + 0.5, 0);
      ctx.lineTo(i * LOUPE.zoom + 0.5, LOUPE_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * LOUPE.zoom + 0.5);
      ctx.lineTo(LOUPE_SIZE, i * LOUPE.zoom + 0.5);
      ctx.stroke();
    }
    // center pixel
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(half * LOUPE.zoom - 1, half * LOUPE.zoom - 1, LOUPE.zoom + 2, LOUPE.zoom + 2);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(half * LOUPE.zoom - 2, half * LOUPE.zoom - 2, LOUPE.zoom + 4, LOUPE.zoom + 4);
  }, [mouse, meta]);

  async function pickAt(clientX: number, clientY: number) {
    if (!meta) return;
    const loc = physical(clientX, clientY);
    if (!loc) return;
    const color = colorAt(loc.px, loc.py);
    if (meta.mode === "fg" || meta.mode === "bg") {
      await emit("overlay-picked", { mode: meta.mode, colors: [color] });
      await ipc.closeOverlay(true);
    } else if (meta.mode === "pair") {
      if (!firstPick) {
        setFirstPick(color);
      } else {
        await emit("overlay-picked", { mode: "pair", colors: [firstPick, color] });
        await ipc.closeOverlay(true);
      }
    }
  }

  async function captureFull() {
    const src = imgCanvasRef.current;
    if (!src) return;
    const blob: Blob = await new Promise((resolve) => src.toBlob((x) => resolve(x!), "image/png"));
    await ipc.storeAnnotation(new Uint8Array(await blob.arrayBuffer()));
  }

  async function finishRegion() {
    if (!drag || !meta) return;
    const a = physical(Math.min(drag.x1, drag.x2), Math.min(drag.y1, drag.y2));
    const b = physical(Math.max(drag.x1, drag.x2), Math.max(drag.y1, drag.y2));
    if (!a || !b || b.px - a.px < 8 || b.py - a.py < 8) {
      setDrag(null);
      return;
    }
    const src = imgCanvasRef.current!;
    const crop = document.createElement("canvas");
    crop.width = b.px - a.px;
    crop.height = b.py - a.py;
    crop.getContext("2d")!.drawImage(src, a.px, a.py, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const blob: Blob = await new Promise((resolve) => crop.toBlob((x) => resolve(x!), "image/png"));
    await ipc.storeAnnotation(new Uint8Array(await blob.arrayBuffer()));
  }

  const isShot = meta?.mode === "shot";
  const currentColor =
    mouse && !isShot && imgDataRef.current
      ? (() => {
          const loc = physical(mouse.x, mouse.y);
          return loc ? colorAt(loc.px, loc.py) : null;
        })()
      : null;

  const liveRatio =
    firstPick && currentColor
      ? contrastRatio(
          { r: firstPick.r, g: firstPick.g, b: firstPick.b } as Rgb,
          { r: currentColor.r, g: currentColor.g, b: currentColor.b } as Rgb,
        )
      : null;

  // loupe placement: flip when near edges
  const loupeStyle = (() => {
    if (!mouse) return { display: "none" } as React.CSSProperties;
    const pad = 24;
    const w = LOUPE_SIZE + 2;
    const h = LOUPE_SIZE + 58;
    const left = mouse.x + pad + w > window.innerWidth ? mouse.x - pad - w : mouse.x + pad;
    const top = mouse.y + pad + h > window.innerHeight ? mouse.y - pad - h : mouse.y + pad;
    return { left, top } as React.CSSProperties;
  })();

  const sel = drag && {
    left: Math.min(drag.x1, drag.x2),
    top: Math.min(drag.y1, drag.y2),
    width: Math.abs(drag.x2 - drag.x1),
    height: Math.abs(drag.y2 - drag.y1),
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ cursor: isShot ? "crosshair" : "none" }}
      onMouseMove={(e) => {
        setMouse({ x: e.clientX, y: e.clientY });
        if (drag) setDrag({ ...drag, x2: e.clientX, y2: e.clientY });
      }}
      onMouseDown={(e) => {
        if (isShot) setDrag({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
      }}
      onMouseUp={() => {
        if (isShot) void finishRegion();
      }}
      onClick={(e) => {
        if (!isShot) void pickAt(e.clientX, e.clientY);
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full"
          draggable={false}
        />
      )}

      {/* dim mask for region select */}
      {isShot && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-black/40" />
          {sel && (
            <div
              className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
              style={{ ...sel, backgroundColor: "transparent" }}
            >
              <span className="absolute -top-6 left-0 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
                {Math.round((sel.width ?? 0) * (meta?.scale ?? 1))} ×{" "}
                {Math.round((sel.height ?? 0) * (meta?.scale ?? 1))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* loupe */}
      {!isShot && mouse && (
        <div
          className="pointer-events-none absolute z-10 overflow-hidden rounded-xl border border-white/70 bg-black/80 shadow-2xl"
          style={loupeStyle}
        >
          <canvas ref={loupeRef} width={LOUPE_SIZE} height={LOUPE_SIZE} />
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            {currentColor && (
              <>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-3.5 w-3.5 rounded border border-white/40"
                    style={{ backgroundColor: currentColor.hex }}
                  />
                  <span className="font-mono text-[11px] text-white">{currentColor.hex}</span>
                </span>
                {liveRatio !== null && (
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-[11px] text-white/80">
                      {liveRatio.toFixed(2)}:1
                    </span>
                    <span
                      className={`rounded px-1 py-px text-[9px] font-bold ${
                        liveRatio >= 4.5
                          ? "bg-emerald-500/90 text-white"
                          : liveRatio >= 3
                            ? "bg-amber-500/90 text-black"
                            : "bg-red-500/90 text-white"
                      }`}
                    >
                      {liveRatio >= 4.5 ? "AA" : liveRatio >= 3 ? "AA-L" : "✕"}
                    </span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* first pick marker */}
      {firstPick && mouse && (
        <div
          className="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-full bg-black/80 px-2 py-1"
          style={{ left: 16, top: 16 }}
        >
          <span
            className="h-3.5 w-3.5 rounded-full border border-white/50"
            style={{ backgroundColor: firstPick.hex }}
          />
          <span className="font-mono text-[11px] text-white">text {firstPick.hex}</span>
          <span className="text-[11px] text-white/60">— now click the background</span>
        </div>
      )}

      {/* instruction pill */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1.5 text-[11px] text-white/90 shadow-lg">
        {isShot
          ? "Drag to capture a region · Space for full screen · Esc to cancel"
          : meta?.mode === "pair"
            ? firstPick
              ? "Click the background color · arrows nudge · C copies hex · Esc cancels"
              : "Click the text color · arrows nudge · C copies hex · Esc cancels"
            : `Click to pick the ${meta?.mode === "bg" ? "background" : "text"} color · arrows nudge · C copies hex · Esc cancels`}
      </div>
    </div>
  );
}
