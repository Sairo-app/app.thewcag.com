import { useEffect, useMemo, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ipc } from "../lib/ipc";
import { CloseIcon, PlusIcon } from "../lib/icons";
import {
  AUDIT_BRIEF_KEY,
  auditMetadataLines,
  parseAuditBrief,
  safeAuditFilename,
  type AuditBrief,
} from "../lib/audit";

/** Close the tool window on Escape (unless typing in a field). */
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

const STORE_KEY = "findings";

const STATUSES = ["open", "in-progress", "fixed", "wont-fix"] as const;
type Status = (typeof STATUSES)[number];
const SEVERITIES = ["blocker", "major", "minor"] as const;
type Severity = (typeof SEVERITIES)[number];

const SEVERITY_COLOR: Record<Severity, string> = {
  blocker: "#DC2626",
  major: "#F59E0B",
  minor: "#64748B",
};
const STATUS_COLOR: Record<Status, string> = {
  open: "#DC2626",
  "in-progress": "#B45309",
  fixed: "#16A34A",
  "wont-fix": "#64748B",
};
// Human labels so raw enum values never leak into the UI or client exports.
const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  "in-progress": "In progress",
  fixed: "Fixed",
  "wont-fix": "Won't fix",
};

interface Finding {
  key: string;
  source: "annotate" | "manual";
  captureId?: string;
  sc?: string;
  label: string;
  severity: Severity;
  status: Status;
  note: string;
  createdAt: number;
}

