import { useEffect, useRef, useState } from "react";
import {
  COLORBLIND_MATRICES,
  type ColorblindType,
} from "@accessibility-build/a11y-core";
import {
  DownloadSimple,
  Eye,
  MagnifyingGlassPlus,
  SlidersHorizontal,
  X,
} from "./Icon";
import type { LensFrame } from "../shared/desktop";
import { desktop } from "./api";
import { messageFromError } from "./hooks";

const TYPES: { value: ColorblindType | "none"; label: string }[] = [
  { value: "none", label: "Original" },
  { value: "protanopia", label: "Protanopia" },
  { value: "deuteranopia", label: "Deuteranopia" },
  { value: "tritanopia", label: "Tritanopia" },
  { value: "achromatopsia", label: "Monochromacy" },
];

export function LensView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [type, setType] =
    useState<ColorblindType | "none">("deuteranopia");
  const [severity, setSeverity] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [split, setSplit] = useState(false);
  const [blur, setBlur] = useState(false);
  const [lowContrast, setLowContrast] = useState(false);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const failureCountRef = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void desktop.invoke("window:close")
          .catch((caught) => setError(messageFromError(caught, "The vision lens could not be closed.")));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let active = true;
    let timer = 0;
    async function tick() {
      try {
        const frame = await desktop.invoke<LensFrame>("lens:frame");
        if (active) {
          failureCountRef.current = 0;
          setError("");
          setLastFrame(frame.dataUrl);
          await draw(frame.dataUrl);
        }
      } catch (caught) {
        // Transient capture errors retry; a persistent run means the screen
        // recording permission is likely missing.
        failureCountRef.current += 1;
        if (active && failureCountRef.current === 10) {
          setError(messageFromError(caught, "The screen behind the lens cannot be captured. Check that TheWCAG has screen recording permission in system settings."));
        }
      }
      if (active) timer = window.setTimeout(tick, 120);
    }
    void tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [type, severity, zoom, split, blur, lowContrast]);

  async function draw(dataUrl: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.save();
    ctx.filter =
      `${blur ? "blur(2.5px)" : ""} ${lowContrast ? "contrast(.55)" : ""}`.trim() ||
      "none";
    const drawWidth = image.naturalWidth / zoom;
    const drawHeight = image.naturalHeight / zoom;
    ctx.drawImage(
      image,
      (image.naturalWidth - drawWidth) / 2,
      (image.naturalHeight - drawHeight) / 2,
      drawWidth,
      drawHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    ctx.restore();
    if (type === "none") return;
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const matrix = COLORBLIND_MATRICES[type];
    const amount = severity / 100;
    const boundary = split ? Math.floor(canvas.width / 2) : 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = boundary; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = frame.data[i];
        const g = frame.data[i + 1];
        const b = frame.data[i + 2];
        const nr = matrix[0] * r + matrix[1] * g + matrix[2] * b;
        const ng = matrix[3] * r + matrix[4] * g + matrix[5] * b;
        const nb = matrix[6] * r + matrix[7] * g + matrix[8] * b;
        frame.data[i] = r + (nr - r) * amount;
        frame.data[i + 1] = g + (ng - g) * amount;
        frame.data[i + 2] = b + (nb - b) * amount;
      }
    }
    ctx.putImageData(frame, 0, 0);
    if (split) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(boundary, 0);
      ctx.lineTo(boundary, canvas.height);
      ctx.stroke();
    }
  }

  async function exportFrame() {
    if (!canvasRef.current) return;
    const label = (TYPES.find((item) => item.value === type)?.label ?? "original").toLowerCase();
    try {
      await desktop.invoke("dialog:save-image", {
        name: `vision-${label}.png`,
        pngDataUrl: canvasRef.current.toDataURL("image/png"),
      });
      setError("");
      setStatus("Vision frame exported.");
      window.setTimeout(() => setStatus(""), 4000);
    } catch (caught) {
      setError(messageFromError(caught, "The vision frame could not be exported."));
    }
  }

  return (
    <div className="lens-window">
      <header className="lens-titlebar">
        <div className="lens-drag">
          <Eye size={16} />
          <strong>Vision lens</strong>
          <span>{TYPES.find((item) => item.value === type)?.label}</span>
        </div>
        <button
          aria-label="Export frame"
          title="Export frame"
          onClick={() => void exportFrame()}
        >
          <DownloadSimple size={20} />
        </button>
        <button
          aria-label="Close vision lens"
          title="Close (Esc)"
          onClick={() => void desktop.invoke("window:close")
            .catch((caught) => setError(messageFromError(caught, "The vision lens could not be closed.")))}
        >
          <X size={20} />
        </button>
      </header>
      <div className="lens-canvas">
        {error ? <div className="lens-loading" role="alert">{error}</div> : null}
        {status ? <div className="lens-loading" role="status">{status}</div> : null}
        <canvas ref={canvasRef} aria-label="Live vision simulation" />
        {split ? <span className="split-label original">Original</span> : null}
        {split ? (
          <span className="split-label simulated">Simulated</span>
        ) : null}
        {!lastFrame ? (
          <div className="lens-loading" role="status">
            Capturing the area behind this lens
          </div>
        ) : null}
      </div>
      <footer className="lens-controls">
        <select
          value={type}
          onChange={(event) =>
            setType(event.target.value as ColorblindType | "none")
          }
          aria-label="Simulation type"
        >
          {TYPES.map((item) => (
            <option value={item.value} key={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <label className="lens-severity" title="Simulation severity">
          <SlidersHorizontal size={16} aria-hidden />
          <input
            aria-label="Simulation severity"
            type="range"
            min="0"
            max="100"
            value={severity}
            onChange={(event) => setSeverity(Number(event.target.value))}
          />
          <output>{severity}%</output>
        </label>
        <div className="lens-toggles" role="group" aria-label="Lens effects">
          <button
            aria-pressed={split}
            data-active={split}
            onClick={() => setSplit((value) => !value)}
          >
            Split
          </button>
          <button
            aria-pressed={blur}
            data-active={blur}
            onClick={() => setBlur((value) => !value)}
          >
            Blur
          </button>
          <button
            aria-pressed={lowContrast}
            data-active={lowContrast}
            onClick={() => setLowContrast((value) => !value)}
          >
            Low contrast
          </button>
        </div>
        <label className="lens-zoom" title="Zoom">
          <MagnifyingGlassPlus size={16} aria-hidden />
          <input
            aria-label="Lens zoom"
            type="range"
            min="1"
            max="3"
            step=".25"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <output>{zoom}×</output>
        </label>
      </footer>
    </div>
  );
}
