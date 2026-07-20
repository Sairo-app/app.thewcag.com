import { useEffect, useRef, useState } from "react";
import { COLORBLIND_MATRICES, type ColorblindType } from "@accessibility-build/a11y-core";
import { ArrowsOutSimple, Camera, Eye, Minus, SlidersHorizontal, X } from "@phosphor-icons/react";
import type { LensFrame } from "../shared/desktop";
import { desktop } from "./api";

const TYPES: { value: ColorblindType | "none"; label: string }[] = [{ value: "none", label: "Original" }, { value: "protanopia", label: "Protan" }, { value: "deuteranopia", label: "Deutan" }, { value: "tritanopia", label: "Tritan" }, { value: "achromatopsia", label: "Mono" }];

export function LensView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [type, setType] = useState<ColorblindType | "none">("deuteranopia");
  const [severity, setSeverity] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [split, setSplit] = useState(false);
  const [blur, setBlur] = useState(false);
  const [lowContrast, setLowContrast] = useState(false);
  const [lastFrame, setLastFrame] = useState<string | null>(null);

  useEffect(() => {
    let active = true, timer = 0;
    async function tick() {
      try { const frame = await desktop.invoke<LensFrame>("lens:frame"); if (active) { setLastFrame(frame.dataUrl); await draw(frame.dataUrl); } } catch { /* next frame retries */ }
      if (active) timer = window.setTimeout(tick, 120);
    }
    void tick(); return () => { active = false; clearTimeout(timer); };
  }, [type, severity, zoom, split, blur, lowContrast]);

  async function draw(dataUrl: string) {
    const canvas = canvasRef.current; if (!canvas) return;
    const image = new Image(); image.src = dataUrl; await image.decode();
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.save(); ctx.filter = `${blur ? "blur(2.5px)" : ""} ${lowContrast ? "contrast(.55)" : ""}`.trim() || "none";
    const drawWidth = image.naturalWidth / zoom, drawHeight = image.naturalHeight / zoom;
    ctx.drawImage(image, (image.naturalWidth - drawWidth) / 2, (image.naturalHeight - drawHeight) / 2, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height); ctx.restore();
    if (type === "none") return;
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height), matrix = COLORBLIND_MATRICES[type], amount = severity / 100, boundary = split ? Math.floor(canvas.width / 2) : 0;
    for (let y = 0; y < canvas.height; y++) for (let x = boundary; x < canvas.width; x++) { const i = (y * canvas.width + x) * 4, r = frame.data[i], g = frame.data[i + 1], b = frame.data[i + 2]; const nr = matrix[0] * r + matrix[1] * g + matrix[2] * b, ng = matrix[3] * r + matrix[4] * g + matrix[5] * b, nb = matrix[6] * r + matrix[7] * g + matrix[8] * b; frame.data[i] = r + (nr - r) * amount; frame.data[i + 1] = g + (ng - g) * amount; frame.data[i + 2] = b + (nb - b) * amount; }
    ctx.putImageData(frame, 0, 0); if (split) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(boundary, 0); ctx.lineTo(boundary, canvas.height); ctx.stroke(); }
  }
  async function exportFrame() { if (!canvasRef.current) return; await desktop.invoke("dialog:save-image", { name: `vision-${type}.png`, pngDataUrl: canvasRef.current.toDataURL("image/png") }); }

  return <div className="lens-window"><header className="lens-titlebar"><div className="lens-drag"><Eye size={16} weight="duotone" /><strong>Vision lens</strong><span>{TYPES.find((item) => item.value === type)?.label}</span></div><button aria-label="Export frame" title="Export frame" onClick={() => void exportFrame()}><Camera size={15} /></button><button aria-label="Close lens" title="Close" onClick={() => void desktop.invoke("window:close")}><X size={16} /></button></header><div className="lens-canvas"><canvas ref={canvasRef} />{split ? <span className="split-label original">Original</span> : null}{split ? <span className="split-label simulated">Simulated</span> : null}{!lastFrame ? <div className="lens-loading">Capturing the area behind this lens</div> : null}</div><footer className="lens-controls"><select value={type} onChange={(event) => setType(event.target.value as ColorblindType | "none")} aria-label="Simulation type">{TYPES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><label title="Simulation severity"><SlidersHorizontal size={15} /><input type="range" min="0" max="100" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} /><span>{severity}%</span></label><button data-active={split} onClick={() => setSplit((value) => !value)}>Split</button><button data-active={blur} onClick={() => setBlur((value) => !value)}>Blur</button><button data-active={lowContrast} onClick={() => setLowContrast((value) => !value)}>Low contrast</button><label title="Zoom"><ArrowsOutSimple size={14} /><input type="range" min="1" max="3" step=".25" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><span>{zoom}×</span></label></footer></div>;
}
