import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ipc, isTauriRuntime } from "../lib/ipc";
import {
  AUDIT_BRIEF_KEY,
  auditMetadataLines,
  parseAuditBrief,
  safeAuditFilename,
  type AuditBrief,
} from "../lib/audit";

const STORE_KEY = "checklist-default";

const RESULT_LABEL: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  na: "N/A",
  untested: "Untested",
};

function useEscapeToClose() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape" && t?.tagName !== "INPUT" && t?.tagName !== "TEXTAREA" && t?.tagName !== "SELECT") {
        void getCurrentWebviewWindow().close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

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
  useEscapeToClose();
  const [state, setState] = useState<State>({});
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [saved, setSaved] = useState<string | null>(null);
  const [savedError, setSavedError] = useState(false);
  const [auditBrief, setAuditBrief] = useState<AuditBrief | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    void (async () => {
      const [raw, auditRaw] = await Promise.all([
        ipc.storeGet(STORE_KEY).catch((e) => {
          if (isTauriRuntime) flash(`Couldn't load the checklist: ${String(e)}`, true);
          return null;
        }),
        ipc.storeGet(AUDIT_BRIEF_KEY).catch(() => null),
      ]);
      const brief = parseAuditBrief(auditRaw);
      setAuditBrief(brief);
      setLevelFilter(brief?.standard === "WCAG 2.2 A" ? "A" : "all");
      try {
        setState(raw ? JSON.parse(raw) : {});
      } catch {
        setState({});
      }
    })();
  }, []);

  function persist(next: State) {
    setState(next);
    saveQueue.current = saveQueue.current
      .then(() => ipc.storeSet(STORE_KEY, JSON.stringify(next)))
      .catch((e) => {
        if (isTauriRuntime) flash(`Changes are not saved: ${String(e)}`, true);
      });
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

  function flash(m: string, error = false) {
    setSaved(m);
    setSavedError(error);
    setTimeout(() => setSaved(null), error ? 6000 : 2000);
  }

  function runExport(action: () => Promise<void>, label: string) {
    void action().catch((e) => flash(`${label}: ${String(e)}`, true));
  }

  // Export only the visible (filtered) criteria, matching what the auditor sees.
  function exportRows() {
    return visible.map((c) => ({
      ...c,
      result: state[c.sc]?.result ?? "untested",
      note: (state[c.sc]?.note ?? "").replace(/\s+/g, " ").trim(),
    }));
  }
  async function exportCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = exportRows();
    const csv = [
      ["SC", "Level", "Criterion", "Result", "Note"].join(","),
      ...rows.map((r) => [r.sc, r.level, r.name, RESULT_LABEL[r.result], r.note].map(esc).join(",")),
    ].join("\n");
    const context = auditBrief
      ? [
          ["Project", auditBrief.project],
          ["Target", auditBrief.target],
          ["Scope", auditBrief.scope],
          ["Standard", auditBrief.standard],
          ["Evaluator", auditBrief.auditor],
          ["Started", auditBrief.startedAt],
          [],
        ].map((row) => row.map(esc).join(","))
      : [];
    const path = await ipc.saveText(
      [...context, csv].join("\n"),
      `${safeAuditFilename(auditBrief, "wcag-audit")}-checklist-${today()}.csv`,
    );
    if (path) flash(`CSV saved (${rows.length} criteria)`);
  }
  async function exportMarkdown() {
    const rows = exportRows();
    const md = [
      `# ${auditBrief?.project ?? "WCAG 2.2 audit"}`,
      "",
      ...auditMetadataLines(auditBrief),
      ...(auditBrief ? [""] : []),
      `## Checklist results - ${today()}`,
      "",
      `${stats.pass} pass, ${stats.fail} fail, ${stats.na} N/A, ${stats.total - stats.tested} untested`,
      "",
      "| SC | Level | Criterion | Result | Note |",
      "|----|-------|-----------|--------|------|",
      ...rows.map((r) => `| ${r.sc} | ${r.level} | ${r.name} | ${RESULT_LABEL[r.result]} | ${r.note.replace(/\|/g, "\\|")} |`),
      "",
      "Audited with TheWCAG desktop.",
    ].join("\n");
    const path = await ipc.saveText(md, `${safeAuditFilename(auditBrief, "wcag-audit")}-checklist-${today()}.md`);
    if (path) flash(`Markdown saved (${rows.length} criteria)`);
  }
  async function exportHtml() {
    const rows = exportRows();
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const body = rows
      .map(
        (r) =>
          `<tr><td>${r.sc}</td><td>${r.level}</td><td>${esc(r.name)}</td><td class="r-${r.result}">${RESULT_LABEL[r.result]}</td><td>${esc(r.note)}</td></tr>`,
      )
      .join("");
    const meta = auditBrief
      ? `<dl class="meta"><div><dt>Target</dt><dd>${esc(auditBrief.target || "Not specified")}</dd></div><div><dt>Scope</dt><dd>${esc(auditBrief.scope || "Not specified")}</dd></div><div><dt>Standard</dt><dd>${esc(auditBrief.standard)}</dd></div><div><dt>Evaluator</dt><dd>${esc(auditBrief.auditor || "Not specified")}</dd></div><div><dt>Started</dt><dd>${esc(auditBrief.startedAt)}</dd></div></dl>`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(auditBrief?.project ?? "WCAG 2.2 audit")}</title>
