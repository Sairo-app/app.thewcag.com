import { useEffect, useMemo, useState } from "react";
import { ipc } from "../lib/ipc";
import { CloseIcon, PlusIcon } from "../lib/icons";

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
  "in-progress": "#F59E0B",
  fixed: "#16A34A",
  "wont-fix": "#64748B",
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
  const [findings, setFindings] = useState<Finding[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void reload();
    // reloading on focus catches findings added by annotate exports
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function reload() {
    const raw = await ipc.storeGet(STORE_KEY).catch(() => null);
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
      sc: f.sc ?? "",
      label: f.label,
      severity: f.severity,
      status: f.status,
      note: f.note.replace(/\s+/g, " ").trim(),
      date: new Date(f.createdAt).toISOString().slice(0, 10),
    }));
  }

  async function exportCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = toRows();
    const csv = [
      ["WCAG", "Issue", "Severity", "Status", "Note", "Date"].join(","),
      ...rows.map((r) => [r.sc, r.label, r.severity, r.status, r.note, r.date].map(esc).join(",")),
    ].join("\n");
    const path = await ipc.saveText(csv, `findings-${today()}.csv`);
    if (path) flash("CSV saved");
  }

  async function exportMarkdown() {
    const rows = toRows();
    const md = [
      `# Accessibility findings (${rows.length})`,
      "",
      "| # | WCAG | Issue | Severity | Status | Note |",
      "|---|------|-------|----------|--------|------|",
      ...rows.map(
        (r, i) => `| ${i + 1} | ${r.sc} | ${r.label} | ${r.severity} | ${r.status} | ${r.note.replace(/\|/g, "\\|")} |`,
      ),
      "",
      "Logged with TheWCAG desktop.",
    ].join("\n");
    const path = await ipc.saveText(md, `findings-${today()}.md`);
    if (path) flash("Markdown saved");
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
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Accessibility findings</title>
<style>body{font:14px -apple-system,system-ui,sans-serif;margin:40px;color:#0f172a}h1{font-size:22px}
table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left;vertical-align:top}
th{background:#f8fafc;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
.sev{padding:2px 8px;border-radius:999px;color:#fff;font-size:12px}.blocker{background:#dc2626}.major{background:#f59e0b}.minor{background:#64748b}
footer{margin-top:24px;color:#64748b;font-size:12px}</style></head>
<body><h1>Accessibility findings <small style="color:#64748b">(${rows.length})</small></h1>
<table><thead><tr><th>#</th><th>WCAG</th><th>Issue</th><th>Severity</th><th>Status</th><th>Note</th></tr></thead>
<tbody>${body}</tbody></table><footer>Logged with TheWCAG desktop, ${today()}</footer></body></html>`;
    const path = await ipc.saveText(html, `findings-${today()}.html`);
    if (path) flash("HTML saved");
  }

  return (
    <div className="app-bg-solid flex h-screen flex-col font-sans text-[13px] text-foreground">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur-xl">
        <h1 className="mr-2 text-sm font-bold">Findings Register</h1>
        <span className="text-[11px] text-muted-foreground">
          {counts.total} total, {counts.open} open, {counts.fixed} fixed
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {status && <span className="rise mr-1 text-[11px] text-ok">{status}</span>}
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
          className="min-w-40 flex-1 rounded-md border border-border bg-card-2/70 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as Severity | "all")} className="rounded-md border border-border bg-card-2/70 px-2 py-1.5 text-xs outline-none">
          <option value="all">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | "all")} className="rounded-md border border-border bg-card-2/70 px-2 py-1.5 text-xs outline-none">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            {findings.length === 0
              ? "No findings yet. Issues you tag in Capture & Annotate land here automatically, or add one manually."
              : "No findings match the current filters."}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((f) => (
              <div key={f.key} className="rise card tile grid grid-cols-[auto_1fr_auto] items-start gap-2 p-2">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[f.severity] }} title={f.severity} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {f.sc && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{f.sc}</span>}
                    <input
                      value={f.label}
                      onChange={(e) => update(f.key, { label: e.target.value })}
                      className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none focus:underline"
                    />
                  </div>
                  <textarea
                    value={f.note}
                    onChange={(e) => update(f.key, { note: e.target.value })}
                    placeholder="Add a note…"
                    rows={1}
                    className="mt-1 w-full resize-none rounded border border-transparent bg-transparent px-0 text-[11px] text-muted-foreground outline-none focus:border-border focus:bg-card-2/70 focus:px-1.5 focus:py-1"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <select
                    value={f.severity}
                    onChange={(e) => update(f.key, { severity: e.target.value as Severity })}
                    className="rounded-md border border-border bg-card-2/70 px-1 py-1 text-[10px] outline-none"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={f.status}
                    onChange={(e) => update(f.key, { status: e.target.value as Status })}
                    className="rounded-md border px-1 py-1 text-[10px] font-medium outline-none"
                    style={{ color: STATUS_COLOR[f.status], borderColor: STATUS_COLOR[f.status] + "66" }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button onClick={() => remove(f.key)} title="Delete" className="rounded px-1.5 py-1 text-muted-foreground hover:text-coral">
                    <CloseIcon size={12} />
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