export default function FindingsWindow() {
  useEscapeToClose();
  const [findings, setFindings] = useState<Finding[]>([]);
  // Filters persist across window close/open so a triage session survives.
  const [query, setQuery] = useState(() => localStorage.getItem("findings-query") ?? "");
  const [statusFilter, setStatusFilter] = useState<Status | "all">(
    () => (localStorage.getItem("findings-status") as Status | "all") ?? "all",
  );
  const [sevFilter, setSevFilter] = useState<Severity | "all">(
    () => (localStorage.getItem("findings-sev") as Severity | "all") ?? "all",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [auditBrief, setAuditBrief] = useState<AuditBrief | null>(null);

  useEffect(() => {
    localStorage.setItem("findings-query", query);
    localStorage.setItem("findings-status", statusFilter);
    localStorage.setItem("findings-sev", sevFilter);
  }, [query, statusFilter, sevFilter]);

  useEffect(() => {
    void reload();
    // reloading on focus catches findings added by annotate exports
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function reload() {
    const [raw, auditRaw] = await Promise.all([
      ipc.storeGet(STORE_KEY).catch(() => null),
      ipc.storeGet(AUDIT_BRIEF_KEY).catch(() => null),
    ]);
    setAuditBrief(parseAuditBrief(auditRaw));
    try {
      setFindings(raw ? JSON.parse(raw) : []);
    } catch {
      setFindings([]);
    }
  }

  function persist(next: Finding[]) {
    setFindings(next);
    void ipc.storeSet(STORE_KEY, JSON.stringify(next)).catch(() => {});
  }

  function update(key: string, patch: Partial<Finding>) {
    persist(findings.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function remove(key: string) {
    persist(findings.filter((f) => f.key !== key));
  }

  function addManual() {
    const f: Finding = {
      key: `manual:${Date.now()}`,
      source: "manual",
      label: "New finding",
      severity: "major",
      status: "open",
      note: "",
      createdAt: Date.now(),
    };
    persist([f, ...findings]);
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return findings
      .filter((f) => statusFilter === "all" || f.status === statusFilter)
      .filter((f) => sevFilter === "all" || f.severity === sevFilter)
      .filter(
        (f) =>
          !q ||
          f.label.toLowerCase().includes(q) ||
          f.note.toLowerCase().includes(q) ||
          (f.sc ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [findings, query, statusFilter, sevFilter]);

  const counts = useMemo(() => {
    const open = findings.filter((f) => f.status === "open").length;
    const fixed = findings.filter((f) => f.status === "fixed").length;
    return { total: findings.length, open, fixed };
  }, [findings]);

  function flash(m: string) {
    setStatus(m);
    setTimeout(() => setStatus(null), 2200);
  }

  function toRows() {
    return filtered.map((f) => ({
      project: auditBrief?.project ?? "",
      target: auditBrief?.target ?? "",
      scope: auditBrief?.scope ?? "",
      standard: auditBrief?.standard ?? "WCAG 2.2 AA",
      evaluator: auditBrief?.auditor ?? "",
      sc: f.sc ?? "",
      label: f.label,
      severity: f.severity,
      status: STATUS_LABEL[f.status],
      note: f.note.replace(/\s+/g, " ").trim(),
      date: new Date(f.createdAt).toISOString().slice(0, 10),
    }));
  }

  // Name the export scope so a filtered export is never mistaken for the full set.
  function exportScope(n: number): string {
    return n < findings.length ? ` (${n} of ${findings.length}, filtered)` : "";
  }

  async function exportCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = toRows();
    const csv = [
      ["Project", "Target", "Scope", "Standard", "Evaluator", "WCAG", "Issue", "Severity", "Status", "Note", "Date"].join(","),
      ...rows.map((r) => [r.project, r.target, r.scope, r.standard, r.evaluator, r.sc, r.label, r.severity, r.status, r.note, r.date].map(esc).join(",")),
    ].join("\n");
    const path = await ipc.saveText(csv, `${safeAuditFilename(auditBrief, "findings")}-findings-${today()}.csv`);
    if (path) flash(`CSV saved${exportScope(rows.length)}`);
  }

  async function exportMarkdown() {
    const rows = toRows();
    const md = [
      `# ${auditBrief?.project ?? "Accessibility findings"}`,
      "",
      ...auditMetadataLines(auditBrief),
      ...(auditBrief ? [""] : []),
      `## Findings (${rows.length})`,
      "",
      "| # | WCAG | Issue | Severity | Status | Note |",
      "|---|------|-------|----------|--------|------|",
      ...rows.map(
        (r, i) => `| ${i + 1} | ${r.sc} | ${r.label} | ${r.severity} | ${r.status} | ${r.note.replace(/\|/g, "\\|")} |`,
      ),
      "",
      "Logged with TheWCAG desktop.",
    ].join("\n");
    const path = await ipc.saveText(md, `${safeAuditFilename(auditBrief, "findings")}-findings-${today()}.md`);
    if (path) flash(`Markdown saved${exportScope(rows.length)}`);
  }

  async function exportHtml() {
    const rows = toRows();
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const body = rows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td>${esc(r.sc)}</td><td>${esc(r.label)}</td><td><span class="sev ${r.severity}">${r.severity}</span></td><td>${r.status}</td><td>${esc(r.note)}</td></tr>`,
      )
      .join("");
    const meta = auditBrief
      ? `<dl class="meta"><div><dt>Target</dt><dd>${esc(auditBrief.target || "Not specified")}</dd></div><div><dt>Scope</dt><dd>${esc(auditBrief.scope || "Not specified")}</dd></div><div><dt>Standard</dt><dd>${esc(auditBrief.standard)}</dd></div><div><dt>Evaluator</dt><dd>${esc(auditBrief.auditor || "Not specified")}</dd></div><div><dt>Started</dt><dd>${esc(auditBrief.startedAt)}</dd></div></dl>`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(auditBrief?.project ?? "Accessibility findings")}</title>
<style>body{font:14px -apple-system,system-ui,sans-serif;margin:40px;color:#0f172a}h1{font-size:22px}
table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left;vertical-align:top}
th{background:#f8fafc;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
.sev{padding:2px 8px;border-radius:999px;color:#fff;font-size:12px}.blocker{background:#dc2626}.major{background:#b45309}.minor{background:#64748b}
.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px}.meta div{min-width:0}.meta dt{font-size:11px;text-transform:uppercase;color:#64748b}.meta dd{margin:3px 0 0}
footer{margin-top:24px;color:#64748b;font-size:12px}</style></head>
<body><h1>${esc(auditBrief?.project ?? "Accessibility findings")} <small style="color:#64748b">(${rows.length} findings)</small></h1>${meta}
<table><thead><tr><th>#</th><th>WCAG</th><th>Issue</th><th>Severity</th><th>Status</th><th>Note</th></tr></thead>
<tbody>${body}</tbody></table><footer>Logged with TheWCAG desktop, ${today()}</footer></body></html>`;
    const path = await ipc.saveText(html, `${safeAuditFilename(auditBrief, "findings")}-findings-${today()}.html`);
    if (path) flash(`HTML saved${exportScope(rows.length)}`);
  }

  return (
    <div className="app-bg-solid flex h-screen flex-col font-sans text-[13px] text-foreground">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur-xl">
        <div className="mr-2 min-w-0">
          <h1 className="truncate text-sm font-bold">{auditBrief?.project ?? "Findings Register"}</h1>
          {auditBrief && <p className="truncate text-[10px] text-muted-foreground">Findings · {auditBrief.standard}</p>}
        </div>
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <button onClick={() => setStatusFilter("all")} className="hover:text-foreground">
            {counts.total} total
          </button>
          <button onClick={() => setStatusFilter("open")} className="hover:text-foreground">
            {counts.open} open
          </button>
          <button onClick={() => setStatusFilter("fixed")} className="hover:text-foreground">
            {counts.fixed} fixed
          </button>
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span role="status" aria-live="polite" className="mr-1 text-[11px] text-ok">
            {status}
          </span>
          <button onClick={addManual} className="btn flex items-center gap-1 px-2.5 py-1.5 text-xs">
            <PlusIcon size={11} />
            Add
          </button>
          <button onClick={() => void exportCsv()} disabled={!findings.length} className="btn px-2.5 py-1.5 text-xs disabled:opacity-40">
            CSV
          </button>
          <button onClick={() => void exportMarkdown()} disabled={!findings.length} className="btn px-2.5 py-1.5 text-xs disabled:opacity-40">
            Markdown
          </button>
          <button onClick={() => void exportHtml()} disabled={!findings.length} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40">
            HTML
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search issues, notes, criteria…"
          aria-label="Search findings"
          className="min-w-40 flex-1 rounded-md border border-border bg-card-2/70 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as Severity | "all")} aria-label="Filter by severity" className="rounded-md border border-border bg-card-2/70 px-2 py-1.5 text-xs outline-none">
          <option value="all">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | "all")} aria-label="Filter by status" className="rounded-md border border-border bg-card-2/70 px-2 py-1.5 text-xs outline-none">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          findings.length === 0 ? (
            <div className="mt-16 text-center text-sm text-muted-foreground">
              <p>Issues you tag in Capture &amp; Annotate land here automatically.</p>
              <button onClick={addManual} className="btn mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs">
                <PlusIcon size={12} />
                Add one manually
              </button>
            </div>
          ) : (
            <div className="mt-16 text-center text-sm text-muted-foreground">
              <p>No findings match the current filters.</p>
              <button
                onClick={() => {
                  setQuery("");
                  setSevFilter("all");
                  setStatusFilter("all");
                }}
                className="btn mt-3 px-3 py-1.5 text-xs"
              >
                Clear filters
              </button>
            </div>
          )
        ) : (
          <div className="space-y-1.5">
            {filtered.map((f) => (
              <div key={f.key} className="rise card tile grid grid-cols-[auto_1fr_auto] items-start gap-2 p-2">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: SEVERITY_COLOR[f.severity] }}
                  title={`Severity: ${f.severity}`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {f.sc && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{f.sc}</span>}
                    <input
                      value={f.label}
                      onChange={(e) => update(f.key, { label: e.target.value })}
                      aria-label="Issue title"
                      className="min-w-0 flex-1 rounded bg-transparent px-1 text-xs font-medium outline-none hover:bg-card-2/60 focus:bg-card-2/70 focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <textarea
                    value={f.note}
                    onChange={(e) => update(f.key, { note: e.target.value })}
                    placeholder="Add a note…"
                    aria-label="Note"
                    rows={Math.min(4, Math.max(1, (f.note || "").split("\n").length))}
                    className="mt-1 w-full resize-none rounded border border-transparent bg-transparent px-1 text-[11px] text-muted-foreground outline-none hover:bg-card-2/40 focus:border-border focus:bg-card-2/70 focus:px-1.5 focus:py-1"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <select
                    value={f.severity}
                    onChange={(e) => update(f.key, { severity: e.target.value as Severity })}
                    aria-label={`Severity for ${f.label || "finding"}`}
                    className="rounded-md border border-border bg-card-2/70 px-1.5 py-1.5 text-[11px] outline-none"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={f.status}
                    onChange={(e) => update(f.key, { status: e.target.value as Status })}
                    aria-label={`Status for ${f.label || "finding"}`}
                    className="rounded-md border px-1.5 py-1.5 text-[11px] font-medium outline-none"
                    style={{ borderColor: STATUS_COLOR[f.status] + "66" }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (confirmKey === f.key) {
                        setConfirmKey(null);
                        remove(f.key);
                      } else {
                        setConfirmKey(f.key);
                        setTimeout(() => setConfirmKey((c) => (c === f.key ? null : c)), 2500);
                      }
                    }}
                    aria-label={confirmKey === f.key ? `Confirm delete ${f.label || "finding"}` : `Delete ${f.label || "finding"}`}
                    title={confirmKey === f.key ? "Click again to delete" : "Delete"}
                    className={`rounded px-1.5 py-1.5 ${confirmKey === f.key ? "text-coral" : "text-muted-foreground hover:text-coral"}`}
                  >
                    {confirmKey === f.key ? <span className="text-[10px] font-semibold">Delete?</span> : <CloseIcon size={12} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
