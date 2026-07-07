import { useEffect, useMemo, useState } from "react";
import { ipc } from "../lib/ipc";

const STORE_KEY = "checklist-default";

type Level = "A" | "AA";
interface Criterion {
  sc: string;
  name: string;
  level: Level;
  principle: string;
}

// WCAG 2.2 Level A + AA success criteria (4.1.1 Parsing removed in 2.2).
const CRITERIA: Criterion[] = [
  ["1.1.1", "Non-text Content", "A"],
  ["1.2.1", "Audio-only and Video-only (Prerecorded)", "A"],
  ["1.2.2", "Captions (Prerecorded)", "A"],
  ["1.2.3", "Audio Description or Media Alternative (Prerecorded)", "A"],
  ["1.2.4", "Captions (Live)", "AA"],
  ["1.2.5", "Audio Description (Prerecorded)", "AA"],
  ["1.3.1", "Info and Relationships", "A"],
  ["1.3.2", "Meaningful Sequence", "A"],
  ["1.3.3", "Sensory Characteristics", "A"],
  ["1.3.4", "Orientation", "AA"],
  ["1.3.5", "Identify Input Purpose", "AA"],
  ["1.4.1", "Use of Color", "A"],
  ["1.4.2", "Audio Control", "A"],
  ["1.4.3", "Contrast (Minimum)", "AA"],
  ["1.4.4", "Resize Text", "AA"],
  ["1.4.5", "Images of Text", "AA"],
  ["1.4.10", "Reflow", "AA"],
  ["1.4.11", "Non-text Contrast", "AA"],
  ["1.4.12", "Text Spacing", "AA"],
  ["1.4.13", "Content on Hover or Focus", "AA"],
].map(([sc, name, level]) => ({ sc, name, level: level as Level, principle: "Perceivable" }))
  .concat(
    (
      [
        ["2.1.1", "Keyboard", "A"],
        ["2.1.2", "No Keyboard Trap", "A"],
        ["2.1.4", "Character Key Shortcuts", "A"],
        ["2.2.1", "Timing Adjustable", "A"],
        ["2.2.2", "Pause, Stop, Hide", "A"],
        ["2.3.1", "Three Flashes or Below Threshold", "A"],
        ["2.4.1", "Bypass Blocks", "A"],
        ["2.4.2", "Page Titled", "A"],
        ["2.4.3", "Focus Order", "A"],
        ["2.4.4", "Link Purpose (In Context)", "A"],
        ["2.4.5", "Multiple Ways", "AA"],
        ["2.4.6", "Headings and Labels", "AA"],
        ["2.4.7", "Focus Visible", "AA"],
        ["2.4.11", "Focus Not Obscured (Minimum)", "AA"],
        ["2.5.1", "Pointer Gestures", "A"],
        ["2.5.2", "Pointer Cancellation", "A"],
        ["2.5.3", "Label in Name", "A"],
        ["2.5.4", "Motion Actuation", "A"],
        ["2.5.7", "Dragging Movements", "AA"],
        ["2.5.8", "Target Size (Minimum)", "AA"],
      ] as [string, string, Level][]
    ).map(([sc, name, level]) => ({ sc, name, level, principle: "Operable" })),
  )
  .concat(
    (
      [
        ["3.1.1", "Language of Page", "A"],
        ["3.1.2", "Language of Parts", "AA"],
        ["3.2.1", "On Focus", "A"],
        ["3.2.2", "On Input", "A"],
        ["3.2.3", "Consistent Navigation", "AA"],
        ["3.2.4", "Consistent Identification", "AA"],
        ["3.2.6", "Consistent Help", "A"],
        ["3.3.1", "Error Identification", "A"],
        ["3.3.2", "Labels or Instructions", "A"],
        ["3.3.3", "Error Suggestion", "AA"],
        ["3.3.4", "Error Prevention (Legal, Financial, Data)", "AA"],
        ["3.3.7", "Redundant Entry", "A"],
        ["3.3.8", "Accessible Authentication (Minimum)", "AA"],
      ] as [string, string, Level][]
    ).map(([sc, name, level]) => ({ sc, name, level, principle: "Understandable" })),
  )
  .concat(
    (
      [
        ["4.1.2", "Name, Role, Value", "A"],
        ["4.1.3", "Status Messages", "AA"],
      ] as [string, string, Level][]
    ).map(([sc, name, level]) => ({ sc, name, level, principle: "Robust" })),
  );

type Result = "untested" | "pass" | "fail" | "na";
interface Entry {
  result: Result;
  note: string;
}
type State = Record<string, Entry>;

const RESULT_COLOR: Record<Exclude<Result, "untested">, string> = {
  pass: "hsl(var(--ok))",
  fail: "hsl(var(--coral))",
  na: "hsl(var(--muted-foreground))",
};

