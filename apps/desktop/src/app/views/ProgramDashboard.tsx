import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChartBarHorizontal, Info, WarningCircle } from "../Icon";
import type {
  AuditProject,
  AuditSampleItem,
  AuditTestRun,
  Finding,
} from "../../shared/desktop";
import { getStored, listCaptures } from "../api";
import { auditStoreKey } from "../audits";
import type { AuditChecklistEntry } from "../audit-coverage";
import {
  calculateProgramMetrics,
  type ProgramAuditInput,
  type ProgramMetrics,
} from "../program-metrics";
import { messageFromError } from "../hooks";

function percentage(value: number | null): string {
  return value === null ? "Unavailable" : `${value.toLocaleString()}%`;
}

function duration(value: number | null): string {
  if (value === null) return "Unavailable";
  const hours = value / 3_600_000;
  if (hours < 24) {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(hours)} hr`;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(hours / 24)} days`;
}

function MetricCard({
  label,
  value,
  detail,
  note,
}: {
  label: string;
  value: string;
  detail: string;
  note: string;
}) {
  return (
    <section className="program-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
      <small>{note}</small>
    </section>
  );
}

function ChartTablePanel({
  title,
  description,
  chartId,
  tableId,
  chart,
  table,
}: {
  title: string;
  description: string;
  chartId: string;
  tableId: string;
  chart: ReactNode;
  table: ReactNode;
}) {
  return (
    <section className="program-panel" aria-labelledby={`${chartId}-heading`}>
      <div className="program-panel-heading">
        <div>
          <h2 id={`${chartId}-heading`}>{title}</h2>
          <p>{description}</p>
        </div>
        <ChartBarHorizontal size={20} aria-hidden="true" />
      </div>
      <div className="program-chart-table">
        <figure
          id={chartId}
          className="program-chart"
          aria-labelledby={`${chartId}-heading`}
          aria-describedby={tableId}
          data-table-equivalent={tableId}
        >
          {chart}
        </figure>
        <div className="program-table-wrap">{table}</div>
      </div>
    </section>
  );
}