<style>body{font:14px -apple-system,system-ui,sans-serif;margin:40px;color:#0f172a}h1{font-size:22px}
table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #e2e8f0;padding:7px 10px;text-align:left}
th{background:#f8fafc;font-size:12px;text-transform:uppercase;color:#64748b}
.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px}.meta div{min-width:0}.meta dt{font-size:11px;text-transform:uppercase;color:#64748b}.meta dd{margin:3px 0 0}
.r-pass{color:#15803d;font-weight:600}.r-fail{color:#b91c1c;font-weight:600}.r-na{color:#475569}.r-untested{color:#64748b}</style></head>
<body><h1>${esc(auditBrief?.project ?? "WCAG 2.2 audit")} <small style="color:#64748b">${today()}</small></h1>${meta}
<p>${stats.pass} pass, ${stats.fail} fail, ${stats.na} N/A, ${stats.total - stats.tested} untested</p>
<table><thead><tr><th>SC</th><th>Level</th><th>Criterion</th><th>Result</th><th>Note</th></tr></thead>
<tbody>${body}</tbody></table></body></html>`;
    const path = await ipc.saveText(html, `${safeAuditFilename(auditBrief, "wcag-audit")}-checklist-${today()}.html`);
    if (path) flash(`HTML saved (${exportRows().length} criteria)`);
  }

  const pct = stats.total ? Math.round((stats.tested / stats.total) * 100) : 0;

  return (
    <div className="app-bg-solid flex h-screen flex-col font-sans text-[13px] text-foreground">
      <header className="border-b border-border bg-card/80 px-3 py-2 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold">{auditBrief?.project ?? "WCAG 2.2 Checklist"}</h1>
            {auditBrief && <p className="truncate text-[10px] text-muted-foreground">Checklist · {auditBrief.standard}</p>}
          </div>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as Level | "all")} aria-label="Filter by conformance level" className="rounded-md border border-border bg-card-2/70 px-2 py-1 text-xs outline-none">
            <option value="all">A &amp; AA</option>
            <option value="A">Level A</option>
            <option value="AA">Level AA</option>
          </select>
          <div className="ml-auto flex items-center gap-1.5">
            <span role={savedError ? "alert" : "status"} aria-live="polite" className={`mr-1 text-[11px] ${savedError ? "text-coral" : "text-ok"}`}>
              {saved}
            </span>
            <button onClick={() => runExport(exportCsv, "Couldn't export CSV")} className="btn px-2.5 py-1.5 text-xs">CSV</button>
            <button onClick={() => runExport(exportMarkdown, "Couldn't export Markdown")} className="btn px-2.5 py-1.5 text-xs">Markdown</button>
            <button onClick={() => runExport(exportHtml, "Couldn't export HTML")} className="btn-primary px-3 py-1.5 text-xs">HTML</button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${stats.tested} of ${stats.total} criteria tested`}
            className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-ok" style={{ width: `${stats.total ? (stats.pass / stats.total) * 100 : 0}%` }} />
            <div className="h-full bg-coral" style={{ width: `${stats.total ? (stats.fail / stats.total) * 100 : 0}%` }} />
            <div className="h-full bg-muted-foreground/40" style={{ width: `${stats.total ? (stats.na / stats.total) * 100 : 0}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground">
            {stats.pass} pass, {stats.fail} fail, {stats.na} N/A, {stats.total - stats.tested} left
          </span>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {Object.entries(byPrinciple).map(([principle, items]) => (
          <section key={principle} className="mb-4">
            <h2 className="label mb-1.5">{principle}</h2>
            <div className="space-y-1">
              {items.map((c) => {
                const entry = state[c.sc] ?? { result: "untested" as Result, note: "" };
                return (
                  <div key={c.sc} className="card p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{c.sc}</span>
                      <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">{c.level}</span>
                      <span className="min-w-[12rem] flex-1 truncate text-xs" title={c.name}>{c.name}</span>
                      <div className="flex shrink-0 gap-1" role="group" aria-label={`Result for ${c.sc}`}>
                        {(["pass", "fail", "na"] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => setResult(c.sc, r)}
                            aria-pressed={entry.result === r}
                            aria-label={`${RESULT_LABEL[r]} - ${c.sc} ${c.name}`}
                            title={entry.result === r ? "Click again to clear" : RESULT_LABEL[r]}
                            className="min-h-7 rounded-md border px-2 py-1 text-[10px] font-semibold"
                            style={
                              entry.result === r
                                ? { backgroundColor: RESULT_COLOR[r], color: "#fff", borderColor: RESULT_COLOR[r] }
                                : { color: RESULT_COLOR[r], borderColor: "hsl(var(--border))" }
                            }
                          >
                            {RESULT_LABEL[r]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(entry.result !== "untested" || entry.note) && (
                      <input
                        value={entry.note}
                        onChange={(e) => setNote(c.sc, e.target.value)}
                        placeholder={entry.result === "pass" ? "Evidence (optional)…" : entry.result === "na" ? "Why not applicable…" : "Note…"}
                        aria-label={`Note for ${c.sc}`}
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
