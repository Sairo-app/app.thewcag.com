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
import { buildAuditHtml, buildAuditMarkdown } from "../audit-export";
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
  const [exportFormat, setExportFormat] = useState<"md" | "html">("html");
  const [message, show] = useTransientMessage();

  useEffect(() => {
    void Promise.all([
      getStored<Finding[]>(auditStoreKey(audit.id, "findings"), []),
      getStored<ChecklistState>(auditStoreKey(audit.id, "checklist"), {}),
      listCaptures(audit.id),
      getStored<AuditSampleItem[]>(auditStoreKey(audit.id, "sampleItems"), []),
      getStored<AuditTestRun[]>(auditStoreKey(audit.id, "testRuns"), []),
    ]).then(([nextFindings, nextChecklist, nextCaptures, nextSampleItems, nextTestRuns]) => {
      const normalized = normalizeFindingReferences(nextFindings);
      setFindings(normalized.findings);
      if (normalized.changed) {
        void setStored(auditStoreKey(audit.id, "findings"), normalized.findings);
      }
      setChecklist(nextChecklist);
      setCaptures(nextCaptures);
      setSampleItems(nextSampleItems);
      setTestRuns(nextTestRuns);
    });
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
      };
      const text =
        exportFormat === "html"
          ? buildAuditHtml(exportInput)
          : buildAuditMarkdown(exportInput);
      const path = await desktop.invoke<string | null>("dialog:save-text", {
        name: `${audit.project.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "accessibility-audit"}-full-audit.${exportFormat}`,
        text,
      });
      if (!path) return;
      await recordActivity({
        kind: "exported",
        title: "Audit record exported",
        detail: `${exportFormat.toUpperCase()}, ${findings.length} findings, ${summary.reviewed} reviewed criteria`,
      });
      show(
        exportFormat === "html"
          ? "Printable HTML audit exported"
          : "Portable Markdown audit exported",
      );
    } catch (error) {
      show(messageFromError(error), true);
    }
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
    };
  }, [audit.standard, checklist, findings]);

  return (
    <div className="review-view">
      <Toast message={message} />
      <section className="review-operations">
        <div>
          <strong>Portable audit record</strong>
          <p>
            Export the evaluation plan, findings, evidence inventory, retest
            records, conclusion, and every applicable checklist decision as
            printable HTML or portable Markdown.
          </p>
        </div>
        <div className="review-export-actions">
          <select
            value={exportFormat}
            onChange={(event) =>
              setExportFormat(event.target.value as typeof exportFormat)
            }
            aria-label="Audit export format"
          >
            <option value="html">Printable HTML</option>
            <option value="md">Portable Markdown</option>
          </select>
          <Button icon={DownloadSimple} onClick={() => void exportAudit()}>
            Export audit
          </Button>
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
      <ChecklistView
        audit={audit}
        recordActivity={recordActivity}
        onStateChange={setChecklist}
        onOpenFindings={onOpenFindings}
      />
    </div>
  );
}
