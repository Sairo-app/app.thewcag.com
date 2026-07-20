import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  ClipboardText,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import type { AuditProject, Finding } from "../../shared/desktop";
import { getStored } from "../api";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import { ChecklistView } from "./ChecklistView";
import { WCAG_CRITERIA } from "../data/wcag";

type ChecklistState = Record<
  string,
  { result: "untested" | "pass" | "fail" | "na"; note: string }
>;

export function ReviewView({
  audit,
  recordActivity,
}: {
  audit: AuditProject;
  recordActivity: RecordAuditActivity;
}) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [checklist, setChecklist] = useState<ChecklistState>({});

  useEffect(() => {
    void Promise.all([
      getStored<Finding[]>(auditStoreKey(audit.id, "findings"), []),
      getStored<ChecklistState>(auditStoreKey(audit.id, "checklist"), {}),
    ]).then(([nextFindings, nextChecklist]) => {
      setFindings(nextFindings);
      setChecklist(nextChecklist);
    });
  }, [audit.id]);

  const summary = useMemo(() => {
    const reviewed = WCAG_CRITERIA.filter(
      (criterion) =>
        checklist[criterion.sc]?.result &&
        checklist[criterion.sc]?.result !== "untested",
    ).length;
    return {
      reviewed,
      failures: findings.filter((finding) => finding.status === "open").length,
      blockers: findings.filter(
        (finding) =>
          finding.status === "open" && finding.severity === "blocker",
      ).length,
      notes: Object.values(checklist).filter((entry) => entry.note.trim())
        .length,
    };
  }, [checklist, findings]);

  return (
    <div className="review-view">
      <section className="review-summary" aria-label="Review summary">
        <div>
          <span className="review-icon review-icon-orange">
            <WarningCircle size={20} weight="duotone" />
          </span>
          <strong>{summary.failures}</strong>
          <small>open findings</small>
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
      <ChecklistView
        audit={audit}
        recordActivity={recordActivity}
        onStateChange={setChecklist}
      />
    </div>
  );
}
