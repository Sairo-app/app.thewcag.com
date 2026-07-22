import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  ClipboardText,
  DownloadSimple,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  AuditProject,
  AuditSampleItem,
  AuditTestRun,
  CaptureEntry,
  Finding,
} from "../../shared/desktop";
import { desktop, getStored, listCaptures, setStored } from "../api";
import { normalizeFindingReferences } from "../../shared/finding-references";
import {
  DEFAULT_REPORT_SECTIONS,
  REPORT_AUDIENCE_PRESETS,
  buildAuditHtml,
  buildAuditMarkdown,
  type ReportAudience,
  type ReportSectionOptions,
  type VpatConformanceResponse,
  type VpatResponseMap,
} from "../audit-export";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import { Button, Toast } from "../components";
import { messageFromError, useTransientMessage } from "../hooks";
import { ChecklistView } from "./ChecklistView";
import { WCAG_CRITERIA } from "../data/wcag";

type ChecklistState = Record<
  string,
  {
    result: "untested" | "pass" | "fail" | "na";
    note: string;
    findingKey?: string;
  }
>;

export function ReviewView({
  audit,
  recordActivity,
  onOpenFindings,
}: {
  audit: AuditProject;
  recordActivity: RecordAuditActivity;
  onOpenFindings: () => void;
}) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [sampleItems, setSampleItems] = useState<AuditSampleItem[]>([]);
  const [testRuns, setTestRuns] = useState<AuditTestRun[]>([]);
  const [exportFormat, setExportFormat] = useState<"md" | "html" | "pdf">("html");
  const [reportAudience, setReportAudience] = useState<ReportAudience | "custom">("complete");
  const [reportSections, setReportSections] = useState<ReportSectionOptions>({ ...DEFAULT_REPORT_SECTIONS });
  const [vpatResponses, setVpatResponses] = useState<VpatResponseMap>({});
  const [message, show] = useTransientMessage();

  useEffect(() => {
    let cancelled = false;
    setFindings([]);
    setChecklist({});
    setCaptures([]);
    setSampleItems([]);
    setTestRuns([]);
    setVpatResponses({});
    void Promise.all([
      getStored<Finding[]>(auditStoreKey(audit.id, "findings"), []),
      getStored<ChecklistState>(auditStoreKey(audit.id, "checklist"), {}),
      listCaptures(audit.id),
      getStored<AuditSampleItem[]>(auditStoreKey(audit.id, "sampleItems"), []),
      getStored<AuditTestRun[]>(auditStoreKey(audit.id, "testRuns"), []),
      getStored<VpatResponseMap>(auditStoreKey(audit.id, "vpatResponses"), {}),
    ])
      .then(([nextFindings, nextChecklist, nextCaptures, nextSampleItems, nextTestRuns, nextVpatResponses]) => {
        if (cancelled) return;
        const normalized = normalizeFindingReferences(nextFindings);
        setFindings(normalized.findings);
        if (normalized.changed) {
          void setStored(auditStoreKey(audit.id, "findings"), normalized.findings)
            .catch((error) => show(messageFromError(error), true));
        }
        setChecklist(nextChecklist);
        setCaptures(nextCaptures);
        setSampleItems(nextSampleItems);
        setTestRuns(nextTestRuns);
        setVpatResponses(
          nextVpatResponses && typeof nextVpatResponses === "object" && !Array.isArray(nextVpatResponses)
            ? nextVpatResponses
            : {},
        );
      })
      .catch((error) => {
        if (!cancelled) show(messageFromError(error), true);
      });
    return () => {
      cancelled = true;
    };
  }, [audit.id]);

  async function exportAudit() {
    try {
      const exportInput = {
        audit,
        findings,
        checklist,
        captures,
        sampleItems,
        testRuns,
        vpatResponses,
        sections: reportSections,
      };
      const text =
        exportFormat === "html" || exportFormat === "pdf"
          ? buildAuditHtml(exportInput)
          : buildAuditMarkdown(exportInput);
      const path = await desktop.invoke<string | null>(
        exportFormat === "pdf" ? "dialog:save-pdf" : "dialog:save-text",
        {
        name: `${audit.project.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "accessibility-audit"}-full-audit.${exportFormat}`,
          [exportFormat === "pdf" ? "html" : "text"]: text,
        },
      );
      if (!path) return;
      await recordActivity({
        kind: "exported",
        title: "Audit record exported",
        detail: `${exportFormat.toUpperCase()}, ${findings.length} findings, ${summary.reviewed} reviewed criteria`,
      });
      show(
        exportFormat === "pdf"
          ? "Tagged PDF audit exported"
          : exportFormat === "html"
          ? "Printable HTML audit exported"
          : "Portable Markdown audit exported",
      );
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  function chooseReportAudience(audience: ReportAudience) {
    setReportAudience(audience);
    setReportSections({ ...REPORT_AUDIENCE_PRESETS[audience] });
  }

  function toggleReportSection(section: keyof ReportSectionOptions) {
    setReportAudience("custom");
    setReportSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function updateVpatResponse(
    criterion: string,
    patch: Partial<{ response: VpatConformanceResponse; remarks: string }>,
  ) {
    setVpatResponses((current) => {
      const prior = current[criterion];
      const next: VpatResponseMap = {
        ...current,
        [criterion]: {
          response: patch.response ?? prior?.response ?? "",
          remarks: patch.remarks ?? prior?.remarks ?? "",
          source: "auditor",
          updatedAt: Date.now(),
        },
      };
      void setStored(auditStoreKey(audit.id, "vpatResponses"), next)
        .catch((error) => show(messageFromError(error), true));
      return next;
    });
  }

  const summary = useMemo(() => {
    const applicable = WCAG_CRITERIA.filter(
      (criterion) => audit.standard === "WCAG 2.2 AA" || criterion.level === "A",
    );
    const reviewed = applicable.filter(
      (criterion) =>
        checklist[criterion.sc]?.result &&
        checklist[criterion.sc]?.result !== "untested",
    ).length;
    return {
      reviewed,
      failures: findings.filter(
        (finding) => finding.status === "open" || finding.status === "retest",
      ).length,
      blockers: findings.filter(
        (finding) =>
          (finding.status === "open" || finding.status === "retest") &&
          finding.severity === "blocker",
      ).length,
      notes: Object.values(checklist).filter((entry) => entry.note.trim())
        .length,
      unlinkedFailures: applicable.filter((criterion) => {
        const entry = checklist[criterion.sc];
        return (
          entry?.result === "fail" &&
          (!entry.findingKey ||
            !findings.some((finding) => finding.key === entry.findingKey))
        );
      }).length,
      undocumentedNA: applicable.filter((criterion) => {
        const entry = checklist[criterion.sc];
        return entry?.result === "na" && !entry.note.trim();
      }).length,
      applicableCriteria: applicable,
      vpatCompleted: applicable.filter((criterion) => {
        const entry = vpatResponses[criterion.sc];
        return entry?.source === "auditor" && Boolean(entry.response);
      }).length,
    };
  }, [audit.standard, checklist, findings, vpatResponses]);

  return (
    <div className="review-view">
      <Toast message={message} />
      <section className="review-operations">
        <div>
          <strong>Portable audit record</strong>
          <p>
            Export the evaluation plan, findings, evidence inventory, retest
            records, conclusion, and every applicable checklist decision as
            tagged PDF, accessible HTML, or portable Markdown.
          </p>
        </div>
        <div className="review-export-panel">
          <div className="review-export-actions">
            <select
              value={reportAudience}
              onChange={(event) => {
                if (event.target.value !== "custom") {
                  chooseReportAudience(event.target.value as ReportAudience);
                }
              }}
              aria-label="Report audience"
            >
              <option value="complete">Complete audit</option>
              <option value="executive">Executive audience</option>
              <option value="delivery">Delivery team</option>
              {reportAudience === "custom" ? <option value="custom">Custom sections</option> : null}
            </select>
            <select
              value={exportFormat}
              onChange={(event) =>
                setExportFormat(event.target.value as typeof exportFormat)
              }
              aria-label="Audit export format"
            >
              <option value="pdf">Tagged PDF</option>
              <option value="html">Accessible HTML</option>
              <option value="md">Portable Markdown</option>
            </select>
            <Button icon={DownloadSimple} onClick={() => void exportAudit()}>
              Export report
            </Button>
          </div>
          <fieldset className="report-section-toggles">
            <legend>Audience sections</legend>
            {([
              ["executiveSummary", "Executive summary"],
              ["limitations", "Limitations"],
              ["prioritizedActionPlan", "Prioritized action plan"],
            ] as const).map(([section, label]) => (
              <label key={section}>
                <input
                  type="checkbox"
                  checked={reportSections[section]}
                  onChange={() => toggleReportSection(section)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      </section>
      <section className="review-summary" aria-label="Review summary">
        <div>
          <span className="review-icon review-icon-orange">
            <WarningCircle size={20} weight="duotone" />
          </span>
          <strong>{summary.failures}</strong>
          <small>unresolved findings</small>
        </div>
        <div>
          <span className="review-icon review-icon-red">
            <Warning size={20} weight="fill" />
          </span>
          <strong>{summary.blockers}</strong>
          <small>blockers</small>
        </div>
        <div>
          <span className="review-icon review-icon-green">
            <CheckCircle size={20} weight="duotone" />
          </span>
          <strong>{summary.reviewed}</strong>
          <small>criteria reviewed</small>
        </div>
        <div>
          <span className="review-icon">
            <ClipboardText size={20} weight="duotone" />
          </span>
          <strong>{summary.notes}</strong>
          <small>test notes</small>
        </div>
      </section>
      {summary.unlinkedFailures ? (
        <section className="review-gap" role="status">
          <Warning size={19} weight="fill" />
          <div>
            <strong>
              {summary.unlinkedFailures} failed {summary.unlinkedFailures === 1 ? "criterion has" : "criteria have"} no finding
            </strong>
            <p>
              Expand each failed criterion and create a linked finding so the
              failure, impact, evidence, and remediation are not lost at delivery.
            </p>
          </div>
        </section>
      ) : null}
      {summary.undocumentedNA ? (
        <section className="review-gap" role="status">
          <Warning size={19} weight="fill" />
          <div>
            <strong>
              {summary.undocumentedNA} not-applicable {summary.undocumentedNA === 1 ? "decision needs" : "decisions need"} a reason
            </strong>
            <p>
              Record why each criterion does not apply to the evaluated scope.
              This prevents an N/A decision from looking like an untested gap.
            </p>
          </div>
        </section>
      ) : null}
      <section className="vpat-authoring" aria-labelledby="vpat-authoring-title">
        <div className="vpat-authoring-heading">
          <div>
            <h2 id="vpat-authoring-title">VPAT / Accessibility Conformance Report</h2>
            <p>
              Author a conformance response for each criterion. Audit checklist
              results remain supporting evidence and are never converted into a
              response automatically.
            </p>
          </div>
          <strong>{summary.vpatCompleted}/{summary.applicableCriteria.length} human responses</strong>
        </div>
        <div className="vpat-human-only" role="note">
          Only values selected here are exported as conformance responses. Empty
          rows remain “Auditor response required.”
        </div>
        <details>
          <summary>Author criterion responses</summary>
          <div className="vpat-table-wrap">
            <table className="vpat-authoring-table">
              <caption>Human-authored WCAG 2.2 conformance responses</caption>
              <thead>
                <tr>
                  <th scope="col">Criterion</th>
                  <th scope="col">Conformance response</th>
                  <th scope="col">Remarks and explanations</th>
                </tr>
              </thead>
              <tbody>
                {summary.applicableCriteria.map((criterion) => {
                  const entry = vpatResponses[criterion.sc];
                  const label = `${criterion.sc} ${criterion.name}`;
                  return (
                    <tr key={criterion.sc}>
                      <th scope="row">
                        <span>{criterion.sc} · Level {criterion.level}</span>
                        <strong>{criterion.name}</strong>
                      </th>
                      <td>
                        <select
                          aria-label={`Conformance response for ${label}`}
                          value={entry?.source === "auditor" ? entry.response : ""}
                          onChange={(event) => updateVpatResponse(
                            criterion.sc,
                            { response: event.target.value as VpatConformanceResponse },
                          )}
                        >
                          <option value="">Auditor response required</option>
                          <option value="supports">Supports</option>
                          <option value="partially-supports">Partially supports</option>
                          <option value="does-not-support">Does not support</option>
                          <option value="not-applicable">Not applicable</option>
                        </select>
                      </td>
                      <td>
                        <textarea
                          rows={2}
                          aria-label={`Remarks and explanations for ${label}`}
                          value={entry?.source === "auditor" ? entry.remarks : ""}
                          onChange={(event) => updateVpatResponse(
                            criterion.sc,
                            { remarks: event.target.value },
                          )}
                          placeholder="Describe evaluated behavior, evidence, and exceptions."
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <ChecklistView
        audit={audit}
        recordActivity={recordActivity}
        onStateChange={setChecklist}
        onOpenFindings={onOpenFindings}
      />
    </div>
  );
}