export function ProgramDashboardView({ metrics }: { metrics: ProgramMetrics }) {
  const maximumHotspot = Math.max(
    1,
    ...metrics.hotspots.map((hotspot) => hotspot.findingRecords),
  );
  const coverage = metrics.coverageContext.componentSampleStates;

  return (
    <div className="program-dashboard">
      <section className="program-boundary" aria-labelledby="program-boundary-title">
        <Info size={20} aria-hidden="true" />
        <div>
          <h2 id="program-boundary-title">Operational trends, not conformance</h2>
          <p>
            These measures use confirmed findings and local auditor decisions only. They are
            not a pass rate, conformance verdict, or substitute for testing. A failure that is
            not observed again is not treated as a pass.
          </p>
        </div>
      </section>

      <div className="program-metric-grid">
        <MetricCard
          label="Observed recurrence"
          value={percentage(metrics.recurrence.percent)}
          detail={
            metrics.recurrence.denominator
              ? `${metrics.recurrence.numerator} of ${metrics.recurrence.denominator} timestamped component–criterion fixes later appeared in another finding.`
              : "No timestamped component fixes are available yet."
          }
          note={`${metrics.recurrence.notObservedAgain} not observed again; absence is not a pass. ${metrics.recurrence.fixedWithoutTimestamp} verified component finding record${metrics.recurrence.fixedWithoutTimestamp === 1 ? " was" : "s were"} excluded because the fix time is missing.`}
        />
        <MetricCard
          label="Median retest time"
          value={duration(metrics.retestTime.medianMilliseconds)}
          detail={`${metrics.retestTime.verifiedTransitions} explicit ready-for-retest → verified transition${metrics.retestTime.verifiedTransitions === 1 ? "" : "s"}.`}
          note={`${metrics.retestTime.fixedEventsMissingReadyTimestamp} verified event${metrics.retestTime.fixedEventsMissingReadyTimestamp === 1 ? "" : "s"} excluded because the ready timestamp is missing.`}
        />
        <MetricCard
          label="Regression rate"
          value={percentage(metrics.regression.percent)}
          detail={
            metrics.regression.denominator
              ? `${metrics.regression.numerator} of ${metrics.regression.denominator} verified findings were later reopened or returned to retest.`
              : "No timestamped verified findings are available yet."
          }
          note={`${metrics.regression.noPostVerificationUpdate} verified finding${metrics.regression.noPostVerificationUpdate === 1 ? " has" : "s have"} no later local status update.`}
        />
        <MetricCard
          label="Top component hotspot"
          value={metrics.hotspots[0]?.component ?? "Unavailable"}
          detail={
            metrics.hotspots[0]
              ? `${metrics.hotspots[0].findingRecords} confirmed finding record${metrics.hotspots[0].findingRecords === 1 ? "" : "s"} across ${metrics.hotspots[0].auditCount} audit${metrics.hotspots[0].auditCount === 1 ? "" : "s"}.`
              : "No findings are linked to component sample items."
          }
          note="Counts are finding records, not automated results."
        />
      </div>

      <section className="program-coverage-context" aria-labelledby="program-coverage-title">
        <div>
          <span>Coverage context</span>
          <h2 id="program-coverage-title">Untested work stays visible</h2>
          <p>Raw counts only. They are never folded into an overall percentage.</p>
        </div>
        <dl>
          <div><dt>Owned audits</dt><dd>{metrics.auditCount}</dd></div>
          <div><dt>Component samples</dt><dd>{metrics.coverageContext.componentSamples}</dd></div>
          <div><dt>Complete sample records</dt><dd>{coverage.complete}</dd></div>
          <div><dt>In progress</dt><dd>{coverage["in-progress"]}</dd></div>
          <div><dt>Blocked or gaps</dt><dd>{coverage.blocked + coverage.gap}</dd></div>
          <div><dt>Not started</dt><dd>{coverage["not-started"]}</dd></div>
          <div><dt>Criterion decisions</dt><dd>{metrics.coverageContext.criterionDecisions}</dd></div>
          <div><dt>Untested criteria</dt><dd>{metrics.coverageContext.untestedCriteria}</dd></div>
          <div><dt>Unassigned findings</dt><dd>{metrics.coverageContext.unassignedFindings}</dd></div>
        </dl>
        {metrics.archivedAuditCount || metrics.excludedDemoAudits ? (
          <p className="program-coverage-note">
            {metrics.archivedAuditCount
              ? `${metrics.archivedAuditCount} archived audit${metrics.archivedAuditCount === 1 ? " remains" : "s remain"} in historical trends. `
              : ""}
            {metrics.excludedDemoAudits
              ? `${metrics.excludedDemoAudits} guided demo audit${metrics.excludedDemoAudits === 1 ? " is" : "s are"} excluded.`
              : ""}
          </p>
        ) : null}
      </section>

      {metrics.recurrence.byComponent.length ? (
        <ChartTablePanel
          title="Previously fixed failures observed again"
          description="Components are matched by normalized sample label and WCAG criterion. The text and table carry the same values."
          chartId="program-recurrence-chart"
          tableId="program-recurrence-table"
          chart={metrics.recurrence.byComponent.map((component) => (
            <div className="program-bar-row" key={component.component}>
              <div><strong>{component.component}</strong><span>{component.numerator} recurring of {component.denominator} fixed</span></div>
              <div className="program-bar-track" aria-hidden="true">
                <span style={{ width: `${component.percent ?? 0}%` }} />
              </div>
            </div>
          ))}
          table={(
            <table id="program-recurrence-table">
              <caption>Table equivalent for previously fixed failures observed again</caption>
              <thead><tr><th scope="col">Component</th><th scope="col">Previously fixed component–criterion pairs</th><th scope="col">Observed again</th><th scope="col">Not observed again</th></tr></thead>
              <tbody>
                {metrics.recurrence.byComponent.map((component) => (
                  <tr key={component.component}>
                    <th scope="row">{component.component}</th>
                    <td>{component.denominator}</td>
                    <td>{component.numerator}</td>
                    <td>{component.notObservedAgain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      ) : null}

      {metrics.hotspots.length ? (
        <ChartTablePanel
          title="Component hotspots"
          description="Confirmed finding records by component sample. Counts include every remediation state and do not imply conformance."
          chartId="program-hotspot-chart"
          tableId="program-hotspot-table"
          chart={metrics.hotspots.map((hotspot) => (
            <div className="program-bar-row" key={hotspot.component}>
              <div><strong>{hotspot.component}</strong><span>{hotspot.findingRecords} finding records</span></div>
              <div className="program-bar-track program-bar-track-hotspot" aria-hidden="true">
                <span style={{ width: `${(hotspot.findingRecords / maximumHotspot) * 100}%` }} />
              </div>
            </div>
          ))}
          table={(
            <table id="program-hotspot-table">
              <caption>Table equivalent for component hotspots</caption>
              <thead><tr><th scope="col">Component</th><th scope="col">Finding records</th><th scope="col">Open or ready for retest</th><th scope="col">Blocker or major</th><th scope="col">Audits</th><th scope="col">WCAG criteria</th></tr></thead>
              <tbody>
                {metrics.hotspots.map((hotspot) => (
                  <tr key={hotspot.component}>
                    <th scope="row">{hotspot.component}</th>
                    <td>{hotspot.findingRecords}</td>
                    <td>{hotspot.activeFindings}</td>
                    <td>{hotspot.blockerOrMajor}</td>
                    <td>{hotspot.auditCount}</td>
                    <td>{hotspot.criteria.join(", ") || "Not mapped"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      ) : (
        <section className="program-empty" aria-labelledby="program-empty-title">
          <WarningCircle size={24} aria-hidden="true" />
          <div>
            <h2 id="program-empty-title">No component history yet</h2>
            <p>Link confirmed findings to representative sample items of type Component to build longitudinal hotspots and recurrence history.</p>
          </div>
        </section>
      )}
    </div>
  );
}

async function loadProgramAudit(audit: AuditProject): Promise<ProgramAuditInput> {
  const [sampleItems, testRuns, captures, findings, checklist] = await Promise.all([
    getStored<AuditSampleItem[]>(auditStoreKey(audit.id, "sampleItems"), []),
    getStored<AuditTestRun[]>(auditStoreKey(audit.id, "testRuns"), []),
    listCaptures(audit.id),
    getStored<Finding[]>(auditStoreKey(audit.id, "findings"), []),
    getStored<Record<string, AuditChecklistEntry>>(
      auditStoreKey(audit.id, "checklist"),
      {},
    ),
  ]);
  return { audit, sampleItems, testRuns, captures, findings, checklist };
}

export function ProgramDashboard({ audits }: { audits: AuditProject[] }) {
  const [metrics, setMetrics] = useState<ProgramMetrics | null>(null);
  const [error, setError] = useState("");
  const auditIdentity = useMemo(
    () => audits.map((audit) => `${audit.id}:${audit.updatedAt}`).join("|"),
    [audits],
  );

  useEffect(() => {
    let active = true;
    setMetrics(null);
    setError("");
    void Promise.all(audits.map(loadProgramAudit))
      .then((inputs) => {
        if (active) setMetrics(calculateProgramMetrics(inputs));
      })
      .catch((loadError) => {
        if (active) setError(messageFromError(loadError));
      });
    return () => { active = false; };
  }, [auditIdentity, audits]);

  if (error) {
    return (
      <section className="program-empty" role="alert">
        <WarningCircle size={24} aria-hidden="true" />
        <div><h2>Program data could not be loaded</h2><p>{error}</p></div>
      </section>
    );
  }
  if (!metrics) {
    return (
      <div className="program-loading" role="status">
        <span /> <span /> <span />
        <span className="sr-only">Loading local program metrics</span>
      </div>
    );
  }
  return <ProgramDashboardView metrics={metrics} />;
}
