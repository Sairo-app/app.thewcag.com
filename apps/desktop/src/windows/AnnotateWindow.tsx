import { useCallback, useEffect, useRef, useState } from "react";
import { ipc } from "../lib/ipc";

type Tool = "select" | "arrow" | "rect" | "blur" | "text" | "badge";

const ISSUE_TYPES = [
  "contrast",
  "focus indicator",
  "target size",
  "alt text",
  "label",
  "keyboard",
  "other",
] as const;
type IssueType = (typeof ISSUE_TYPES)[number];

interface Shape {
  id: number;
  kind: Exclude<Tool, "select">;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  text?: string;
  issueType?: IssueType;
  note?: string;
}

const PALETTE = ["#F2543D", "#2563EB", "#F5B00B", "#FFFFFF", "#0F172A"];
const STROKE = 4;

let nextId = 1;

export default function AnnotateWindow() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>("badge");
  const [color, setColor] = useState(PALETTE[0]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [textEntry, setTextEntry] = useState<{ x: number; y: number; value: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const buf = await ipc.annotationPng();
      const url = URL.createObjectURL(new Blob([buf], { type: "image/png" }));
      const img = new Image();
      img.onload = () => setImage(img);
      img.src = url;
    })();
  }, []);

  const badges = shapes.filter((s) => s.kind === "badge");

  const render = useCallback(
    (ctx: CanvasRenderingContext2D, forExport = false) => {
      if (!image) return;
      ctx.canvas.width = image.naturalWidth;
      ctx.canvas.height = image.naturalHeight;
      ctx.drawImage(image, 0, 0);
      const all = draft ? [...shapes, draft] : shapes;
      let badgeNum = 0;
      for (const s of all) {
        const x = Math.min(s.x1, s.x2);
        const y = Math.min(s.y1, s.y2);
        const w = Math.abs(s.x2 - s.x1);
        const h = Math.abs(s.y2 - s.y1);
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = STROKE;
        switch (s.kind) {
          case "rect":
            ctx.strokeRect(x, y, w, h);
            break;
          case "blur": {
            const block = 14;
            const tiny = document.createElement("canvas");
            tiny.width = Math.max(1, Math.round(w / block));
            tiny.height = Math.max(1, Math.round(h / block));
            const tctx = tiny.getContext("2d")!;
            tctx.drawImage(image, x, y, w, h, 0, 0, tiny.width, tiny.height);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h);
            ctx.imageSmoothingEnabled = true;
            break;
          }
          case "arrow": {
            const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
            const head = 18;
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s.x2, s.y2);
            ctx.lineTo(
              s.x2 - head * Math.cos(angle - Math.PI / 6),
              s.y2 - head * Math.sin(angle - Math.PI / 6),
            );
            ctx.lineTo(
              s.x2 - head * Math.cos(angle + Math.PI / 6),
              s.y2 - head * Math.sin(angle + Math.PI / 6),
            );
            ctx.closePath();
            ctx.fill();
            break;
          }
          case "text": {
            ctx.font = "600 26px -apple-system, system-ui, sans-serif";
            ctx.lineWidth = 5;
            ctx.strokeStyle = s.color === "#FFFFFF" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
            ctx.strokeText(s.text ?? "", s.x1, s.y1);
            ctx.fillText(s.text ?? "", s.x1, s.y1);
            break;
          }
          case "badge": {
            badgeNum += 1;
            const r = 20;
            ctx.beginPath();
            ctx.arc(s.x1, s.y1, r, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#FFFFFF";
            ctx.stroke();
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "700 22px -apple-system, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(badgeNum), s.x1, s.y1 + 1);
            ctx.textAlign = "start";
            ctx.textBaseline = "alphabetic";
            break;
          }
        }
        if (!forExport && s.id === selectedId) {
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#2563EB";
          if (s.kind === "badge") ctx.strokeRect(s.x1 - 24, s.y1 - 24, 48, 48);
          else ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
          ctx.setLineDash([]);
        }
      }
    },
    [image, shapes, draft, selectedId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    render(canvas.getContext("2d")!);
  }, [render]);

  function canvasPoint(e: React.MouseEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function hitTest(x: number, y: number): Shape | null {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.kind === "badge") {
        if (Math.hypot(x - s.x1, y - s.y1) <= 26) return s;
        continue;
      }
      const pad = 10;
      const bx = Math.min(s.x1, s.x2) - pad;
      const by = Math.min(s.y1, s.y2) - pad;
      const bw = Math.abs(s.x2 - s.x1) + pad * 2;
      const bh = Math.abs(s.y2 - s.y1) + pad * 2;
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return s;
    }
    return null;
  }

  function onMouseDown(e: React.MouseEvent) {
    const p = canvasPoint(e);
    if (tool === "select") {
      const hit = hitTest(p.x, p.y);
      setSelectedId(hit?.id ?? null);
      if (hit) dragRef.current = { id: hit.id, dx: p.x - hit.x1, dy: p.y - hit.y1 };
      return;
    }
    if (tool === "text") {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTextEntry({ x: e.clientX - rect.left, y: e.clientY - rect.top, value: "" });
      return;
    }
    if (tool === "badge") {
      const shape: Shape = {
        id: nextId++,
        kind: "badge",
        x1: p.x,
        y1: p.y,
        x2: p.x,
        y2: p.y,
        color: PALETTE[0],
        issueType: "contrast",
        note: "",
      };
      setShapes((prev) => [...prev, shape]);
      setSelectedId(shape.id);
      return;
    }
    setDraft({ id: nextId++, kind: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color });
  }

  function onMouseMove(e: React.MouseEvent) {
    const p = canvasPoint(e);
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
    if (draft) setDraft({ ...draft, x2: p.x, y2: p.y });
  }

  function onMouseUp() {
    dragRef.current = null;
    if (draft) {
      if (Math.abs(draft.x2 - draft.x1) > 6 || Math.abs(draft.y2 - draft.y1) > 6) {
        setShapes((prev) => [...prev, draft]);
      }
      setDraft(null);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId !== null) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        setShapes((prev) => prev.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  async function exportPng(): Promise<Uint8Array> {
    const canvas = document.createElement("canvas");
    render(canvas.getContext("2d")!, true);
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png"),
    );
    return new Uint8Array(await blob.arrayBuffer());
  }

  function flash(message: string) {
    setStatus(message);
    setTimeout(() => setStatus(null), 2200);
  }

  async function onSave() {
    const name = `a11y-annotated-${new Date().toISOString().slice(0, 10)}.png`;
    const path = await ipc.savePng(await exportPng(), name);
    if (path) flash(`Saved ${path.split("/").pop()}`);
  }

  async function onCopy() {
    await ipc.copyPng(await exportPng());
    flash("Image copied to clipboard");
  }

  async function onCopyMarkdown() {
    const lines = badges.map(
      (b, i) => `${i + 1}. **${capitalize(b.issueType ?? "other")}** — ${b.note?.trim() || "(add note)"}`,
    );
    const md = [
      "## Accessibility issues",
      "",
      "_Annotated screenshot attached (numbers reference the list below)._",
      "",
      ...lines,
      "",
      "Found with [Accessibility.build](https://accessibility.build) desktop.",
    ].join("\n");
    await ipc.copyText(md);
    flash("Markdown copied to clipboard");
  }

  return (
    <div className="app-bg flex h-screen flex-col font-sans text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          {(
            [
              ["select", "Select"],
              ["badge", "① Issue"],
              ["arrow", "↗ Arrow"],
              ["rect", "▢ Box"],
              ["blur", "▦ Redact"],
              ["text", "T Text"],
            ] as [Tool, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                tool === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="mx-2 h-5 w-px bg-border" />
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-5 w-5 rounded-full border ${
                color === c ? "border-primary ring-2 ring-ring/40" : "border-border"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {status && <span className="rise mr-2 text-[11px] text-ok">{status}</span>}
          <button
            onClick={() => void onCopyMarkdown()}
            disabled={badges.length === 0}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
            title="Copy a GitHub-ready issue list"
          >
            Copy Markdown
          </button>
          <button
            onClick={() => void onCopy()}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            Copy PNG
          </button>
          <button
            onClick={() => void onSave()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Save…
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 items-center justify-center overflow-auto p-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              className="max-h-[calc(100vh-120px)] max-w-full rounded-lg border border-border shadow-xl"
              style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            />
            {textEntry && (
              <input
                autoFocus
                value={textEntry.value}
                onChange={(e) => setTextEntry({ ...textEntry, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && textEntry.value.trim()) {
                    const canvas = canvasRef.current!;
                    const rect = canvas.getBoundingClientRect();
                    setShapes((prev) => [
                      ...prev,
                      {
                        id: nextId++,
                        kind: "text",
                        x1: (textEntry.x / rect.width) * canvas.width,
                        y1: (textEntry.y / rect.height) * canvas.height,
                        x2: 0,
                        y2: 0,
                        color,
                        text: textEntry.value.trim(),
                      },
                    ]);
                    setTextEntry(null);
                  }
                  if (e.key === "Escape") setTextEntry(null);
                }}
                onBlur={() => setTextEntry(null)}
                placeholder="Type, then Enter"
                className="absolute z-10 rounded border border-primary bg-card px-2 py-1 text-sm outline-none"
                style={{ left: textEntry.x, top: textEntry.y }}
              />
            )}
          </div>
        </main>

        {badges.length > 0 && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card p-3">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Issues ({badges.length})
            </h2>
            {badges.map((b, i) => (
              <div
                key={b.id}
                className={`mb-2 rounded-lg border p-2 ${
                  selectedId === b.id ? "border-primary" : "border-border"
                }`}
                onClick={() => setSelectedId(b.id)}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: b.color }}
                  >
                    {i + 1}
                  </span>
                  <select
                    value={b.issueType}
                    onChange={(e) =>
                      setShapes((prev) =>
                        prev.map((s) =>
                          s.id === b.id ? { ...s, issueType: e.target.value as IssueType } : s,
                        ),
                      )
                    }
                    className="flex-1 rounded-md border border-border bg-card-2 px-1.5 py-1 text-xs outline-none"
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {capitalize(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={b.note}
                  onChange={(e) =>
                    setShapes((prev) =>
                      prev.map((s) => (s.id === b.id ? { ...s, note: e.target.value } : s)),
                    )
                  }
                  placeholder="What's wrong here?"
                  rows={2}
                  className="w-full resize-none rounded-md border border-border bg-card-2 px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
