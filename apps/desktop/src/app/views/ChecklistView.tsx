import { useEffect, useMemo, useState } from "react";
import {
  Check,
  DownloadSimple,
  FunnelSimple,
  MagnifyingGlass,
  Minus,
  Warning,
} from "@phosphor-icons/react";
import type { AuditProject } from "../../shared/desktop";
import { desktop } from "../api";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import { Button, Segmented, Toast } from "../components";
import { WCAG_CRITERIA, type CriterionLevel } from "../data/wcag";
import { useStoredState, useTransientMessage } from "../hooks";

type Result = "untested" | "pass" | "fail" | "na";
interface Entry {
  result: Result;
  note: string;
}
type ChecklistState = Record<string, Entry>;

export function ChecklistView({
  audit,
  recordActivity,
  onStateChange,
}: {
  audit: AuditProject;
  recordActivity: RecordAuditActivity;
  onStateChange?: (state: ChecklistState) => void;
}) {
  const [state, setState] = useStoredState<ChecklistState>(
    auditStoreKey(audit.id, "checklist"),
    {},
  );
  const [level, setLevel] = useState<"all" | CriterionLevel>(
    audit.standard === "WCAG 2.2 A" ? "A" : "all",
  );
  const [resultFilter, setResultFilter] = useState<"all" | Result>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, show] = useTransientMessage();
  const visible = useMemo(
    () =>
      WCAG_CRITERIA.filter(
        (item) =>
          (level === "all" || item.level === level) &&
          (resultFilter === "all" ||
            (state[item.sc]?.result || "untested") === resultFilter) &&
          `${item.sc} ${item.name} ${item.principle}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [level, query, resultFilter, state],
  );
  const stats = useMemo(
    () =>
      WCAG_CRITERIA.reduce(
        (sum, item) => {
          const result = state[item.sc]?.result || "untested";
          sum[result]++;
          return sum;
        },
        { pass: 0, fail: 0, na: 0, untested: 0 },
      ),
    [state],
  );
  const complete = WCAG_CRITERIA.length - stats.untested;
  const percent = Math.round((complete / WCAG_CRITERIA.length) * 100);
  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  function setResult(sc: string, result: Result) {
    setState((current) => ({
      ...current,
      [sc]: {
        note: current[sc]?.note || "",
        result: current[sc]?.result === result ? "untested" : result,
      },
    }));
  }
  function setNote(sc: string, note: string) {
    setState((current) => ({
      ...current,
      [sc]: { result: current[sc]?.result || "untested", note },
    }));
  }
  async function exportChecklist(format: "csv" | "md") {
    const rows = WCAG_CRITERIA.map((item) => ({
      ...item,
      result: state[item.sc]?.result || "untested",
      note: state[item.sc]?.note || "",
    }));
    const csv = [
      "SC,Level,Criterion,Principle,Result,Note",
      ...rows.map((row) =>
        [row.sc, row.level, row.name, row.principle, row.result, row.note]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const md = [
      `# ${audit.project} accessibility checklist`,
      "",
      `Target: ${audit.target || "Not specified"}`,
      `Standard: ${audit.standard}`,
      "",
      "| SC | Level | Criterion | Result | Note |",
      "| --- | --- | --- | --- | --- |",
      ...rows.map(
        (row) =>
          `| ${row.sc} | ${row.level} | ${row.name} | ${row.result} | ${row.note.replaceAll("|", "\\|")} |`,
      ),
    ].join("\n");
    const path = await desktop.invoke<string | null>("dialog:save-text", {
      name: `${audit.project.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "wcag-audit"}-checklist.${format}`,
      text: format === "csv" ? csv : md,
    });
    if (path) {
      await recordActivity({
        kind: "exported",
        title: "Checklist exported",
        detail: format.toUpperCase(),
      });
      show(`Checklist exported as ${format.toUpperCase()}`);
    }
  }

  function markVisibleNotApplicable() {
    setState((current) =>
      Object.fromEntries([
        ...Object.entries(current),
        ...visible.map((item) => [
          item.sc,
          { note: current[item.sc]?.note || "", result: "na" as Result },
        ]),
      ]),
    );
    show(`${visible.length} visible criteria marked not applicable`);
  }

  return (
    <div className="checklist-view">
      <Toast message={message} />
      <section className="checklist-progress">
        <div
          className="progress-ring"
          style={{ "--progress": `${percent * 3.6}deg` } as React.CSSProperties}
        >
          <span>{percent}%</span>
        </div>
        <div>
          <span className="section-label">Audit progress</span>
          <h2>
            {complete} of {WCAG_CRITERIA.length} criteria reviewed
          </h2>
          <p>
            {stats.pass} pass, {stats.fail} fail, {stats.na} not applicable,{" "}
            {stats.untested} remaining.
          </p>
        </div>
        <div className="progress-key">
          <span>
            <i className="key-pass" />
            {stats.pass} pass
          </span>
          <span>
            <i className="key-fail" />
            {stats.fail} fail
          </span>
          <span>
            <i className="key-na" />
            {stats.na} N/A
          </span>
        </div>
      </section>
      <div className="checklist-toolbar">
        <Segmented
          value={level}
          onChange={setLevel}
          label="Conformance level"
          options={[
            { value: "all", label: "A + AA" },
            { value: "A", label: "Level A" },
            { value: "AA", label: "Level AA" },
          ]}
        />
        <label className="search-field">
          <MagnifyingGlass size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search criteria"
            aria-label="Search criteria"
          />
        </label>
        <select
          value={resultFilter}
          onChange={(event) =>
            setResultFilter(event.target.value as typeof resultFilter)
          }
          aria-label="Filter by result"
        >
          <option value="all">All results</option>
          <option value="untested">Untested</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="na">N/A</option>
        </select>
        <Button
          icon={Minus}
          disabled={!visible.length}
          onClick={markVisibleNotApplicable}
        >
          Visible N/A
        </Button>
        <Button
          icon={DownloadSimple}
          onClick={() => void exportChecklist("md")}
        >
          Export
        </Button>
      </div>
      <div className="criteria-table">
        <div className="table-head criteria-head">
          <span>Criterion</span>
          <span>Level</span>
          <span>Result</span>
          <span />
        </div>
        {visible.length ? (
          visible.map((item) => {
            const entry = state[item.sc] || {
              result: "untested" as Result,
              note: "",
            };
            return (
              <article
                key={item.sc}
                className={`criterion-row result-${entry.result}`}
              >
                <button
                  className="criterion-main"
                  aria-expanded={expanded === item.sc}
                  onClick={() =>
                    setExpanded(expanded === item.sc ? null : item.sc)
                  }
                >
                  <code>{item.sc}</code>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.principle}</small>
                  </span>
                </button>
                <span className="level-tag">{item.level}</span>
                <div className="result-buttons">
                  <button
                    aria-pressed={entry.result === "pass"}
                    data-active={entry.result === "pass"}
                    className="pass"
                    aria-label={`Pass ${item.sc}`}
                    onClick={() => setResult(item.sc, "pass")}
                  >
                    <Check size={14} weight="bold" />
                  </button>
                  <button
                    aria-pressed={entry.result === "fail"}
                    data-active={entry.result === "fail"}
                    className="fail"
                    aria-label={`Fail ${item.sc}`}
                    onClick={() => setResult(item.sc, "fail")}
                  >
                    <Warning size={14} weight="fill" />
                  </button>
                  <button
                    aria-pressed={entry.result === "na"}
                    data-active={entry.result === "na"}
                    className="na"
                    aria-label={`Not applicable ${item.sc}`}
                    onClick={() => setResult(item.sc, "na")}
                  >
                    <Minus size={14} weight="bold" />
                  </button>
                </div>
                <button
                  className="expand-row"
                  aria-expanded={expanded === item.sc}
                  aria-label={`Toggle note for ${item.sc}`}
                  onClick={() =>
                    setExpanded(expanded === item.sc ? null : item.sc)
                  }
                >
                  {entry.note ? "Note added" : "Add note"}
                </button>
                {expanded === item.sc ? (
                  <div className="criterion-note">
                    <textarea
                      autoFocus
                      value={entry.note}
                      onChange={(event) => setNote(item.sc, event.target.value)}
                      placeholder="Record what you tested, the affected component, or the reason for N/A."
                    />
                    <span>Saved automatically</span>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="filter-empty">
            <FunnelSimple size={24} />
            <p>No criteria match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
