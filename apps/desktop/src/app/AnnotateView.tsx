import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { contrastRatio, rgbToHex } from "@accessibility-build/a11y-core";
import {
  compactFindingId,
  createFindingId,
} from "@accessibility-build/audit-contracts";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUUpLeft,
  ArrowUUpRight,
  Clipboard,
  Crop,
  Cursor,
  DownloadSimple,
  Eye,
  FloppyDisk,
  FrameCorners,
  HighlighterCircle,
  NotePencil,
  Ruler,
  Selection,
  ShareNetwork,
  TextT,
  Trash,
  X,
} from "./Icon";
import type { IconComponent } from "./Icon";
import type { CaptureEntry, Finding, Point } from "../shared/desktop";
import { desktop, listCaptures } from "./api";
import { Button, Field, StatusBadge, Toast } from "./components";
import { messageFromError, useTransientMessage } from "./hooks";
import { PanelResizer } from "./ResizablePanel";
import { usePersistedPanelSize } from "./usePersistedPanelSize";
import { hitTest } from "../lib/annotate/geometry";
import {
  emptyDoc,
  ISSUE_TYPES,
  parseDoc,
  SEVERITIES,
  SEVERITY_COLORS,
  type AnnotationDoc,
  type IssueId,
  type Shape,
  type Tool,
} from "../lib/annotate/model";
import { renderDoc } from "../lib/annotate/render";
import { canvasPngDataUrl, requireCanvas2d } from "../lib/annotate/canvas";
import { appendUndoSnapshot } from "../lib/annotate/history";

const TOOLS: {
  id: Tool;
  label: string;
  icon: IconComponent;
}[] = [
  { id: "select", label: "Select", icon: Cursor },
  { id: "crop", label: "Crop", icon: Crop },
  { id: "badge", label: "Issue badge", icon: HighlighterCircle },
  { id: "arrow", label: "Arrow", icon: ArrowDownRight },
  { id: "rect", label: "Rectangle", icon: Selection },
  { id: "measure", label: "Measure", icon: Ruler },
  { id: "probe", label: "Contrast probe", icon: Eye },
  { id: "focus", label: "Focus order", icon: FrameCorners },
  { id: "text", label: "Text", icon: TextT },
  { id: "redact", label: "Redact", icon: X },
];

interface Drag {
  start: Point;
  shape?: Shape;
}
const DRAW_TOOLS = new Set<Tool>([
  "arrow",
  "rect",
  "measure",
  "probe",
  "redact",
]);