export default function ChecklistWindow() {
  const [state, setState] = useState<State>({});
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const raw = await ipc.storeGet(STORE_KEY).catch(() => null);
      try {
        setState(raw ? JSON.parse(raw) : {});
      } catch {
        setState({});
      }
    })();
  }, []);

  function persist(next: State) {
    setState(next);
    void ipc.storeSet(STORE_KEY, JSON.stringify(next)).catch(() => {});
  }
  function setResult(sc: string, result: Result) {
    const cur = state[sc] ?? { result: "untested", note: "" };
    persist({ ...state, [sc]: { ...cur, result: cur.result === result ? "untested" : result } });
  }
  function setNote(sc: string, note: string) {
    const cur = state[sc] ?? { result: "untested", note: "" };
    persist({ ...state, [sc]: { ...cur, note } });
  }

  const visible = useMemo(
    () => CRITERIA.filter((c) => levelFilter === "all" || c.level === levelFilter),
    [levelFilter],
  );
  const stats = useMemo(() => {
    let pass = 0, fail = 0, na = 0, tested = 0;
    for (const c of visible) {
      const r = state[c.sc]?.result ?? "untested";
      if (r === "pass") pass++;
      if (r === "fail") fail++;
      if (r === "na") na++;
      if (r !== "untested") tested++;
    }
    return { pass, fail, na, tested, total: visible.length };
  }, [visible, state]);

  const byPrinciple = useMemo(() => {
    const groups: Record<string, Criterion[]> = {};
    for (const c of visible) (groups[c.principle] ??= []).push(c);
    return groups;
  }, [visible]);

  function flash(m: string) {
    setSaved(m);
    setTimeout(() => setSaved(null), 2000);
  }

  function exportRows() {
    return CRITERIA.map((c) => ({
      ...c,
      result: state[c.sc]?.result ?? "untested",
      note: (state[c.sc]?.note ?? "").replace(/\s+/g, " ").trim(),
    }));
  }
  async function exportMarkdown() {
    const rows = exportRows();
    const md = [
      `# WCAG 2.2 audit - ${today()}`,
      "",
      `${stats.pass} pass, ${stats.fail} fail, ${stats.na} N/A, ${stats.total - stats.tested} untested`,
      "",
      "| SC | Level | Criterion | Result | Note |",
      "|----|-------|-----------|--------|------|",
      ...rows.map((r) => `| ${r.sc} | ${r.level} | ${r.name} | ${r.result} | ${r.note.replace(/\|/g, "\\|")} |`),
      "",
      "Audited with TheWCAG desktop.",
    ].join("\n");
    const path = await ipc.saveText(md, `wcag-audit-${today()}.md`);
    if (path) flash("Markdown saved");
  }
  async function exportHtml() {
    const rows = exportRows();
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const body = rows
      .map(
        (r) =>
          `<tr><td>${r.sc}</td><td>${r.level}</td><td>${esc(r.name)}</td><td class="r-${r.result}">${r.result}</td><td>${esc(r.note)}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>WCAG 2.2 audit</title>
<style>body{font:14px -apple-system,system-ui,sans-serif;margin:40px;color:#0f172a}h1{font-size:22px}
table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #e2e8f0;padding:7px 10px;text-align:left}
th{background:#f8fafc;font-size:12px;text-transform:uppercase;color:#64748b}
.r-pass{color:#16a34a;font-weight:600}.r-fail{color:#dc2626;font-weight:600}.r-na{color:#64748b}.r-untested{color:#94a3b8}</style></head>
<body><h1>WCAG 2.2 audit <small style="color:#64748b">${today()}</small></h1>
<p>${stats.pass} pass, ${stats.fail} fail, ${stats.na} N/A, ${stats.total - stats.tested} untested</p>
<table><thead><tr><th>SC</th><th>Level</th><th>Criterion</th><th>Result</th><th>Note</th></tr></thead>
<tbody>${body}</tbody></table></body></html>`;
    const path = await ipc.saveText(html, `wcag-audit-${today()}.html`);
    if (path) flash("HTML saved");
  }

  const pct = stats.total ? Math.round((stats.tested / stats.total) * 100) : 0;

  return (
    <div className="app-bg-solid flex h-screen flex-col font-sans text-[13px] text-foreground">
      <header className="border-b border-border bg-card/80 px-3 py-2 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-sm font-bold">WCAG 2.2 Checklist</h1>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as Level | "all")} className="rounded-md border border-border bg-card-2/70 px-2 py-1 text-xs outline-none">
            <option value="all">A &amp; AA</option>
            <option value="A">Level A</option>
            <option value="AA">Level AA</option>
          </select>
          <div className="ml-auto flex items-center gap-1.5">
            {saved && <span className="rise mr-1 text-[11px] text-ok">{saved}</span>}
            <button onClick={() => void exportMarkdown()} className="btn px-2.5 py-1.5 text-xs">Markdown</button>
            <button onClick={() => void exportHtml()} className="btn-primary px-3 py-1.5 text-xs">HTML</button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground">
            <span className="text-ok">{stats.pass}✓</span>, <span className="text-coral">{stats.fail}✕</span>,{" "}
            {stats.na} N/A, {stats.total - stats.tested} left
          </span>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {Object.entries(byPrinciple).map(([principle, items]) => (
          <section key={principle} className="mb-4">
            <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{principle}</h2>
            <div className="space-y-1">
              {items.map((c) => {
                const entry = state[c.sc] ?? { result: "untested" as Result, note: "" };
                return (
                  <div key={c.sc} className="rounded-lg border border-border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{c.sc}</span>
                      <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">{c.level}</span>
                      <span className="min-w-0 flex-1 truncate text-xs" title={c.name}>{c.name}</span>
                      <div className="flex shrink-0 gap-1">
                        {(["pass", "fail", "na"] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => setResult(c.sc, r)}
                            className="rounded-md border px-1.5 py-1 text-[10px] font-semibold"
                            style={
                              entry.result === r
                                ? { backgroundColor: RESULT_COLOR[r], color: "#fff", borderColor: RESULT_COLOR[r] }
                                : { color: RESULT_COLOR[r], borderColor: "hsl(var(--border))" }
                            }
                          >
                            {r === "pass" ? "Pass" : r === "fail" ? "Fail" : "N/A"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(entry.result === "fail" || entry.note) && (
                      <input
                        value={entry.note}
                        onChange={(e) => setNote(c.sc, e.target.value)}
                        placeholder="Note…"
                        className="mt-1.5 w-full rounded-md border border-border bg-card-2/70 px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
