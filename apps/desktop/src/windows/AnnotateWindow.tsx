import { useCallback, useEffect, useRef, useState } from "react";
import { ipc } from "../lib/ipc";

type Tool = "select" | "arrow" | "rect" | "blur" | "text" | "badge" | "measure";

const ISSUE_TYPES = [
  { id: "contrast", label: "Contrast", sc: "1.4.3" },
  { id: "use-of-color", label: "Use of color", sc: "1.4.1" },
  { id: "focus", label: "Focus indicator", sc: "2.4.7" },
  { id: "target-size", label: "Target size", sc: "2.5.8" },
  { id: "alt-text", label: "Alt text", sc: "1.1.1" },
  { id: "label", label: "Label / name", sc: "4.1.2" },
  { id: "keyboard", label: "Keyboard", sc: "2.1.1" },
  { id: "other", label: "Other", sc: "" },
] as const;
type IssueId = (typeof ISSUE_TYPES)[number]["id"];

const SEVERITIES = ["blocker", "major", "minor"] as const;
type Severity = (typeof SEVERITIES)[number];

interface Shape {
  id: number;
  kind: Exclude<Tool, "select">;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  text?: string;
  issueType?: IssueId;
  severity?: Severity;
  note?: string;
}

const PALETTE = ["#F2543D", "#2563EB", "#F5B00B", "#FFFFFF", "#0F172A"];
const STROKE = 4;
const TARGET_MIN = 24; // WCAG 2.5.8 minimum target size (CSS px ~ physical here)

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
  const pastRef = useRef<Shape[][]>([]);
  const futureRef = useRef<Shape[][]>([]);

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
          case "measure": {
            ctx.setLineDash([8, 5]);
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
            const fails = w < TARGET_MIN && h < TARGET_MIN;
            const label = `${Math.round(w)} × ${Math.round(h)} px${fails ? "  ✕ 2.5.8" : ""}`;
            ctx.font = "600 15px -apple-system, system-ui, sans-serif";
            const tw = ctx.measureText(label).width + 12;
            const ly = y > 26 ? y - 24 : y + h + 4;
            ctx.fillStyle = fails ? "#DC2626" : "rgba(15,23,42,0.85)";
            ctx.beginPath();
            ctx.roundRect(x, ly, tw, 20, 5);
            ctx.fill();
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(label, x + 6, ly + 15);
            break;
          }
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
            ctx.lineTo(s.x2 - head * Math.cos(angle - Math.PI / 6), s.y2 - head * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(s.x2 - head * Math.cos(angle + Math.PI / 6), s.y2 - head * Math.sin(angle + Math.PI / 6));
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
            const onDark = !isLight(s.color);
            ctx.beginPath();
            ctx.arc(s.x1, s.y1, r, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = onDark ? "#FFFFFF" : "#0F172A";
            ctx.stroke();
            ctx.fillStyle = onDark ? "#FFFFFF" : "#0F172A";
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
      if (hit) {
        pastRef.current.push(shapes);
        futureRef.current = [];
        dragRef.current = { id: hit.id, dx: p.x - hit.x1, dy: p.y - hit.y1 };
      }
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
        color,
        issueType: "contrast",
        severity: "major",
        note: "",
      };
      commit((prev) => [...prev, shape]);
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
        const committed = draft;
        commit((prev) => [...prev, committed]);
      }
      setDraft(null);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;
      const toolKeys: Record<string, Tool> = {
        v: "select",
        i: "badge",
        a: "arrow",
        r: "rect",
        x: "blur",
        t: "text",
        m: "measure",
      };
      const mapped = toolKeys[e.key.toLowerCase()];
      if (mapped && !e.metaKey && !e.ctrlKey) {
        setTool(mapped);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId !== null) {
        commit((prev) => prev.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function exportPng(): Promise<Uint8Array> {
    const canvas = document.createElement("canvas");
    render(canvas.getContext("2d")!, true);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
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

  function issueMeta(b: Shape) {
    const type = ISSUE_TYPES.find((t) => t.id === b.issueType) ?? ISSUE_TYPES[ISSUE_TYPES.length - 1];
    return { type, severity: b.severity ?? "major", note: b.note?.trim() || "(add note)" };
  }

  async function onCopyMarkdown() {
    const lines = badges.map((b, i) => {
      const { type, severity, note } = issueMeta(b);
      const sc = type.sc ? `WCAG ${type.sc} ` : "";
      return `${i + 1}. **${sc}${type.label}** · \`${severity}\` — ${note}`;
    });
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
    flash("Markdown copied");
  }

  async function onCopyJira() {
    const lines = badges.map((b, i) => {
      const { type, severity, note } = issueMeta(b);
      const sc = type.sc ? `WCAG ${type.sc} ` : "";
      return `# *${sc}${type.label}* {{${severity}}} — ${note}`;
    });
    const jira = [
      "h2. Accessibility issues",
      "",
      "_Annotated screenshot attached (numbers reference the list below)._",
      "",
      ...lines,
      "",
      "Found with [Accessibility.build|https://accessibility.build] desktop.",
    ].join("\n");
    await ipc.copyText(jira);
    flash("Jira markup copied");
  }

  return (
    <div className="app-bg-solid flex h-screen flex-col font-sans text-[13px] text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-card/80 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="seg">
            {(
              [
                ["select", "Select", "V"],
                ["badge", "① Issue", "I"],
                ["arrow", "↗", "A"],
                ["rect", "▢", "R"],
                ["measure", "⤢ 24px", "M"],
                ["blur", "▦", "X"],
                ["text", "T", "T"],
              ] as [Tool, string, string][]
            ).map(([t, label, key]) => (
              <button key={t} data-active={tool === t} onClick={() => setTool(t)} title={`${t} (${key})`}>
                {label}
              </button>
            ))}
          </div>
          <span className="h-5 w-px bg-border" />
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
          <span className="h-5 w-px bg-border" />
          <button onClick={undo} title="Undo (⌘Z)" className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            ↩
          </button>
          <button onClick={redo} title="Redo (⇧⌘Z)" className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            ↪
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {status && <span className="rise mr-2 text-[11px] text-ok">{status}</span>}
          <button
            onClick={() => void onCopyMarkdown()}
            disabled={badges.length === 0}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
            title="GitHub-ready issue list"
          >
            Markdown
          </button>
          <button
            onClick={() => void onCopyJira()}
            disabled={badges.length === 0}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
            title="Jira wiki markup"
          >
            Jira
          </button>
          <button onClick={() => void onCopy()} className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
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
                    const shape: Shape = {
                      id: nextId++,
                      kind: "text",
                      x1: (textEntry.x / rect.width) * canvas.width,
                      y1: (textEntry.y / rect.height) * canvas.height,
                      x2: 0,
                      y2: 0,
                      color,
                      text: textEntry.value.trim(),
                    };
                    commit((prev) => [...prev, shape]);
                    setTextEntry(null);
                  }
                  if (e.key === "Escape") setTextEntry(null);
                }}
                onBlur={() => setTextEntry(null)}
                placeholder="Type, then Enter"
                className="absolute z-10 rounded-md border border-primary bg-card px-2 py-1 text-sm outline-none"
                style={{ left: textEntry.x, top: textEntry.y }}
              />
            )}
          </div>
        </main>

        {badges.length > 0 && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-card/80 p-3 backdrop-blur-xl">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Issues ({badges.length})
            </h2>
            {badges.map((b, i) => {
              const type = ISSUE_TYPES.find((t) => t.id === b.issueType);
              return (
                <div
                  key={b.id}
                  className={`rise mb-2 rounded-lg border p-2 ${
                    selectedId === b.id ? "border-primary" : "border-border"
                  }`}
                  onClick={() => setSelectedId(b.id)}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ backgroundColor: b.color, color: isLight(b.color) ? "#0F172A" : "#FFF" }}
                    >
                      {i + 1}
                    </span>
                    <select
                      value={b.issueType}
                      onChange={(e) =>
                        setShapes((prev) =>
                          prev.map((s) => (s.id === b.id ? { ...s, issueType: e.target.value as IssueId } : s)),
                        )
                      }
                      className="min-w-0 flex-1 rounded-md border border-border bg-card-2/70 px-1.5 py-1 text-xs outline-none"
                    >
                      {ISSUE_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.sc ? `${t.sc} · ` : ""}
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={b.severity ?? "major"}
                      onChange={(e) =>
                        setShapes((prev) =>
                          prev.map((s) => (s.id === b.id ? { ...s, severity: e.target.value as Severity } : s)),
                        )
                      }
                      className={`rounded-md border border-border bg-card-2/70 px-1 py-1 text-[11px] outline-none ${
                        b.severity === "blocker" ? "text-coral" : b.severity === "minor" ? "text-muted-foreground" : ""
                      }`}
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {type?.sc && (
                    <p className="mb-1 text-[10px] text-muted-foreground">WCAG {type.sc} — {type.label}</p>
                  )}
                  <textarea
                    value={b.note}
                    onChange={(e) =>
                      setShapes((prev) => prev.map((s) => (s.id === b.id ? { ...s, note: e.target.value } : s)))
                    }
                    placeholder="What's wrong here?"
                    rows={2}
                    className="w-full resize-none rounded-md border border-border bg-card-2/70 px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              );
            })}
          </aside>
        )}
      </div>
    </div>
  );
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}