export function AnnotateView() {
  const id = new URLSearchParams(location.search).get("capture") || "";
  const [capture, setCapture] = useState<CaptureEntry | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [doc, setDoc] = useState<AnnotationDoc>(emptyDoc());
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [undo, setUndo] = useState<AnnotationDoc[]>([]);
  const [redo, setRedo] = useState<AnnotationDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"copy" | "export" | "copy-markdown" | "export-markdown" | null>(null);
  const [retryAction, setRetryAction] = useState<
    "copy" | "export" | "copy-markdown" | "export-markdown" | "save" | null
  >(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const flushSaveRef = useRef<() => Promise<boolean>>(async () => false);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const textEditRef = useRef<{ key: string; timer: number } | null>(null);
  const [message, show, clearMessage] = useTransientMessage(6000);
  const toolsSize = usePersistedPanelSize(
    "layout-annotation-tools-width-v1",
    82,
    72,
    150,
  );
  const inspectorSize = usePersistedPanelSize(
    "layout-annotation-inspector-width-v1",
    280,
    240,
    420,
  );

  useEffect(() => {
    void Promise.all([
      listCaptures(),
      desktop.invoke<string | null>("capture:read-document", { id }),
    ])
      .then(([entries, raw]) => {
        const entry = entries.find((item) => item.id === id);
        if (!entry) throw new Error("Capture not found");
        setCapture(entry);
        setDoc(parseDoc(raw || "") || emptyDoc());
        const next = new Image();
        next.crossOrigin = "anonymous";
        next.onload = () => {
          try {
            const base = document.createElement("canvas");
            base.width = next.naturalWidth;
            base.height = next.naturalHeight;
            requireCanvas2d(base, { willReadFrequently: true }).drawImage(next, 0, 0);
            baseRef.current = base;
            setImage(next);
            setLoaded(true);
          } catch (error) {
            show(messageFromError(error), true, "Capture cannot be annotated");
          }
        };
        next.onerror = () =>
          show(
            "The capture image could not be opened. Close this window and try the capture again.",
            true,
            "Capture unavailable",
          );
        next.src = entry.assetUrl;
      })
      .catch((error) =>
        show(messageFromError(error), true, "Capture unavailable"),
      );
  }, [id]);

  useEffect(() => {
    try {
      draw();
    } catch (error) {
      show(messageFromError(error), true, "Capture cannot be rendered");
    }
  }, [image, doc, draft, selected]);
  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => void save(false), 600);
    return () => clearTimeout(timer);
  }, [doc, loaded]);
  useEffect(
    () => () => {
      if (textEditRef.current) clearTimeout(textEditRef.current.timer);
    },
    [],
  );
  useEffect(() => desktop.on<{ token: string }>("annotate:flush", ({ token }) => {
    const body = document.body;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    body.inert = true;
    void flushSaveRef.current().then(async (ok) => {
      const accepted = await desktop.invoke<boolean>("annotate:flush-complete", {
        token,
        ok,
        message: ok ? undefined : "The open annotation could not be saved; its window was kept open",
      });
      if (!ok || !accepted) body.inert = false;
    }).catch((error) => {
      body.inert = false;
      show(messageFromError(error), true, "Save acknowledgement failed");
    });
  }), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const editable = ["INPUT", "TEXTAREA", "SELECT"].includes(
        (event.target as HTMLElement)?.tagName,
      );
      if (
        !editable &&
        (event.key === "Backspace" || event.key === "Delete") &&
        selected
      ) {
        event.preventDefault();
        removeSelected();
      }
      if (
        !editable &&
        selected &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx =
          event.key === "ArrowLeft"
            ? -step
            : event.key === "ArrowRight"
              ? step
              : 0;
        const dy =
          event.key === "ArrowUp"
            ? -step
            : event.key === "ArrowDown"
              ? step
              : 0;
        const shape = doc.shapes.find((item) => item.id === selected);
        if (shape)
          updateSelected({
            x1: shape.x1 + dx,
            y1: shape.y1 + dy,
            x2: shape.x2 + dx,
            y2: shape.y2 + dy,
          });
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoOnce();
        else undoOnce();
      }
      if (event.key === "Escape") {
        setDraft(null);
        setSelected(null);
        setTool("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, undo, redo, doc]);

  function draw(
    forExport = false,
    documentToDraw: AnnotationDoc = doc,
  ): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas || !image) return null;
    if (
      canvas.width !== image.naturalWidth ||
      canvas.height !== image.naturalHeight
    ) {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
    }
    const ctx = requireCanvas2d(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shapes = !forExport && draft
      ? [...documentToDraw.shapes, draft]
      : documentToDraw.shapes;
    renderDoc(ctx, image, shapes, {
      selectedId: forExport ? null : selected,
      forExport,
    });
    return canvas;
  }
  function point(event: ReactPointerEvent): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = image?.naturalWidth || 1;
    const height = image?.naturalHeight || 1;
    return {
      x: Math.max(
        0,
        Math.min(width - 1, ((event.clientX - rect.left) / Math.max(rect.width, 1)) * width),
      ),
      y: Math.max(
        0,
        Math.min(height - 1, ((event.clientY - rect.top) / Math.max(rect.height, 1)) * height),
      ),
    };
  }
  function finishTextEdit() {
    if (textEditRef.current) clearTimeout(textEditRef.current.timer);
    textEditRef.current = null;
  }
  function commit(next: AnnotationDoc, textEditKey?: string) {
    const continuingTextEdit = Boolean(
      textEditKey && textEditRef.current?.key === textEditKey,
    );
    setUndo((items) =>
      appendUndoSnapshot(items, doc, continuingTextEdit),
    );
    setRedo([]);
    setDoc(next);
    if (!textEditKey) {
      finishTextEdit();
      return;
    }
    if (textEditRef.current) clearTimeout(textEditRef.current.timer);
    textEditRef.current = {
      key: textEditKey,
      timer: window.setTimeout(() => {
        textEditRef.current = null;
      }, 600),
    };
  }
  function addShape(shape: Omit<Shape, "id">) {
    const next = { ...shape, id: doc.nextId };
    commit({ ...doc, nextId: doc.nextId + 1, shapes: [...doc.shapes, next] });
    setSelected(next.id);
    return next;
  }
  function updateSelected(patch: Partial<Shape>, textField?: "text" | "note") {
    if (!selected) return;
    commit({
      ...doc,
      shapes: doc.shapes.map((shape) =>
        shape.id === selected ? { ...shape, ...patch } : shape,
      ),
    }, textField ? `${selected}:${textField}` : undefined);
  }
  function removeSelected() {
    if (!selected) return;
    commit({
      ...doc,
      shapes: doc.shapes.filter((shape) => shape.id !== selected),
    });
    setSelected(null);
  }
  function undoOnce() {
    finishTextEdit();
    const prior = undo.at(-1);
    if (!prior) return;
    setRedo((items) => [...items, doc]);
    setDoc(prior);
    setUndo((items) => items.slice(0, -1));
  }
  function redoOnce() {
    finishTextEdit();
    const next = redo.at(-1);
    if (!next) return;
    setUndo((items) => [...items, doc]);
    setDoc(next);
    setRedo((items) => items.slice(0, -1));
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!image || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    if (tool === "select") {
      const hit = hitTest(
        doc.shapes,
        p,
        (12 * image.naturalWidth) /
          event.currentTarget.getBoundingClientRect().width,
      );
      setSelected(hit?.id || null);
      setDrag(hit ? { start: p, shape: { ...hit } } : null);
      return;
    }
    if (tool === "badge") {
      const createdAt = Date.now();
      addShape({
        kind: "badge",
        x1: p.x,
        y1: p.y,
        x2: p.x,
        y2: p.y,
        color: SEVERITY_COLORS.major,
        severity: "major",
        issueType: "contrast",
        note: ISSUE_TYPES[0].template,
        findingId: createFindingId(createdAt),
      });
      return;
    }
    if (tool === "focus") {
      addShape({
        kind: "focus",
        x1: p.x,
        y1: p.y,
        x2: p.x,
        y2: p.y,
        color: "#3157A4",
      });
      return;
    }
    if (tool === "text") {
      addShape({
        kind: "text",
        x1: p.x,
        y1: p.y,
        x2: p.x,
        y2: p.y,
        color: "#D9480F",
        text: "Note",
      });
      return;
    }
    setDrag({ start: p });
    if (DRAW_TOOLS.has(tool))
      setDraft({
        id: -1,
        kind: tool as Shape["kind"],
        x1: p.x,
        y1: p.y,
        x2: p.x,
        y2: p.y,
        color:
          tool === "measure"
            ? "#3157A4"
            : tool === "redact"
              ? "#1F2933"
              : "#D9480F",
        style: tool === "redact" ? "solid" : undefined,
      });
  }
  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drag) return;
    const p = point(event);
    if (tool === "select" && drag.shape) {
      const dx = p.x - drag.start.x,
        dy = p.y - drag.start.y;
      setDoc((current) => ({
        ...current,
        shapes: current.shapes.map((shape) =>
          shape.id === drag.shape!.id
            ? {
                ...drag.shape!,
                x1: drag.shape!.x1 + dx,
                y1: drag.shape!.y1 + dy,
                x2: drag.shape!.x2 + dx,
                y2: drag.shape!.y2 + dy,
              }
            : shape,
        ),
      }));
      return;
    }
    if (draft) setDraft({ ...draft, x2: p.x, y2: p.y });
  }
  async function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const end = point(event);
    if (tool === "select" && drag.shape) {
      setUndo((items) => [
        ...items.slice(-39),
        {
          ...doc,
          shapes: doc.shapes.map((shape) =>
            shape.id === drag.shape!.id ? drag.shape! : shape,
          ),
        },
      ]);
      setRedo([]);
      setDrag(null);
      return;
    }
    if (tool === "crop" && baseRef.current) {
      const x = Math.round(Math.min(drag.start.x, end.x)),
        y = Math.round(Math.min(drag.start.y, end.y)),
        width = Math.round(Math.abs(end.x - drag.start.x)),
        height = Math.round(Math.abs(end.y - drag.start.y));
      if (width > 10 && height > 10) {
        const saved = await save(false);
        if (!saved) {
          setDrag(null);
          return;
        }
        try {
          const crop = document.createElement("canvas");
          crop.width = width;
          crop.height = height;
          requireCanvas2d(crop).drawImage(
            baseRef.current,
            x,
            y,
            width,
            height,
            0,
            0,
            width,
            height,
          );
          const cropped = await desktop.invoke<CaptureEntry>("capture:create", {
            pngDataUrl: canvasPngDataUrl(crop),
            title: `${capture?.title || "Capture"} crop`,
            auditId: capture?.auditId,
            silent: true,
          });
          await desktop.invoke("capture:open", { id: cropped.id });
        } catch (error) {
          show(messageFromError(error), true, "Crop could not be created");
        }
      }
      setDrag(null);
      return;
    }
    if (draft) {
      const next = { ...draft, id: doc.nextId, x2: end.x, y2: end.y };
      if (Math.hypot(next.x2 - next.x1, next.y2 - next.y1) > 3) {
        if (next.kind === "probe" && baseRef.current) {
          const ctx = requireCanvas2d(baseRef.current, {
              willReadFrequently: true,
            }),
            a = ctx.getImageData(
              Math.round(next.x1),
              Math.round(next.y1),
              1,
              1,
            ).data,
            b = ctx.getImageData(
              Math.round(next.x2),
              Math.round(next.y2),
              1,
              1,
            ).data,
            ratio = contrastRatio(
              { r: a[0], g: a[1], b: a[2] },
              { r: b[0], g: b[1], b: b[2] },
            );
          next.text = `${ratio >= 4.5 ? "✓" : "✕"} ${ratio.toFixed(2)}:1`;
          next.note = `${rgbToHex({ r: a[0], g: a[1], b: a[2] })} on ${rgbToHex({ r: b[0], g: b[1], b: b[2] })}`;
        }
        commit({
          ...doc,
          nextId: doc.nextId + 1,
          shapes: [...doc.shapes, next],
        });
        setSelected(next.id);
      }
      setDraft(null);
    }
    setDrag(null);
  }

  function save(notify = true): Promise<boolean> {
    const snapshot = doc;
    const persist = () => persistDocument(snapshot, notify);
    const queued = saveQueueRef.current.then(persist, persist);
    saveQueueRef.current = queued;
    return queued;
  }

  async function persistDocument(
    snapshot: AnnotationDoc,
    notify: boolean,
  ): Promise<boolean> {
    if (!id) return false;
    setSaving(true);
    try {
      await desktop.invoke("capture:save-document", {
        id,
        json: JSON.stringify(snapshot),
      });
      const canvas = draw(true, snapshot);
      if (canvas) {
        const thumb = document.createElement("canvas"),
          scale = Math.min(1, 480 / canvas.width);
        thumb.width = Math.max(1, Math.round(canvas.width * scale));
        thumb.height = Math.max(1, Math.round(canvas.height * scale));
        requireCanvas2d(thumb).drawImage(canvas, 0, 0, thumb.width, thumb.height);
        await desktop.invoke("capture:save-thumbnail", {
          id,
          pngDataUrl: canvasPngDataUrl(thumb),
        });
        draw(false);
      }
      if (notify) show("Capture saved");
      setRetryAction(null);
      return true;
    } catch (error) {
      setRetryAction("save");
      show(
        messageFromError(
          error,
          "Your annotations could not be saved. Your current work is still open.",
        ),
        true,
        "Save incomplete",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }
  flushSaveRef.current = () => save(false);
  async function exportPng(copy = false) {
    if (exporting) return;
    setExporting(copy ? "copy" : "export");
    try {
      const canvas = draw(true);
      if (!canvas) throw new Error("The capture is not ready yet");
      const pngDataUrl = canvasPngDataUrl(canvas);
      if (copy) {
        await desktop.invoke("clipboard:write-image", { pngDataUrl });
        show("Annotated capture copied");
      } else {
        const path = await desktop.invoke<string | null>("dialog:save-image", {
          name: `${capture?.title || "annotated-capture"}.png`,
          pngDataUrl,
        });
        if (path) show("Annotated PNG exported");
      }
      setRetryAction(null);
    } catch (error) {
      setRetryAction(copy ? "copy" : "export");
      show(
        messageFromError(
          error,
          copy
            ? "The annotated capture could not be copied. Try again."
            : "The annotated capture could not be exported. Try again.",
        ),
        true,
        copy ? "Copy failed" : "Export failed",
      );
    } finally {
      draw(false);
      setExporting(null);
    }
  }
  function captureMarkdown(): string {
    const title = capture?.title || "Annotated capture";
    const annotations = doc.shapes.map((shape, index) => {
      const issue = shape.kind === "badge"
        ? ISSUE_TYPES.find((item) => item.id === shape.issueType)
        : undefined;
      const label = issue?.label || TOOLS.find((item) => item.id === shape.kind)?.label || shape.kind;
      const details = [
        shape.severity,
        issue?.sc ? `WCAG ${issue.sc}` : "",
        shape.note || shape.text,
      ].filter(Boolean).join(" · ");
      return `${index + 1}. **${label}**${details ? ` — ${details}` : ""}`;
    });
    return [
      `# ${title.replace(/[\r\n#]+/g, " ").trim()}`,
      "",
      `- Captured: ${capture ? new Date(capture.createdAt).toISOString() : "Unknown"}`,
      `- Dimensions: ${capture ? `${capture.width} × ${capture.height}` : "Unknown"}`,
      `- Annotations: ${doc.shapes.length}`,
      "",
      "## Annotations",
      "",
      ...(annotations.length ? annotations : ["No annotations recorded."]),
      "",
    ].join("\n");
  }
  async function exportMarkdown(copy = false) {
    if (exporting) return;
    const action = copy ? "copy-markdown" : "export-markdown";
    setExporting(action);
    try {
      const text = captureMarkdown();
      if (copy) {
        await desktop.invoke("clipboard:write-text", { text });
        show("Annotation Markdown copied");
      } else {
        const path = await desktop.invoke<string | null>("dialog:save-text", {
          name: `${capture?.title || "annotated-capture"}.md`,
          text,
        });
        if (path) show("Annotation Markdown exported");
      }
      setRetryAction(null);
    } catch (error) {
      setRetryAction(action);
      show(messageFromError(error, "The annotation Markdown could not be exported. Try again."), true);
    } finally {
      setExporting(null);
    }
  }
  function retryLastAction() {
    const action = retryAction;
    setRetryAction(null);
    clearMessage();
    if (action === "save") void save();
    if (action === "copy" || action === "export") {
      void exportPng(action === "copy");
    }
    if (action === "copy-markdown" || action === "export-markdown") {
      void exportMarkdown(action === "copy-markdown");
    }
  }
  async function addFindings() {
    const badges = doc.shapes.filter((shape) => shape.kind === "badge");
    if (!badges.length) {
      show("Add at least one issue marker before creating findings.", true);
      return;
    }
    const items: Finding[] = badges.map((shape, index) => {
      const issue =
        ISSUE_TYPES.find((item) => item.id === shape.issueType) ||
        ISSUE_TYPES.at(-1)!;
      return {
        id: shape.findingId || createFindingId(),
        key: `${id}-${shape.id}`,
        title: shape.note?.split(".")[0] || `${issue.label} issue ${index + 1}`,
        wcag: issue.sc || "Needs review",
        severity: shape.severity || "major",
        status: "open",
        note: shape.note || issue.template,
        evidenceCaptureIds: [id],
        captureId: id,
        createdAt: Date.now(),
      };
    });
    try {
      const saved = await desktop.invoke<Finding[]>("store:add-findings", {
        items,
        auditId: capture?.auditId,
      });
      const identities = new Map(saved.map((finding) => [finding.key, finding.id]));
      const nextDocument: AnnotationDoc = {
        ...doc,
        shapes: doc.shapes.map((shape) => {
          if (shape.kind !== "badge") return shape;
          const findingId = identities.get(`${id}-${shape.id}`);
          return findingId && findingId !== shape.findingId
            ? { ...shape, findingId }
            : shape;
        }),
      };
      if (nextDocument.shapes.some((shape, index) => shape !== doc.shapes[index])) {
        setDoc(nextDocument);
        await desktop.invoke("capture:save-document", {
          id,
          json: JSON.stringify(nextDocument),
        });
      }
      show(
        `${items.length} finding${items.length === 1 ? "" : "s"} added to the audit`,
      );
    } catch (error) {
      show(messageFromError(error), true);
    }
  }
  async function reviewReport() {
    await save(false);
    await desktop.invoke("workspace:navigate", {
      tool: capture?.auditId ? "share" : "screenshot",
      captureId: capture?.auditId ? undefined : id,
    });
  }

  const selectedShape = useMemo(
    () => doc.shapes.find((shape) => shape.id === selected) || null,
    [doc, selected],
  );
  return (
    <div className="annotate-window">
      <Toast
        message={message}
        actionLabel={retryAction ? "Try again" : undefined}
        onAction={retryAction ? retryLastAction : undefined}
        onClose={() => {
          setRetryAction(null);
          clearMessage();
        }}
      />
      <header className="annotate-titlebar">
        <div className="annotate-drag">
          <button
            aria-label="Close annotation"
            onClick={() => void desktop.invoke("window:close")
              .catch((error) => show(messageFromError(error, "The annotation window could not be closed."), true))}
          >
            <ArrowLeft size={20} />
          </button>
          <span>
            <strong>{capture?.title || "Annotation workspace"}</strong>
            <small>
              {capture
                ? `${capture.width} × ${capture.height}`
                : "Loading capture"}
            </small>
          </span>
        </div>
        <div className="history-actions">
          <button disabled={!undo.length} onClick={undoOnce} aria-label="Undo">
            <ArrowUUpLeft size={20} />
          </button>
          <button disabled={!redo.length} onClick={redoOnce} aria-label="Redo">
            <ArrowUUpRight size={20} />
          </button>
        </div>
        <div className="annotate-actions">
          <span data-saving={saving}>
            {saving ? "Saving changes" : "All changes saved"}
          </span>
          <Button
            icon={Clipboard}
            disabled={saving || Boolean(exporting)}
            onClick={() => void exportPng(true)}
          >
            {exporting === "copy" ? "Copying" : "Copy"}
          </Button>
          <Button
            icon={DownloadSimple}
            disabled={saving || Boolean(exporting)}
            onClick={() => void exportPng(false)}
          >
            {exporting === "export" ? "Exporting" : "Export"}
          </Button>
          <Button
            icon={Clipboard}
            disabled={saving || Boolean(exporting)}
            onClick={() => void exportMarkdown(true)}
          >
            {exporting === "copy-markdown" ? "Copying" : "Copy Markdown"}
          </Button>
          <Button
            icon={DownloadSimple}
            disabled={saving || Boolean(exporting)}
            onClick={() => void exportMarkdown(false)}
          >
            {exporting === "export-markdown" ? "Exporting" : "Export Markdown"}
          </Button>
          <Button
            variant="primary"
            icon={FloppyDisk}
            disabled={saving || Boolean(exporting)}
            onClick={() => void save()}
          >
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </header>
      <div
        className="annotate-body"
        style={
          {
            "--annotation-tools-width": `${toolsSize.size}px`,
            "--annotation-inspector-width": `${inspectorSize.size}px`,
          } as CSSProperties
        }
      >
        <aside className="annotation-tools" aria-label="Annotation tools">
          {TOOLS.map(({ id: value, label, icon: Icon }) => (
            <button
              key={value}
              data-active={tool === value}
              aria-pressed={tool === value}
              aria-label={label}
              title={label}
              onClick={() => {
                setTool(value);
                setSelected(null);
              }}
            >
              <Icon size={20} weight={tool === value ? "fill" : "regular"} />
              <span>{label}</span>
            </button>
          ))}
        </aside>
        <PanelResizer
          className="annotation-tools-resizer"
          label="Resize annotation tools"
          side="right"
          size={toolsSize.size}
          min={72}
          max={150}
          initial={82}
          onSize={toolsSize.setSize}
          onCommit={toolsSize.commit}
        />
        <main className="canvas-stage">
          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              tabIndex={0}
              role="img"
              aria-label={`Annotation canvas with ${doc.shapes.length} annotations. Select an annotation from the list or use arrow keys to move the selected annotation.`}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={(event) => void pointerUp(event).catch((error) => {
                setDrag(null);
                show(messageFromError(error), true);
              })}
              onPointerCancel={() => setDrag(null)}
              data-tool={tool}
            />
          </div>
          <div className="canvas-status" role="status" aria-live="polite">
            <span>
              {tool === "select"
                ? "Select or move annotations"
                : TOOLS.find((item) => item.id === tool)?.label}
            </span>
            <span>
              {doc.shapes.length} annotations ·{" "}
              {doc.shapes.filter((shape) => shape.kind === "badge").length}{" "}
              issues
            </span>
          </div>
        </main>
        <PanelResizer
          className="annotation-inspector-resizer"
          label="Resize annotation properties"
          side="left"
          size={inspectorSize.size}
          min={240}
          max={420}
          initial={280}
          onSize={inspectorSize.setSize}
          onCommit={inspectorSize.commit}
        />
        <aside
          className="annotation-inspector"
          aria-label="Annotation properties"
        >
          <div className="inspector-heading">
            <span>{selectedShape ? "Annotation" : "Capture details"}</span>
          </div>
          {selectedShape ? (
            <div className="shape-editor">
              <div className="shape-kind">
                <span className="shape-icon">
                  <NotePencil size={20} />
                </span>
                <div>
                  <strong>
                    {TOOLS.find((item) => item.id === selectedShape.kind)
                      ?.label || selectedShape.kind}
                  </strong>
                  <small>Annotation {selectedShape.id}</small>
                </div>
                <button aria-label="Delete annotation" onClick={removeSelected}>
                  <Trash size={20} />
                </button>
              </div>
              {selectedShape.kind === "badge" ? (
                <>
                  <div className="finding-identity-card">
                    <span>Finding ID</span>
                    <code title={selectedShape.findingId}>
                      {selectedShape.findingId
                        ? compactFindingId(selectedShape.findingId)
                        : "Allocating identity"}
                    </code>
                    <button
                      type="button"
                      aria-label="Copy finding ID"
                      disabled={!selectedShape.findingId}
                      onClick={() => {
                        if (selectedShape.findingId) {
                          void desktop.invoke("clipboard:write-text", { text: selectedShape.findingId })
                            .then(() => show("Finding ID copied"))
                            .catch((error) => show(messageFromError(error, "The finding ID could not be copied."), true));
                        }
                      }}
                    >
                      <Clipboard size={20} />
                    </button>
                  </div>
                  <Field label="Issue type">
                    <select
                      value={selectedShape.issueType || "other"}
                      onChange={(event) => {
                        const issue = ISSUE_TYPES.find(
                          (item) => item.id === (event.target.value as IssueId),
                        )!;
                        updateSelected({
                          issueType: issue.id,
                          note: selectedShape.note || issue.template,
                        });
                      }}
                    >
                      {ISSUE_TYPES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                          {item.sc ? ` · ${item.sc}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Severity">
                    <div className="severity-options">
                      {SEVERITIES.map((severity) => (
                        <button
                          key={severity}
                          data-active={selectedShape.severity === severity}
                          aria-pressed={selectedShape.severity === severity}
                          onClick={() =>
                            updateSelected({
                              severity,
                              color: SEVERITY_COLORS[severity],
                            })
                          }
                        >
                          <i
                            style={{
                              backgroundColor: SEVERITY_COLORS[severity],
                            }}
                          />
                          {severity}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              ) : null}
              {selectedShape.kind === "text" ? (
                <Field label="Text">
                  <input
                    value={selectedShape.text || ""}
                    onChange={(event) =>
                      updateSelected({ text: event.target.value }, "text")
                    }
                    onBlur={finishTextEdit}
                  />
                </Field>
              ) : null}
              {selectedShape.kind !== "badge" &&
              selectedShape.kind !== "redact" ? (
                <Field label="Color">
                  <input
                    type="color"
                    value={selectedShape.color}
                    onChange={(event) =>
                      updateSelected({ color: event.target.value })
                    }
                  />
                </Field>
              ) : null}
              {selectedShape.kind === "redact" ? (
                <Field label="Redaction">
                  <select
                    value={selectedShape.style || "solid"}
                    onChange={(event) =>
                      updateSelected({
                        style: event.target.value as "solid" | "pixel",
                      })
                    }
                  >
                    <option value="solid">Solid, secure</option>
                    <option value="pixel">Pixelated</option>
                  </select>
                </Field>
              ) : null}
              <Field label="Implementation note">
                <textarea
                  value={selectedShape.note || ""}
                  onChange={(event) =>
                    updateSelected({ note: event.target.value }, "note")
                  }
                  onBlur={finishTextEdit}
                  placeholder="Describe the problem and recommended fix."
                />
              </Field>
            </div>
          ) : (
            <div className="capture-inspector">
              <div className="capture-preview">
                {capture ? <img src={capture.assetUrl} alt="" /> : null}
              </div>
              <dl>
                <div>
                  <dt>Dimensions</dt>
                  <dd>
                    {capture
                      ? `${capture.width} × ${capture.height}`
                      : "Not available"}
                  </dd>
                </div>
                <div>
                  <dt>Issues</dt>
                  <dd>
                    {
                      doc.shapes.filter((shape) => shape.kind === "badge")
                        .length
                    }
                  </dd>
                </div>
                <div>
                  <dt>Storage</dt>
                  <dd>
                    <StatusBadge tone="success">Local</StatusBadge>
                  </dd>
                </div>
              </dl>
              <p>
                {capture?.auditId
                  ? "Select an annotation to edit its details. Issue badges become structured audit findings."
                  : "Select an annotation to edit its details. Issue badges and notes are included when you share this screenshot."}
              </p>
              {doc.shapes.length ? (
                <div
                  className="annotation-list"
                  aria-label="Annotations in this capture"
                >
                  <strong>Annotations</strong>
                  {doc.shapes.map((shape) => (
                    <button
                      key={shape.id}
                      onClick={() => {
                        setSelected(shape.id);
                        setTool("select");
                      }}
                    >
                      <span>
                        {TOOLS.find((item) => item.id === shape.kind)?.label ||
                          shape.kind}
                      </span>
                      <small>Annotation {shape.id}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          <div className="inspector-footer">
            {capture?.auditId ? (
              <Button
                variant="primary"
                disabled={!doc.shapes.some((shape) => shape.kind === "badge")}
                onClick={() => void addFindings()}
              >
                Add issues to audit
              </Button>
            ) : null}
            <Button
              variant={capture?.auditId ? "secondary" : "primary"}
              icon={ShareNetwork}
              onClick={() => void reviewReport()}
            >
              {capture?.auditId ? "Review report" : "Share screenshot"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
