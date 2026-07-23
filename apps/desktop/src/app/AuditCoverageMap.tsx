import {
  ArrowRight,
  Camera,
  CheckCircle,
  ClipboardText,
  LinkSimple,
  WarningCircle,
} from "./Icon";
import type { WorkspaceStage } from "../shared/desktop";
import type { AuditCoverage, AuditSessionSelection } from "./audit-coverage";
import { auditTestRunComplete } from "./audit-plan";
import { Button, StatusBadge } from "./components";

const STATE_LABELS: Record<AuditCoverage["rows"][number]["state"], string> = {
  complete: "Covered",
  "in-progress": "In progress",
  blocked: "Blocked",
  gap: "Trace gap",
  "not-started": "Not started",
};

function statusTone(state: AuditCoverage["rows"][number]["state"]) {
  if (state === "complete") return "success" as const;
  if (state === "blocked" || state === "gap") return "danger" as const;
  if (state === "in-progress") return "warning" as const;
  return "neutral" as const;
}

export function AuditCoverageMap({
  coverage,
  onOpenSession,
  onNavigate,
  onOpenFindings,
}: {
  coverage: AuditCoverage;
  onOpenSession: (selection: AuditSessionSelection) => void;
  onNavigate: (stage: WorkspaceStage) => void;
  onOpenFindings: () => void;
}) {
  const unassigned =
    coverage.unassigned.testRuns.length +
    coverage.unassigned.captures.length +
    coverage.unassigned.findings.length;

  return (
    <section className="coverage-map" aria-labelledby="coverage-map-title">
      <div className="coverage-map-heading">
        <div>
          <span className="section-label">Traceability</span>
          <h2 id="coverage-map-title">Audit coverage map</h2>
          <p>
            See which planned sample has a test record, findings with linked evidence,
            and mapped WCAG decisions. This view does not change the audit.
          </p>
        </div>
        <div className="coverage-score" aria-label={`${coverage.percent}% of sample items covered`}>
          <strong>{coverage.percent}%</strong>
          <span>{coverage.complete} of {coverage.rows.length} covered</span>
          <progress value={coverage.complete} max={Math.max(1, coverage.rows.length)}>
            {coverage.percent}%
          </progress>
        </div>
      </div>

      <div className="coverage-summary" aria-label="Coverage summary">
        <span><CheckCircle size={16} weight="fill" /><strong>{coverage.complete}</strong> covered</span>
        <span><WarningCircle size={16} weight="fill" /><strong>{coverage.gaps}</strong> need attention</span>
        <span><ClipboardText size={16} /><strong>{coverage.blocked}</strong> blocked</span>
      </div>

      {coverage.rows.length ? (
        <div className="coverage-table-wrap">
          <div className="coverage-table" role="table" aria-label="Representative sample coverage">
            <div className="coverage-table-head" role="row">
              <span role="columnheader">Sample</span>
              <span role="columnheader">Guided test</span>
              <span role="columnheader">Finding evidence</span>
              <span role="columnheader">Findings</span>
              <span role="columnheader">WCAG</span>
              <span role="columnheader" className="sr-only">Action</span>
            </div>
            {coverage.rows.map((row) => {
              const run =
                row.testRuns.find((item) => item.status === "in-progress") ??
                row.testRuns.find((item) => item.status !== "complete") ??
                row.testRuns[0] ??
                coverage.unassigned.testRuns.find((item) => item.status === "in-progress") ??
                coverage.unassigned.testRuns.find(
                  (item) => item.status !== "blocked" && !auditTestRunComplete(item),
                );
              return (
                <div className={`coverage-row coverage-row-${row.state}`} role="row" key={row.sample.id}>
                  <div className="coverage-sample" role="cell">
                    <StatusBadge tone={statusTone(row.state)}>{STATE_LABELS[row.state]}</StatusBadge>
                    <strong>{row.sample.label}</strong>
                    <span title={row.sample.location}>{row.sample.location || "Location missing"}</span>
                    {row.gap ? <small>{row.gap}</small> : null}
                  </div>
                  <div className="coverage-cell" role="cell" data-label="Guided test">
                    <strong>{row.testRuns.length}</strong>
                    <span>{row.testRuns.length ? `${row.testRuns.filter(auditTestRunComplete).length} complete` : "None linked"}</span>
                  </div>
                  <div className="coverage-cell" role="cell" data-label="Evidence">
                    <button
                      type="button"
                      className="coverage-link"
                      onClick={onOpenFindings}
                      aria-label={`Open findings with ${row.captures.length} linked captures for ${row.sample.label}`}
                    >
                      <strong>{row.captures.length}</strong>
                      <span>{row.captures.length === 1 ? "linked capture" : "linked captures"}</span>
                    </button>
                  </div>
                  <div className="coverage-cell" role="cell" data-label="Findings">
                    <button
                      type="button"
                      className="coverage-link"
                      onClick={onOpenFindings}
                      aria-label={`Open ${row.findings.length} findings for ${row.sample.label}`}
                    >
                      <strong>{row.findingsWithEvidence}/{row.findings.length}</strong>
                      <span>with evidence</span>
                    </button>
                  </div>
                  <div className="coverage-cell" role="cell" data-label="WCAG">
                    <button
                      type="button"
                      className="coverage-link"
                      onClick={() => onNavigate("review")}
                      aria-label={`Open WCAG review for ${row.sample.label}, ${row.criteria.length} mapped criteria`}
                    >
                      <strong>{row.criteria.length}</strong>
                      <span>{row.criteria.length ? row.criteria.slice(0, 2).join(", ") : "No mapping"}</span>
                    </button>
                  </div>
                  <div className="coverage-action-cell" role="cell">
                    <Button
                      className="coverage-action"
                      icon={ArrowRight}
                      onClick={() => onOpenSession({
                        sampleItemId: row.sample.id,
                        testRunId: run?.id,
                      })}
                    >
                      {row.state === "complete" ? "Review" : "Continue"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="coverage-empty">
          <ClipboardText size={24} />
          <div>
            <strong>Add a representative sample to build the map</strong>
            <p>Every sample item becomes one traceable coverage row.</p>
          </div>
        </div>
      )}

      {unassigned ? (
        <div className="coverage-unassigned">
          <LinkSimple size={20} />
          <div>
            <strong>{unassigned} existing {unassigned === 1 ? "record needs" : "records need"} assignment review</strong>
            <p>
              {coverage.unassigned.testRuns.length} tests and {coverage.unassigned.findings.length} findings need a sample;
              {" "}{coverage.unassigned.captures.length} captures are preserved in the unassigned bucket until linked to a finding.
            </p>
          </div>
          {coverage.rows[0] ? (
            <Button
              icon={Camera}
              onClick={() => onOpenSession({ sampleItemId: coverage.rows[0].sample.id })}
            >
              Link new work
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
