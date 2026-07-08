import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { emit } from "@tauri-apps/api/event";
import { contrastRatio } from "@accessibility-build/a11y-core";
import { ipc } from "../lib/ipc";
import {
  emptyDoc,
  ISSUE_TYPES,
  issueTypeOf,
  parseDoc,
  SEVERITIES,
  SEVERITY_COLORS,
  type IssueId,
  type Severity,
  type Shape,
  type Tool,
} from "../lib/annotate/model";
import {
  applyHandle,
  floodBounds,
  handlesFor,
  hitTest,
  snapAngle,
  type Point,
} from "../lib/annotate/geometry";
import { badgeColor, renderDoc } from "../lib/annotate/render";
import {
  ArrowIcon,
  BoxIcon,
  CropIcon,
  CursorIcon,
  FitIcon,
  IssueIcon,
  MinusIcon,
  PipetteIcon,
  PlusIcon,
  RedactIcon,
  RedoIcon,
  RouteIcon,
  RulerIcon,
  ShareIcon,
  TypeIcon,
  UndoIcon,
} from "../lib/icons";

const PALETTE = ["#F2543D", "#2563EB", "#F5B00B", "#FFFFFF", "#0F172A"];

interface View {
  scale: number;
  tx: number;
  ty: number;
}

export default function AnnotateWindow() {
  const [docId, setDocId] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const imgDataRef = useRef<ImageData | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const nextIdRef = useRef(1);
  const [tool, setTool] = useState<Tool>("badge");
  const [color, setColor] = useState(PALETTE[0]);
  const [redactStyle, setRedactStyle] = useState<"solid" | "pixel">("solid");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [probeFirst, setProbeFirst] = useState<Point | null>(null);
  const [mouseDoc, setMouseDoc] = useState<Point | null>(null);
  const [textEntry, setTextEntry] = useState<{ docX: number; docY: number; value: string; editId?: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Remember the last classification so serial findings don't reset to
  // Contrast/major every time; focus the new badge's note to speed data entry.
  const lastTypeRef = useRef<IssueId>(ISSUE_TYPES[0].id);
  const lastSevRef = useRef<Severity>("major");
  const [focusNoteId, setFocusNoteId] = useState<number | null>(null);
  const discardTextRef = useRef(false); // Escape cancels the text entry without committing
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [panning, setPanning] = useState(false); // Space held -> grab cursor
  // Severity quick-style: one click sets the sticky severity AND the draw color.
  const [quickSev, setQuickSev] = useState<Severity>("major");
  // Crop marquee (doc coords) + whether the user is still dragging it out.
  const [cropRect, setCropRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [cropDragging, setCropDragging] = useState(false);
  // In-editor filmstrip of recent captures for one-click switching.
  const [strip, setStrip] = useState<{ id: string; modified_ms: number; issues: number }[]>([]);
  const objectUrlRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ id: number; handle: string } | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const spaceRef = useRef(false);
  const downDocRef = useRef<Point | null>(null);
  const pastRef = useRef<Shape[][]>([]);
  const futureRef = useRef<Shape[][]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- document lifecycle: load capture + restore doc, autosave ----------
  /** Load a capture into the editor, resetting all per-document state. Used on
   *  mount and when switching captures in place (filmstrip, crop). */
  function loadCapture(id: string, buf: ArrayBuffer | Uint8Array) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setDocId(null);
    setImage(null);
    setShapes([]);
    pastRef.current = [];
    futureRef.current = [];
    nextIdRef.current = 1;
    setSelectedId(null);
    setHoverId(null);
    setDraft(null);
    setProbeFirst(null);
    setTextEntry(null);
    setCropRect(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(new Blob([buf as BlobPart], { type: "image/png" }));
    objectUrlRef.current = url;
    const img = new Image();
    img.onload = async () => {
      const off = document.createElement("canvas");
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const octx = off.getContext("2d", { willReadFrequently: true })!;
      octx.drawImage(img, 0, 0);
      imgDataRef.current = octx.getImageData(0, 0, off.width, off.height);
      // Fit the view up front so the first painted frame is already centered,
      // avoiding a one-frame flash at the default 1:1 transform.
      const container = containerRef.current;
      if (container) {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight) * 0.96;
        setView({ scale: s, tx: (cw - img.naturalWidth * s) / 2, ty: (ch - img.naturalHeight * s) / 2 });
      }
      setImage(img);
      const saved = await ipc.loadAnnotationDoc(id).catch(() => null);
      const doc = (saved && parseDoc(saved)) || emptyDoc();
      nextIdRef.current = doc.nextId;
      setShapes(doc.shapes);
      // docId last: the autosave effect only runs once the real doc is in.
      setDocId(id);
    };
    img.src = url;
  }

  const refreshStrip = () => void ipc.listAnnotationDocs().then(setStrip).catch(() => {});

  /** Save the current doc immediately, then swap another capture in. */
  async function switchCapture(id: string) {
    if (id === docId || !id) return;
    try {
      if (docId) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        await ipc
          .saveAnnotationDoc(docId, JSON.stringify({ version: 1, nextId: nextIdRef.current, shapes }))
          .catch(() => {});
      }
      const buf = await ipc.captureImage(id, true);
      loadCapture(id, buf);
    } catch (e) {
      flash(String(e), true);
    }
  }

  useEffect(() => {
    void (async () => {
      const [meta, buf] = await Promise.all([ipc.annotationMeta(), ipc.annotationPng()]);
      loadCapture(meta.id, buf);
    })();
    refreshStrip();
    window.addEventListener("focus", refreshStrip);
    return () => {
      window.removeEventListener("focus", refreshStrip);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!docId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void ipc
        .saveAnnotationDoc(docId, JSON.stringify({ version: 1, nextId: nextIdRef.current, shapes }))
        .catch(() => {});
      // Persist a small annotated preview so the Captures gallery shows the
      // markup, not the bare screenshot. Best-effort — never blocks the save.
      if (image) void saveCaptureThumb(docId, image, shapes);
    }, 400);
  }, [shapes, docId, image]);

  // ---------- viewport ----------
  const fit = useCallback(() => {
    const container = containerRef.current;
    if (!container || !image) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scale = Math.min(cw / image.naturalWidth, ch / image.naturalHeight) * 0.96;
    setView({
      scale,
      tx: (cw - image.naturalWidth * scale) / 2,
      ty: (ch - image.naturalHeight * scale) / 2,
    });
  }, [image]);

  useEffect(() => {
    fit();
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fit]);

  function zoomAt(cx: number, cy: number, factor: number) {
    setView((v) => {
      const scale = Math.min(8, Math.max(0.05, v.scale * factor));
      return {
        scale,
        tx: cx - ((cx - v.tx) * scale) / v.scale,
        ty: cy - ((cy - v.ty) * scale) / v.scale,
      };
    });
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.01));
      } else {
        setView((v) => ({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY }));
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  function toDoc(e: { clientX: number; clientY: number }): Point {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - view.tx) / view.scale,
      y: (e.clientY - rect.top - view.ty) / view.scale,
    };
  }

  // ---------- history ----------
  function commit(update: (prev: Shape[]) => Shape[]) {
    setShapes((prev) => {
      pastRef.current.push(prev);
      futureRef.current = [];
      return update(prev);
    });
  }
  function undo() {
    setShapes((prev) => {
      const past = pastRef.current.pop();
      if (!past) return prev;
      futureRef.current.push(prev);
      setSelectedId(null);
      return past;
    });
  }
  function redo() {
    setShapes((prev) => {
      const future = futureRef.current.pop();
      if (!future) return prev;
      pastRef.current.push(prev);
      return future;
    });
  }

  // ---------- rendering ----------
  const badges = shapes.filter((s) => s.kind === "badge");

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !image) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.tx, dpr * view.ty);
    const all = draft ? [...shapes, draft] : shapes;
    renderDoc(ctx, image, all, {
      selectedId,
      hoverId,
      ghost:
        tool === "badge" && mouseDoc && !textEntry
          ? { kind: "badge", x: mouseDoc.x, y: mouseDoc.y, num: badges.length + 1 }
          : null,
    });
    if (probeFirst) {
      ctx.beginPath();
      ctx.arc(probeFirst.x, probeFirst.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2 / view.scale;
      ctx.stroke();
    }
    if (cropRect) {
      // Dim everything outside the marquee (even-odd fill), stroke the keep-area.
      const cx = Math.min(cropRect.x1, cropRect.x2);
      const cy = Math.min(cropRect.y1, cropRect.y2);
      const cw2 = Math.abs(cropRect.x2 - cropRect.x1);
      const ch2 = Math.abs(cropRect.y2 - cropRect.y1);
      ctx.beginPath();
      ctx.rect(0, 0, image.naturalWidth, image.naturalHeight);
      ctx.rect(cx, cy, cw2, ch2);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill("evenodd");
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5 / view.scale;
      ctx.strokeRect(cx, cy, cw2, ch2);
    }
  }, [image, shapes, draft, selectedId, hoverId, view, mouseDoc, tool, probeFirst, textEntry, badges.length, cropRect]);

  // ---------- pointer input ----------
  function sample(p: Point): { r: number; g: number; b: number } {
    const data = imgDataRef.current!;
    const x = Math.min(Math.max(Math.round(p.x), 0), data.width - 1);
    const y = Math.min(Math.max(Math.round(p.y), 0), data.height - 1);
    const i = (y * data.width + x) * 4;
    return { r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (spaceRef.current || e.button === 1) {
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const p = toDoc(e);
    downDocRef.current = p;
    const tolerance = 10 / view.scale;

    if (tool === "select") {
      const selected = shapes.find((s) => s.id === selectedId);
      if (selected) {
        const handle = handlesFor(selected).find((hd) => Math.hypot(p.x - hd.x, p.y - hd.y) <= tolerance + 4);
        if (handle) {
          pastRef.current.push(shapes);
          futureRef.current = [];
          resizeRef.current = { id: selected.id, handle: handle.key };
          return;
        }
      }
      const hit = hitTest(shapes, p, tolerance);
      setSelectedId(hit?.id ?? null);
      if (hit) {
        pastRef.current.push(shapes);
        futureRef.current = [];
        dragRef.current = { id: hit.id, dx: p.x - hit.x1, dy: p.y - hit.y1 };
      }
      return;
    }
    if (tool === "text") {
      setTextEntry({ docX: p.x, docY: p.y, value: "" });
      return;
    }
    if (tool === "badge") {
      const lastType = ISSUE_TYPES.find((t) => t.id === lastTypeRef.current) ?? ISSUE_TYPES[0];
      const shape: Shape = {
        id: nextIdRef.current++,
        kind: "badge",
        x1: p.x,
        y1: p.y,
        x2: p.x,
        y2: p.y,
        color: SEVERITY_COLORS[lastSevRef.current],
        issueType: lastType.id,
        severity: lastSevRef.current,
        note: lastType.template,
      };
      commit((prev) => [...prev, shape]);
      setSelectedId(shape.id);
      setFocusNoteId(shape.id); // jump focus to the note for immediate typing
      return;
    }
    if (tool === "focus") {
      const shape: Shape = {
        id: nextIdRef.current++,
        kind: "focus",
        x1: p.x,
        y1: p.y,
        x2: p.x,
        y2: p.y,
        color: "#2563EB",
      };
      commit((prev) => [...prev, shape]);
      return;
    }
    if (tool === "probe") {
      if (!probeFirst) {
        setProbeFirst(p);
      } else {
        const a = sample(probeFirst);
        const b = sample(p);
        const ratio = contrastRatio(a, b);
        const verdict = ratio >= 4.5 ? "✓ AA" : ratio >= 3 ? "AA large only" : "✕ fails AA";
        const shape: Shape = {
          id: nextIdRef.current++,
          kind: "probe",
          x1: probeFirst.x,
          y1: probeFirst.y,
          x2: p.x,
          y2: p.y,
          color: "#FFFFFF",
          text: `${ratio.toFixed(2)}:1 ${verdict}`,
        };
        commit((prev) => [...prev, shape]);
        // attach as evidence to the selected issue, if any
        if (selectedId !== null) {
          setShapes((prev) =>
            prev.map((s) =>
              s.id === selectedId && s.kind === "badge"
                ? { ...s, note: `${s.note ? `${s.note}\n` : ""}Measured ${ratio.toFixed(2)}:1 in capture.` }
                : s,
            ),
          );
        }
        setProbeFirst(null);
      }
      return;
    }
    if (tool === "crop") {
      setCropDragging(true);
      setCropRect({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    // drag tools: arrow / rect / redact / measure
    setDraft({
      id: nextIdRef.current++,
      kind: tool,
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
      color: tool === "redact" ? "#0F172A" : color,
      style: tool === "redact" ? redactStyle : undefined,
    });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (panRef.current) {
      const last = panRef.current;
      panRef.current = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, tx: v.tx + e.clientX - last.x, ty: v.ty + e.clientY - last.y }));
      return;
    }
    const p = toDoc(e);
    setMouseDoc(p);
    if (cropDragging && cropRect) {
      setCropRect({ ...cropRect, x2: p.x, y2: p.y });
      return;
    }
    if (resizeRef.current) {
      const { id, handle } = resizeRef.current;
      setShapes((prev) => prev.map((s) => (s.id === id ? applyHandle(s, handle, p) : s)));
      return;
    }
    if (dragRef.current) {
      const { id, dx, dy } = dragRef.current;
      setShapes((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const w = s.x2 - s.x1;
          const h = s.y2 - s.y1;
          return { ...s, x1: p.x - dx, y1: p.y - dy, x2: p.x - dx + w, y2: p.y - dy + h };
        }),
      );
      return;
    }
    if (draft) {
      let end = p;
      if (e.shiftKey) {
        if (draft.kind === "arrow") end = snapAngle({ x: draft.x1, y: draft.y1 }, p);
        else {
          const side = Math.max(Math.abs(p.x - draft.x1), Math.abs(p.y - draft.y1));
          end = { x: draft.x1 + Math.sign(p.x - draft.x1 || 1) * side, y: draft.y1 + Math.sign(p.y - draft.y1 || 1) * side };
        }
      }
      setDraft({ ...draft, x2: end.x, y2: end.y });
    }
  }

  function onMouseUp() {
    panRef.current = null;
    dragRef.current = null;
    resizeRef.current = null;
    if (cropDragging) {
      setCropDragging(false);
      // A stray click (no real drag) shouldn't leave a 0-size crop armed.
      if (cropRect && (Math.abs(cropRect.x2 - cropRect.x1) < 8 || Math.abs(cropRect.y2 - cropRect.y1) < 8)) {
        setCropRect(null);
      }
      return;
    }
    if (!draft) return;
    const moved = Math.abs(draft.x2 - draft.x1) > 5 || Math.abs(draft.y2 - draft.y1) > 5;
    if (moved) {
      const committed = draft;
      commit((prev) => [...prev, committed]);
    } else if (draft.kind === "measure" && downDocRef.current && imgDataRef.current) {
      // auto-measure: click an element, flood-fill detects its bounds
      const bounds = floodBounds(imgDataRef.current, downDocRef.current.x, downDocRef.current.y);
      if (bounds) {
        const shape: Shape = { ...draft, ...bounds };
        commit((prev) => [...prev, shape]);
      } else {
        flash("Couldn't detect an element here - drag to measure manually");
      }
    }
    setDraft(null);
  }

  function onDoubleClick(e: React.MouseEvent) {
    const p = toDoc(e);
    const hit = hitTest(shapes, p, 10 / view.scale);
    if (hit?.kind === "text") {
      setTextEntry({ docX: hit.x1, docY: hit.y1, value: hit.text ?? "", editId: hit.id });
    }
  }

  // ---------- keyboard ----------
  useEffect(() => {
    const toolKeys: Record<string, Tool> = {
      v: "select",
      i: "badge",
      a: "arrow",
      r: "rect",
      x: "redact",
      t: "text",
      m: "measure",
      p: "probe",
      o: "focus",
      c: "crop",
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (e.key === " " && !typing) {
        spaceRef.current = e.type === "keydown";
        setPanning(e.type === "keydown");
        e.preventDefault();
        return;
      }
      if (e.type !== "keydown") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        fit();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "-")) {
        e.preventDefault();
        const container = containerRef.current!;
        zoomAt(container.clientWidth / 2, container.clientHeight / 2, e.key === "=" ? 1.25 : 0.8);
        return;
      }
      if (typing) return;
      const mapped = toolKeys[e.key.toLowerCase()];
      if (mapped && !e.metaKey && !e.ctrlKey) {
        setTool(mapped);
        setProbeFirst(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId !== null) {
        commit((prev) => prev.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setProbeFirst(null);
        setCropRect(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, fit]);

  // ---------- crop ----------
  /** Crop to the marquee - NON-destructive: the cropped region becomes a new
   *  capture (annotations shifted along), and the original stays in the
   *  library. The editor switches to the new capture in place. */
  async function applyCrop() {
    if (!cropRect || !image) return;
    const x = Math.max(0, Math.round(Math.min(cropRect.x1, cropRect.x2)));
    const y = Math.max(0, Math.round(Math.min(cropRect.y1, cropRect.y2)));
    const w = Math.min(image.naturalWidth - x, Math.round(Math.abs(cropRect.x2 - cropRect.x1)));
    const h = Math.min(image.naturalHeight - y, Math.round(Math.abs(cropRect.y2 - cropRect.y1)));
    if (w < 8 || h < 8) {
      setCropRect(null);
      return;
    }
    try {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(image, -x, -y);
      const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await ipc.storeAnnotation(bytes); // registers a NEW capture id
      const meta = await ipc.annotationMeta();
      const shifted = shapes.map((s) => ({ ...s, x1: s.x1 - x, y1: s.y1 - y, x2: s.x2 - x, y2: s.y2 - y }));
      await ipc.saveAnnotationDoc(meta.id, JSON.stringify({ version: 1, nextId: nextIdRef.current, shapes: shifted }));
      loadCapture(meta.id, bytes);
      setTool("select");
      refreshStrip();
      flash("Cropped to a new capture - the original stays in your library");
    } catch (e) {
      flash(String(e), true);
    }
  }

  // ---------- exports ----------
  async function exportPng(): Promise<Uint8Array> {
    const canvas = document.createElement("canvas");
    canvas.width = image!.naturalWidth;
    canvas.height = image!.naturalHeight;
    renderDoc(canvas.getContext("2d")!, image!, shapes, { forExport: true });
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    return new Uint8Array(await blob.arrayBuffer());
  }

  /** One-page finding sheet: annotated image + issue table, branded. */
  function buildReportCanvas(): HTMLCanvasElement {
    const img = image!;
    // No findings → share the bare screenshot (plus any freehand markup), with
    // no report header/table/border. Sharing needs no annotations at all.
    if (badges.length === 0) {
      const bare = document.createElement("canvas");
      bare.width = img.naturalWidth;
      bare.height = img.naturalHeight;
      renderDoc(bare.getContext("2d")!, img, shapes, { forExport: true });
      return bare;
    }
    const W = Math.max(900, img.naturalWidth);
    const pad = 48;
    const rowH = 34;
    const headerH = 110;
    const tableH = badges.length > 0 ? 56 + badges.length * rowH : 0;
    const imgScale = (W - pad * 2) / img.naturalWidth;
    const imgH = img.naturalHeight * imgScale;
    const H = headerH + imgH + tableH + pad * 2;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0F172A";
    ctx.font = "700 30px -apple-system, system-ui, sans-serif";
    ctx.fillText("Accessibility findings", pad, 58);
    ctx.font = "400 16px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = "#64748B";
    ctx.fillText(`${new Date().toDateString()}, ${badges.length} issue${badges.length === 1 ? "" : "s"}, thewcag.com`, pad, 84);

    const annotated = document.createElement("canvas");
    annotated.width = img.naturalWidth;
    annotated.height = img.naturalHeight;
    renderDoc(annotated.getContext("2d")!, img, shapes, { forExport: true });
    ctx.drawImage(annotated, pad, headerH, W - pad * 2, imgH);
    ctx.strokeStyle = "#E2E8F0";
    ctx.strokeRect(pad, headerH, W - pad * 2, imgH);

    if (badges.length > 0) {
      let y = headerH + imgH + 44;
      ctx.font = "600 14px -apple-system, system-ui, sans-serif";
      ctx.fillStyle = "#64748B";
      ctx.fillText("#", pad, y);
      ctx.fillText("CRITERION", pad + 40, y);
      ctx.fillText("SEVERITY", pad + 280, y);
      ctx.fillText("NOTE", pad + 390, y);
      y += 10;
      badges.forEach((b, i) => {
        const type = issueTypeOf(b);
        const rowY = y + (i + 1) * rowH - 10;
        ctx.fillStyle = badgeColor(b);
        ctx.beginPath();
        ctx.arc(pad + 8, rowY - 5, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 12px -apple-system, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), pad + 8, rowY - 1);
        ctx.textAlign = "start";
        ctx.fillStyle = "#0F172A";
        ctx.font = "500 15px -apple-system, system-ui, sans-serif";
        ctx.fillText(type.sc ? `${type.sc} ${type.label}` : type.label, pad + 40, rowY);
        ctx.fillText(b.severity ?? "major", pad + 280, rowY);
        ctx.fillStyle = "#334155";
        const note = (b.note ?? "").replace(/\n/g, " ");
        ctx.fillText(note.length > 70 ? `${note.slice(0, 69)}…` : note, pad + 390, rowY, W - pad - 400);
      });
    }
    return canvas;
  }

  async function exportReport(): Promise<Uint8Array> {
    const blob: Blob = await new Promise((resolve) =>
      buildReportCanvas().toBlob((b) => resolve(b!), "image/png"),
    );
    return new Uint8Array(await blob.arrayBuffer());
  }

  // Success flashes auto-dismiss quickly; errors are shown in coral and linger
  // long enough to read and act on (never disguised as success).
  function flash(message: string, error = false) {
    setStatus(message);
    setStatusError(error);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), error ? 6000 : 2400);
  }

  function issueSummaries(): string[] {
    return badges.map((b) => {
      const type = issueTypeOf(b);
      return `${type.sc ? `[WCAG ${type.sc}] ` : ""}${type.label} (${b.severity ?? "major"}) - ${b.note?.trim() || "(no note)"}`;
    });
  }

  /** Structured findings for the Findings Register (deduped by key in Rust). */
  function registerItems() {
    return badges.map((b) => {
      const type = issueTypeOf(b);
      return {
        key: `${docId}:${b.id}`,
        source: "annotate",
        captureId: docId,
        sc: type.sc || undefined,
        label: type.label,
        severity: b.severity ?? "major",
        status: "open",
        note: (b.note ?? "").replace(/\n/g, " ").trim(),
        createdAt: Date.now(),
      };
    });
  }

  async function onSave() {
    const path = await ipc.savePng(await exportPng(), `a11y-annotated-${docId}.png`);
    if (path) {
      flash(`Saved ${path.split("/").pop()}`);
      void emit("annotate-exported", issueSummaries());
      if (badges.length) void ipc.addFindings(registerItems());
    }
  }
  async function onCopy() {
    await ipc.copyPng(await exportPng());
    flash("Image copied");
    void emit("annotate-exported", issueSummaries());
    if (badges.length) void ipc.addFindings(registerItems());
  }
  async function onReport() {
    const path = await ipc.savePng(await exportReport(), `a11y-report-${docId}.png`);
    if (path) {
      flash(`Report saved`);
      void emit("annotate-exported", issueSummaries());
      if (badges.length) void ipc.addFindings(registerItems());
    }
  }
  async function onPublish() {
    if (publishing) return;
    if (!image) {
      flash("Nothing to publish yet");
      return;
    }
    setPublishing(true);
    setStatus("Publishing…");
    setStatusError(false);
    try {
      const base64 = await canvasToBase64(scaledCanvas(buildReportCanvas(), 1400));
      const issues = badges.map((b, i) => {
        const type = issueTypeOf(b);
        return {
          n: i + 1,
          sc: type.sc || undefined,
          label: type.label,
          severity: b.severity ?? "major",
          note: (b.note ?? "").replace(/\n/g, " ").trim(),
        };
      });
      const title = badges.length
        ? `Accessibility findings (${badges.length} issue${badges.length === 1 ? "" : "s"})`
        : "Shared screenshot";
      const sevCounts = (["blocker", "major", "minor"] as const)
        .map((s) => ({ s, n: badges.filter((b) => (b.severity ?? "major") === s).length }))
        .filter((x) => x.n > 0)
        .map((x) => `${x.n} ${x.s}`)
        .join(", ");
      const scs = Array.from(new Set(badges.map((b) => issueTypeOf(b).sc).filter(Boolean)));
      const description = [
        sevCounts && `${sevCounts}.`,
        scs.length > 0 && `Criteria: ${scs.slice(0, 8).join(", ")}${scs.length > 8 ? "…" : ""}.`,
      ]
        .filter(Boolean)
        .join(" ");
      const url = await ipc.publishReport(title, description, issues, base64);
      await ipc.copyText(url);
      await ipc.openSite(url);
      flash("Published - link copied");
      void emit("annotate-exported", issueSummaries());
      if (badges.length) void ipc.addFindings(registerItems());
    } catch (e) {
      flash(String(e), true);
    } finally {
      setPublishing(false);
    }
  }
  async function onCopyMarkdown() {
    const lines = badges.map((b, i) => {
      const type = issueTypeOf(b);
      return `${i + 1}. **${type.sc ? `WCAG ${type.sc} ` : ""}${type.label}**, \`${b.severity ?? "major"}\` - ${b.note?.trim() || "(add note)"}`;
    });
    await ipc.copyText(
      ["## Accessibility issues", "", "_Annotated screenshot attached._", "", ...lines, "", "Found with [TheWCAG](https://thewcag.com) desktop."].join("\n"),
    );
    flash("Markdown copied");
  }
  async function onCopyJira() {
    const lines = badges.map((b) => {
      const type = issueTypeOf(b);
      return `# *${type.sc ? `WCAG ${type.sc} ` : ""}${type.label}* {{${b.severity ?? "major"}}} - ${b.note?.trim() || "(add note)"}`;
    });
    await ipc.copyText(
      ["h2. Accessibility issues", "", "_Annotated screenshot attached._", "", ...lines, "", "Found with [TheWCAG|https://thewcag.com] desktop."].join("\n"),
    );
    flash("Jira markup copied");
  }

  // Commit the text-tool entry (from Enter or blur) so typed text is never
  // silently lost; Escape sets discardTextRef to cancel instead.
  function commitText(entry: typeof textEntry) {
    if (entry) {
      const value = entry.value.trim();
      if (value) {
        if (entry.editId !== undefined) {
          const editId = entry.editId;
          commit((prev) => prev.map((s) => (s.id === editId ? { ...s, text: value } : s)));
        } else {
          const shape: Shape = {
            id: nextIdRef.current++,
            kind: "text",
            x1: entry.docX,
            y1: entry.docY,
            x2: 0,
            y2: 0,
            color,
            text: value,
          };
          commit((prev) => [...prev, shape]);
        }
      }
    }
    setTextEntry(null);
  }

  // The sidebar mounts once the first badge lands (and unmounts on the last),
  // changing the canvas width; refit so the image doesn't jump or clip.
  const hasBadges = badges.length > 0;
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBadges]);

  // text entry position in screen space
  const textEntryStyle = textEntry
    ? { left: textEntry.docX * view.scale + view.tx, top: textEntry.docY * view.scale + view.ty }
    : undefined;

  return (
    <div className="app-bg-solid flex h-screen flex-col font-sans text-[13px] text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="toolbar" aria-label="Annotation tools">
            {(
              [
                ["select", <CursorIcon key="i" />, "Select", "V", "Select"],
                ["badge", <IssueIcon key="i" />, "Issue", "I", "Drop issue marker"],
                ["arrow", <ArrowIcon key="i" />, "Arrow", "A", "Arrow"],
                ["rect", <BoxIcon key="i" />, "Box", "R", "Rectangle"],
                ["measure", <RulerIcon key="i" />, "24px", "M", "Measure target size"],
                ["probe", <PipetteIcon key="i" />, "Probe", "P", "Probe contrast"],
                ["focus", <RouteIcon key="i" />, "Order", "O", "Focus order"],
                ["redact", <RedactIcon key="i" />, "Redact", "X", "Redact"],
                ["text", <TypeIcon key="i" />, "Text", "T", "Text"],
                ["crop", <CropIcon key="i" />, "Crop", "C", "Crop capture"],
              ] as [Tool, ReactNode, string, string, string][]
            ).map(([t, icon, label, key, name]) => (
              <button
                key={t}
                data-active={tool === t}
                aria-pressed={tool === t}
                aria-label={`${name} (${key})`}
                onClick={() => {
                  setTool(t);
                  setProbeFirst(null);
                  if (t !== "crop") setCropRect(null);
                }}
                title={`${name} (${key})`}
              >
                {icon}
                {label && <span className="hidden lg:inline">{label}</span>}
              </button>
            ))}
          </div>
          {tool === "redact" && (
            <div className="seg">
              <button data-active={redactStyle === "solid"} onClick={() => setRedactStyle("solid")} title="Solid block - safe redaction">
                Solid
              </button>
              <button data-active={redactStyle === "pixel"} onClick={() => setRedactStyle("pixel")} title="Pixelate - cosmetic only, can be reversed on text">
                Pixel
              </button>
            </div>
          )}
          <span className="h-5 w-px bg-border" />
          {/* Severity quick styles: one click sets the sticky severity AND the
              draw color, so every new marker/shape triages at a glance. */}
          <div className="seg" role="group" aria-label="Severity quick style">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                data-active={quickSev === s}
                aria-pressed={quickSev === s}
                onClick={() => {
                  setQuickSev(s);
                  lastSevRef.current = s;
                  setColor(SEVERITY_COLORS[s]);
                }}
                title={`New issues and shapes use ${s} styling`}
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[s] }} />
                <span className="hidden capitalize xl:inline">{s}</span>
              </button>
            ))}
          </div>
          <span className="h-5 w-px bg-border" />
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-5 w-5 rounded-full border ${color === c ? "border-primary ring-2 ring-ring/40" : "border-border"}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <span className="h-5 w-px bg-border" />
          <button onClick={undo} title="Undo (⌘Z)" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <UndoIcon />
          </button>
          <button onClick={redo} title="Redo (⇧⌘Z)" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <RedoIcon />
          </button>
          <span className="h-5 w-px bg-border" />
          <button onClick={() => zoomAt(containerRef.current!.clientWidth / 2, containerRef.current!.clientHeight / 2, 0.8)} title="Zoom out (⌘-)" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <MinusIcon />
          </button>
          <span className="w-11 text-center font-mono text-[10px] text-muted-foreground">
            {Math.round(view.scale * 100)}%
          </span>
          <button onClick={() => zoomAt(containerRef.current!.clientWidth / 2, containerRef.current!.clientHeight / 2, 1.25)} title="Zoom in (⌘=)" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <PlusIcon />
          </button>
          <button onClick={fit} title="Fit to window (⌘0)" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <FitIcon />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span
            role="status"
            aria-live="polite"
            className={`mr-2 text-[11px] ${statusError ? "text-coral" : "text-ok"}`}
          >
            {status}
          </span>
          <button onClick={() => void onCopyMarkdown()} disabled={badges.length === 0} className="btn px-2.5 py-1.5 text-xs disabled:opacity-40">
            Markdown
          </button>
          <button onClick={() => void onCopyJira()} disabled={badges.length === 0} className="btn px-2.5 py-1.5 text-xs disabled:opacity-40">
            Jira
          </button>
          <button onClick={() => void onReport()} disabled={badges.length === 0} className="btn px-2.5 py-1.5 text-xs disabled:opacity-40" title="One-page finding sheet: annotated image + issue table">
            Report
          </button>
          <button
            onClick={() => void onPublish()}
            disabled={publishing}
            className="btn flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:opacity-40"
            title="Publish a shareable link on thewcag.com (requires sign-in)"
          >
            <ShareIcon size={13} />
            {publishing ? "Publishing…" : "Share"}
          </button>
          <button onClick={() => void onCopy()} className="btn px-2.5 py-1.5 text-xs">
            Copy PNG
          </button>
          <button onClick={() => void onSave()} className="btn-primary px-3 py-1.5 text-xs">
            Save…
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main
          ref={containerRef}
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{
            cursor: panning
              ? "grab"
              : tool === "text"
                ? "text"
                : tool === "select"
                  ? "default"
                  : "crosshair",
          }}
        >
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${
              image ? "opacity-100" : "opacity-0"
            }`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => setMouseDoc(null)}
            onDoubleClick={onDoubleClick}
          />
          {!image && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Loading capture…
            </div>
          )}
          {image && shapes.length === 0 && !draft && (
            <div className="fade pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
              Click to drop issue #1 (<kbd className="font-mono">I</kbd>), scroll to pan, pinch or ⌘scroll to zoom
            </div>
          )}
          {tool === "probe" && (
            <div className="fade pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
              {probeFirst
                ? selectedId !== null
                  ? "Click the second color - ratio attaches to the selected issue"
                  : "Click the second color - select an issue first to attach the ratio"
                : "Click the first color to probe contrast in this capture"}
            </div>
          )}
          {tool === "crop" && !cropRect && (
            <div className="fade pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
              Drag the area to keep - cropping creates a new capture, the original is kept
            </div>
          )}
          {cropRect && !cropDragging && (
            <div
              className="absolute z-10 flex gap-1.5"
              style={{
                left: Math.min(cropRect.x1, cropRect.x2) * view.scale + view.tx,
                top: Math.max(cropRect.y1, cropRect.y2) * view.scale + view.ty + 8,
              }}
            >
              <button onClick={() => void applyCrop()} className="btn-primary px-3 py-1.5 text-xs shadow-md">
                Crop
              </button>
              <button onClick={() => setCropRect(null)} className="btn px-3 py-1.5 text-xs shadow-md">
                Cancel
              </button>
            </div>
          )}
          {textEntry && (
            <input
              autoFocus
              value={textEntry.value}
              onChange={(e) => setTextEntry({ ...textEntry, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur(); // blur commits via onBlur
                } else if (e.key === "Escape") {
                  discardTextRef.current = true;
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => {
                if (discardTextRef.current) {
                  discardTextRef.current = false;
                  setTextEntry(null);
                  return;
                }
                commitText(textEntry);
              }}
              placeholder="Type, then Enter"
              className="absolute z-10 rounded-md border border-primary bg-card px-2 py-1 text-sm outline-none"
              style={textEntryStyle}
            />
          )}
        </main>

        {badges.length > 0 && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-card/80 p-3 backdrop-blur-xl">
            <h2 className="label mb-2">Issues ({badges.length})</h2>
            {badges.map((b, i) => {
              const type = issueTypeOf(b);
              return (
                <div
                  key={b.id}
                  role="group"
                  aria-label={`Issue ${i + 1}: ${type.label}`}
                  className={`rise mb-2 rounded-lg border p-2 ${selectedId === b.id ? "border-primary" : "border-border"}`}
                  onClick={() => setSelectedId(b.id)}
                  onFocus={() => setSelectedId(b.id)}
                  onMouseEnter={() => setHoverId(b.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: badgeColor(b) }}
                    >
                      {i + 1}
                    </span>
                    <select
                      value={b.issueType}
                      aria-label={`WCAG criterion for issue ${i + 1}`}
                      onChange={(e) => {
                        const nextType = e.target.value as IssueId;
                        lastTypeRef.current = nextType;
                        setShapes((prev) =>
                          prev.map((s) => {
                            if (s.id !== b.id) return s;
                            const oldTemplate = issueTypeOf(s).template;
                            const newTemplate = ISSUE_TYPES.find((t) => t.id === nextType)?.template ?? "";
                            const note = !s.note?.trim() || s.note === oldTemplate ? newTemplate : s.note;
                            return { ...s, issueType: nextType, note };
                          }),
                        );
                      }}
                      className="min-w-0 flex-1 rounded-md border border-border bg-card-2/70 px-1.5 py-1 text-xs outline-none"
                    >
                      {ISSUE_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.sc ? `${t.sc}, ` : ""}
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={b.severity ?? "major"}
                      aria-label={`Severity for issue ${i + 1}`}
                      onChange={(e) => {
                        const sev = e.target.value as Severity;
                        lastSevRef.current = sev;
                        setShapes((prev) => prev.map((s) => (s.id === b.id ? { ...s, severity: sev } : s)));
                      }}
                      className="rounded-md border border-border bg-card-2/70 px-1 py-1 text-[11px] outline-none"
                      style={{ color: SEVERITY_COLORS[b.severity ?? "major"] }}
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {type.sc && <p className="mb-1 text-[10px] text-muted-foreground">WCAG {type.sc} - {type.label}</p>}
                  <textarea
                    ref={(el) => {
                      if (el && b.id === focusNoteId) {
                        el.focus();
                        setFocusNoteId(null);
                      }
                    }}
                    value={b.note}
                    onChange={(e) =>
                      setShapes((prev) => prev.map((s) => (s.id === b.id ? { ...s, note: e.target.value } : s)))
                    }
                    placeholder="What's wrong here?"
                    aria-label={`Note for issue ${i + 1}`}
                    rows={Math.min(6, Math.max(2, (b.note ?? "").split("\n").length))}
                    className="w-full resize-none rounded-md border border-border bg-card-2/70 px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              );
            })}
          </aside>
        )}
      </div>

      {/* Filmstrip: every recent capture one click away, Snagit-style. */}
      {strip.length > 1 && (
        <div
          className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border bg-card/70 px-2 py-1.5"
          role="listbox"
          aria-label="Recent captures"
        >
          {strip.map((d) => (
            <button
              key={d.id}
              role="option"
              aria-selected={d.id === docId}
              onClick={() => void switchCapture(d.id)}
              className={`relative h-11 w-[72px] shrink-0 overflow-hidden rounded-md border transition-opacity ${
                d.id === docId ? "border-primary ring-1 ring-ring/50" : "border-border opacity-60 hover:opacity-100"
              }`}
              title={new Date(d.modified_ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              aria-label={`Open capture from ${new Date(d.modified_ms).toLocaleString()}`}
            >
              <StripThumb id={d.id} />
              {d.issues > 0 && (
                <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/70 px-1 text-[8px] font-semibold text-white">
                  {d.issues}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Status bar: dimensions, tool hint, findings count. */}
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card/80 px-3 py-1 font-mono text-[10px] text-muted-foreground">
        <span>{image ? `${image.naturalWidth} × ${image.naturalHeight} px` : "…"}</span>
        <span className="min-w-0 truncate font-sans">{TOOL_HINTS[tool]}</span>
        <span>
          {badges.length} issue{badges.length === 1 ? "" : "s"}
        </span>
      </footer>
    </div>
  );
}

/** One-line hints so the status bar always says what the current tool does. */
const TOOL_HINTS: Record<Tool, string> = {
  select: "Click to select - drag to move, handles to resize, Delete to remove",
  badge: "Click to drop a numbered issue marker",
  arrow: "Drag to draw an arrow - Shift snaps the angle",
  rect: "Drag to draw a box - Shift keeps it square",
  measure: "Click an element to auto-measure it, or drag - under 24px fails WCAG 2.5.8",
  probe: "Click two colors to read their contrast ratio",
  focus: "Click in sequence to map the expected focus order",
  redact: "Drag over anything sensitive - solid blocks are unrecoverable",
  text: "Click to place a text label",
  crop: "Drag the area to keep - creates a new capture, the original stays",
};

/** A capture thumbnail in the filmstrip, loaded from disk over IPC. */
function StripThumb({ id }: { id: string }) {
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
    <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
  ) : (
    <span className="block h-full w-full animate-pulse bg-muted" />
  );
}

/** Cap a canvas's width (keeps published reports small enough to upload). */
function scaledCanvas(src: HTMLCanvasElement, maxWidth: number): HTMLCanvasElement {
  if (src.width <= maxWidth) return src;
  const scale = maxWidth / src.width;
  const out = document.createElement("canvas");
  out.width = maxWidth;
  out.height = Math.round(src.height * scale);
  out.getContext("2d")!.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

function canvasToBase64(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) =>
    canvas.toBlob((b) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.readAsDataURL(b!);
    }, "image/png"),
  );
}

/** Write a small annotated preview (base image + shapes) for a capture so the
 *  Captures gallery shows the markup. Best-effort; failures are swallowed. */
async function saveCaptureThumb(id: string, image: HTMLImageElement, shapes: Shape[]): Promise<void> {
  try {
    const THUMB_W = 480;
    const scale = Math.min(1, THUMB_W / image.naturalWidth);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(image.naturalWidth * scale));
    c.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = c.getContext("2d")!;
    ctx.scale(scale, scale);
    renderDoc(ctx, image, shapes, { forExport: true });
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
    await ipc.saveCaptureThumb(id, new Uint8Array(await blob.arrayBuffer()));
  } catch {
    /* best-effort: thumbnails are cosmetic */
  }
}
