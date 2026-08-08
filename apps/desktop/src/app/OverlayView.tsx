import { useEffect, useRef, useState } from "react";
import { ArrowRight, Crosshair, FrameCorners, Ruler, X } from "./Icon";
import type { OverlayResult, OverlaySession, PickedColor, Point } from "../shared/desktop";
import { rgbToHex } from "@accessibility-build/a11y-core";
import { desktop } from "./api";
import { messageFromError } from "./hooks";

const LOUPE_SIZE = 132;
const LOUPE_TOTAL_W = 146;
const LOUPE_TOTAL_H = 186;

export function OverlayView() {
  const [session, setSession] = useState<OverlaySession | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: innerWidth / 2, y: innerHeight / 2 });
  const [first, setFirst] = useState<PickedColor | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const apply = (value: OverlaySession) => {
      setSession(value);
      const next = new Image();
      next.onload = () => setImage(next);
      next.src = value.display.dataUrl;
    };
    const stop = desktop.on<OverlaySession>("overlay:init", apply);
    void desktop.invoke<OverlaySession>("overlay:ready").then(apply).catch((reason) => {
      setError(messageFromError(reason, "Screen inspection could not be prepared."));
    });
    return stop;
  }, []);
  useEffect(() => desktop.on<{ sessionId: string; color: PickedColor }>("overlay:progress", (value) => {
    if (session?.id === value.sessionId) setFirst(value.color);
  }), [session?.id]);

  useEffect(() => {
    if (!session || !image || !canvasRef.current) return;
    const canvas = canvasRef.current; canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext("2d", { willReadFrequently: true })!.drawImage(image, 0, 0);
  }, [session, image]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelOverlay();
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); const step = event.shiftKey ? 10 : 1;
        setCursor((point) => ({ x: Math.max(0, Math.min(innerWidth - 1, point.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0))), y: Math.max(0, Math.min(innerHeight - 1, point.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0))) }));
      }
      if (event.key === "Enter") {
        if (session?.mode === "capture" || session?.mode === "measure") {
          event.preventDefault();
          if (!start) {
            setStart({ ...cursor });
          } else {
            void finishRegion({ ...cursor }).catch(reportOverlayFailure);
          }
        } else {
          void pick(cursor).catch(reportOverlayFailure);
        }
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [cursor, session, first, start]);

  useEffect(() => {
    if (!canvasRef.current || !loupeRef.current || !image) return;
    const source = canvasRef.current, loupe = loupeRef.current, ctx = loupe.getContext("2d")!;
    const sx = cursor.x / innerWidth * source.width, sy = cursor.y / innerHeight * source.height;
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE); ctx.drawImage(source, sx - 9, sy - 9, 18, 18, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(LOUPE_SIZE / 2, 0); ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE); ctx.moveTo(0, LOUPE_SIZE / 2); ctx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2); ctx.stroke();
  }, [cursor, image]);

  function sampled(point: Point): PickedColor | null {
    const canvas = canvasRef.current; if (!canvas || !session) return null;
    const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x / innerWidth * canvas.width)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y / innerHeight * canvas.height)));
    const [r, g, b] = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(px, py, 1, 1).data;
    return { x: point.x + session.display.bounds.x, y: point.y + session.display.bounds.y, r, g, b, hex: rgbToHex({ r, g, b }).toUpperCase() };
  }
  function reportOverlayFailure(reason: unknown) {
    setError(messageFromError(reason, "Screen inspection could not be completed."));
  }
  function cancelOverlay() {
    void desktop.invoke("overlay:cancel").catch(reportOverlayFailure);
  }
  async function pick(point: Point) {
    if (!session) return; const color = sampled(point); if (!color) return;
    if (session.mode === "pair") { await desktop.invoke("overlay:sample", { sessionId: session.id, color }); return; }
    const result: OverlayResult = session.mode === "foreground" || session.mode === "background" ? { mode: session.mode, colors: [color] } : { mode: "measure", rect: { x: point.x, y: point.y, width: 1, height: 1 } };
    await desktop.invoke("overlay:complete", { sessionId: session.id, result });
  }
  async function finishRegion(end: Point) {
    if (!session || !start || !canvasRef.current) return;
    const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y), width = Math.max(1, Math.abs(end.x - start.x)), height = Math.max(1, Math.abs(end.y - start.y));
    if (width < 4 || height < 4) { setStart(null); return; }
    if (session.mode === "measure") { await desktop.invoke("overlay:complete", { sessionId: session.id, result: { mode: "measure", rect: { x: x + session.display.bounds.x, y: y + session.display.bounds.y, width, height } } satisfies OverlayResult }); return; }
    const source = canvasRef.current, sx = Math.round(x / innerWidth * source.width), sy = Math.round(y / innerHeight * source.height), sw = Math.round(width / innerWidth * source.width), sh = Math.round(height / innerHeight * source.height);
    const crop = document.createElement("canvas"); crop.width = sw; crop.height = sh; crop.getContext("2d")!.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    await desktop.invoke("overlay:complete", { sessionId: session.id, result: { mode: "capture", rect: { x: x + session.display.bounds.x, y: y + session.display.bounds.y, width, height }, pngDataUrl: crop.toDataURL("image/png") } satisfies OverlayResult });
  }

  if (!session) {
    return (
      <div className="overlay-loading" role="status" aria-busy={!error}>
        {error ? (
          <>
            <span role="alert">{error}</span>
            <button type="button" onClick={cancelOverlay}>Close</button>
          </>
        ) : (
          "Preparing screen inspection"
        )}
      </div>
    );
  }
  const regionMode = session.mode === "capture" || session.mode === "measure";
  const selection = start ? { left: Math.min(start.x, cursor.x), top: Math.min(start.y, cursor.y), width: Math.abs(cursor.x - start.x), height: Math.abs(cursor.y - start.y) } : null;
  const color = sampled(cursor);
  const title = session.mode === "pair" ? first ? "Pick the background color" : "Pick the foreground color" : session.mode === "foreground" ? "Pick the foreground color" : session.mode === "background" ? "Pick the background color" : session.mode === "measure" ? "Drag across a target" : "Drag to capture an area";
  return <div className={`overlay-view ${regionMode ? "region-mode" : "picker-mode"}`} onMouseMove={(event) => setCursor({ x: event.clientX, y: event.clientY })} onMouseDown={(event) => { if (regionMode && event.button === 0) { setStart({ x: event.clientX, y: event.clientY }); setDragging(true); } }} onMouseUp={(event) => { if (regionMode && dragging) { setDragging(false); void finishRegion({ x: event.clientX, y: event.clientY }).catch(reportOverlayFailure); } }} onClick={() => { if (!regionMode) void pick(cursor).catch(reportOverlayFailure); }}>
    <canvas ref={canvasRef} className="overlay-frame" />
    {selection ? <div className="region-selection" data-label-inside={selection.top + selection.height > innerHeight - 40 ? "true" : undefined} style={selection}><span>{Math.round(selection.width)} × {Math.round(selection.height)}</span></div> : null}
    <div className="overlay-guide" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onMouseUp={(event) => event.stopPropagation()}><span className="overlay-mode-icon">{session.mode === "capture" ? <FrameCorners size={20} /> : session.mode === "measure" ? <Ruler size={20} /> : <Crosshair size={20} />}</span><div><strong>{title}</strong><span role="status">{error || (regionMode ? "Drag or press Enter to start and finish a region · Esc cancels" : "Click to sample · Arrows move · Enter confirms · Esc cancels")}</span></div>{first ? <span className="first-pick"><i style={{ backgroundColor: first.hex }} />{first.hex}<ArrowRight size={16} /></span> : null}<button aria-label="Cancel" title="Cancel (Esc)" onClick={(event) => { event.stopPropagation(); cancelOverlay(); }}><X size={20} /></button></div>
    {!regionMode && color ? <div className="loupe" style={{ left: Math.min(innerWidth - LOUPE_TOTAL_W - 16, cursor.x + 26), top: Math.max(16, Math.min(innerHeight - LOUPE_TOTAL_H - 16, cursor.y - LOUPE_SIZE / 2 - 20)) }}><canvas ref={loupeRef} width={LOUPE_SIZE} height={LOUPE_SIZE} /><div><i style={{ backgroundColor: color.hex }} /><strong>{color.hex}</strong><span>RGB {color.r}, {color.g}, {color.b}</span></div></div> : null}
    <div className="screen-crosshair" style={{ left: cursor.x, top: cursor.y }}><span /><span /></div>
  </div>;
}
