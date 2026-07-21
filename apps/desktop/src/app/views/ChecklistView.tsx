import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowSquareOut,
  Check,
  DownloadSimple,
  FunnelSimple,
  MagnifyingGlass,
  Minus,
  Plus,
  Warning,
} from "@phosphor-icons/react";
import type {
  AppSettings,
  AuditProject,
  ChecklistShortcutSettings,
  Finding,
} from "../../shared/desktop";
import {
  nextFindingReference,
  normalizeFindingReferences,
} from "../../shared/finding-references";
import { desktop, getStored, setStored } from "../api";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import { Button, Segmented, Toast } from "../components";
import { CRITERION_GUIDANCE, understandingUrl } from "../data/criterion-guidance";
import { WCAG_CRITERIA, type CriterionLevel } from "../data/wcag";
import { useStoredState, useTransientMessage } from "../hooks";

type Result = "untested" | "pass" | "fail" | "na";
interface Entry {
  result: Result;
  note: string;
  findingKey?: string;
}
type ChecklistState = Record<string, Entry>;

const DEFAULT_DECISION_SHORTCUTS: ChecklistShortcutSettings = {
  pass: "p",
  fail: "f",
  notApplicable: "n",
  next: "j",
  previous: "k",
  expand: "Enter",
};

export function ChecklistView({
  audit,
  recordActivity,
  onStateChange,
  onOpenFindings,
}: {
  audit: AuditProject;
  recordActivity: RecordAuditActivity;
  onStateChange?: (state: ChecklistState) => void;
  onOpenFindings?: () => void;
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
  const [activeCriterion, setActiveCriterion] = useState("");
  const [shortcuts, setShortcuts] = useState(DEFAULT_DECISION_SHORTCUTS);
  const [message, show] = useTransientMessage();
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const undoState = useRef<ChecklistState | null>(null);
  const applicableCriteria = useMemo(
    () => WCAG_CRITERIA.filter(
      (item) => audit.standard === "WCAG 2.2 AA" || item.level === "A",
    ),
    [audit.standard],
  );
  const visible = useMemo(
    () =>
      applicableCriteria.filter(
        (item) =>
          (level === "all" || item.level === level) &&
          (resultFilter === "all" ||
            (state[item.sc]?.result || "untested") === resultFilter) &&
          `${item.sc} ${item.name} ${item.principle}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [applicableCriteria, level, query, resultFilter, state],
  );
  const stats = useMemo(
    () =>
      applicableCriteria.reduce(
        (sum, item) => {
          const result = state[item.sc]?.result || "untested";
          sum[result]++;
          return sum;
        },
        { pass: 0, fail: 0, na: 0, untested: 0 },
      ),
    [applicableCriteria, state],
  );
  const complete = applicableCriteria.length - stats.untested;
  const percent = Math.round((complete / applicableCriteria.length) * 100);
  useEffect(() => {
    setLevel(audit.standard === "WCAG 2.2 A" ? "A" : "all");
  }, [audit.standard]);
  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);
  useEffect(() => {
    void desktop
      .invoke<AppSettings>("settings:get")
      .then((settings) => setShortcuts(settings.checklistShortcuts));
  }, []);
  useEffect(() => {
    if (!visible.length) {
      setActiveCriterion("");
      return;
    }
    if (!visible.some((item) => item.sc === activeCriterion)) {
      setActiveCriterion(visible[0].sc);
    }
  }, [activeCriterion, visible]);

  function setResult(sc: string, result: Result) {
    setState((current) => {
      undoState.current = current;
      return {
        ...current,
        [sc]: {
          note: current[sc]?.note || "",
          result: current[sc]?.result === result ? "untested" : result,
          findingKey: current[sc]?.findingKey,
        },
      };
    });
  }
  function chooseResult(sc: string, result: Result) {
    const selecting = state[sc]?.result !== result;
    setResult(sc, result);
    if (selecting && (result === "fail" || result === "na")) {
      setExpanded(sc);
    }
  }

  function undoDecision() {
    if (!undoState.current) return;
    const previous = undoState.current;
    undoState.current = null;
    setState(previous);
    show("Checklist decision restored");
  }

  function focusRelative(sc: string, direction: -1 | 1) {
    const index = visible.findIndex((item) => item.sc === sc);
    if (index < 0) return;
    const target = visible[Math.max(0, Math.min(visible.length - 1, index + direction))];
    setActiveCriterion(target.sc);
    rowRefs.current.get(target.sc)?.focus();
  }

  function shortcutKey(key: string) {
    return key.length === 1 ? key.toLowerCase() : key;
  }

  function onCriterionKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    sc: string,
  ) {
    if (event.target !== event.currentTarget || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = shortcutKey(event.key === " " ? "Space" : event.key);
    const matches = (configured: string) => key === shortcutKey(configured);
    if (matches(shortcuts.pass)) chooseResult(sc, "pass");
    else if (matches(shortcuts.fail)) chooseResult(sc, "fail");
    else if (matches(shortcuts.notApplicable)) chooseResult(sc, "na");
    else if (matches(shortcuts.next)) focusRelative(sc, 1);
    else if (matches(shortcuts.previous)) focusRelative(sc, -1);
    else if (matches(shortcuts.expand)) setExpanded(expanded === sc ? null : sc);
    else return;
    event.preventDefault();
  }
  function setNote(sc: string, note: string) {
    setState((current) => ({
      ...current,
      [sc]: {
        result: current[sc]?.result || "untested",
        note,
        findingKey: current[sc]?.findingKey,
      },
    }));
  }

  async function createFinding(sc: string) {
    const criterion = WCAG_CRITERIA.find((item) => item.sc === sc);
    if (!criterion) return;
    const entry = state[sc] || { result: "fail" as Result, note: "" };
    const key = auditStoreKey(audit.id, "findings");
    const storedFindings = await getStored<Finding[]>(key, []);
    const normalized = normalizeFindingReferences(storedFindings);
    const findings = normalized.findings;
    if (
      entry.findingKey &&
      findings.some((finding) => finding.key === entry.findingKey)
    ) {
      onOpenFindings?.();
      return;
    }
    const guidance = CRITERION_GUIDANCE[sc];
    const now = Date.now();
    const finding: Finding = {
      key: `manual-${crypto.randomUUID()}`,
      reference: nextFindingReference(findings),
      title: `${criterion.name} does not meet WCAG ${criterion.sc}`,
      wcag: criterion.sc,
      severity: "major",
      status: "open",
      note: entry.note,
      createdAt: now,
      modifiedAt: now,
      schemaVersion: 2,
      source: "manual",
      description: entry.note || `A manual review found a failure of ${criterion.sc} ${criterion.name}.`,
      actualResult: entry.note,
      expectedResult: guidance.pass,
      userImpact: "Document the affected user groups and task impact before reporting this finding.",
      severityRationale: "Severity requires auditor confirmation based on task criticality, reach, frequency, and available workarounds.",
      wcagMappings: [{
        criterion: criterion.sc,
        level: criterion.level,
        name: criterion.name,
        rationale: guidance.verify,
        confidence: "medium",
      }],
      recommendation: `Review the implementation against WCAG ${criterion.sc} and verify the remediation with the same manual test.`,
      reproductionSteps: [guidance.test],
      manualChecks: ["Confirm the finding details, affected users, severity, and evidence before delivery."],
    };
    await setStored(key, [...findings, finding]);
    setState((current) => ({
      ...current,
      [sc]: { ...entry, result: "fail", findingKey: finding.key },
    }));
    await recordActivity({
      kind: "finding",
      title: "Checklist finding created",
      detail: `${criterion.sc} ${criterion.name}`,
    });
    show("Finding draft created. Complete its impact and evidence in Findings.");
  }
  async function exportChecklist(format: "csv" | "md") {
    const rows = applicableCriteria.map((item) => ({
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
            {complete} of {applicableCriteria.length} criteria reviewed
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
          options={audit.standard === "WCAG 2.2 A"
            ? [{ value: "A", label: "Level A" }]
            : [
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
          icon={DownloadSimple}
          onClick={() => void exportChecklist("md")}
        >
          Export
        </Button>
      </div>
      <div className="checklist-keyboard-hint" aria-label="Checklist keyboard shortcuts">
        <span>Row shortcuts</span>
        <span><kbd>{shortcuts.pass}</kbd> Pass</span>
        <span><kbd>{shortcuts.fail}</kbd> Fail</span>
        <span><kbd>{shortcuts.notApplicable}</kbd> N/A</span>
        <span><kbd>{shortcuts.previous}</kbd><kbd>{shortcuts.next}</kbd> Move</span>
        <span><kbd>{shortcuts.expand}</kbd> Open</span>
      </div>
      {undoState.current ? (
        <div className="undo-strip" role="status">
          <span>The last checklist decision changed.</span>
          <button onClick={undoDecision}>Undo</button>
        </div>
      ) : null}
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
            const guidance = CRITERION_GUIDANCE[item.sc];
            return (
              <article
                key={item.sc}
                className={`criterion-row result-${entry.result}`}
                data-active={activeCriterion === item.sc}
                tabIndex={0}
                ref={(node) => {
                  if (node) rowRefs.current.set(item.sc, node);
                  else rowRefs.current.delete(item.sc);
                }}
                onFocus={() => setActiveCriterion(item.sc)}
                onKeyDown={(event) => onCriterionKeyDown(event, item.sc)}
                aria-label={`${item.sc} ${item.name}. ${entry.result}. Use the configured row shortcuts to record a decision or move.`}
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
                    onClick={() => chooseResult(item.sc, "pass")}
                  >
                    <Check size={14} weight="bold" />
                  </button>
                  <button
                    aria-pressed={entry.result === "fail"}
                    data-active={entry.result === "fail"}
                    className="fail"
                    aria-label={`Fail ${item.sc}`}
                    onClick={() => chooseResult(item.sc, "fail")}
                  >
                    <Warning size={14} weight="fill" />
                  </button>
                  <button
                    aria-pressed={entry.result === "na"}
                    data-active={entry.result === "na"}
                    className="na"
                    aria-label={`Not applicable ${item.sc}`}
                    onClick={() => chooseResult(item.sc, "na")}
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
                  <div className="criterion-detail">
                    <div className="criterion-guidance">
                      <div>
                        <span>Verify</span>
                        <p>{guidance.verify}</p>
                      </div>
                      <div>
                        <span>Suggested manual test</span>
                        <p>{guidance.test}</p>
                      </div>
                      <div>
                        <span>Pass when</span>
                        <p>{guidance.pass}</p>
                      </div>
                    </div>
                    <div className="criterion-reference-row">
                      <small>Testing prompts are informative. The WCAG success criterion remains the conformance basis.</small>
                      <button
                        onClick={() => void desktop.invoke("shell:open-external", { url: understandingUrl(item.name) })}
                      >
                        W3C Understanding <ArrowSquareOut size={14} />
                      </button>
                    </div>
                    <div className="criterion-note">
                      <label>
                        <span>Audit record</span>
                        <textarea
                          autoFocus
                          value={entry.note}
                          onChange={(event) => setNote(item.sc, event.target.value)}
                          placeholder="Record what you tested, the affected component, evidence, or the reason for N/A."
                        />
                      </label>
                      <div>
                        <span>Saved automatically</span>
                        {entry.result === "fail" ? (
                          <Button
                            icon={entry.findingKey ? ArrowSquareOut : Plus}
                            onClick={() => void createFinding(item.sc)}
                          >
                            {entry.findingKey ? "Review linked finding" : "Create finding from failure"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
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
