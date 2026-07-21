import { useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  Check,
  CheckCircle,
  Clipboard,
  Eye,
  FileText,
  LockKey,
  ShareNetwork,
  SignIn,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  Account,
  AuditProject,
  AuditSampleItem,
  AuditTestRun,
  CaptureEntry,
  Finding,
  PublishedReport,
  WorkspaceStage,
} from "../../shared/desktop";
import { desktop, getStored, listCaptures, setStored } from "../api";
import { auditPlanProgress } from "../audit-plan";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import { Button, Field, StatusBadge, Toast } from "../components";
import { WCAG_CRITERIA } from "../data/wcag";
import { messageFromError, useTransientMessage } from "../hooks";
import { ISSUE_TYPES, parseDoc } from "../../lib/annotate/model";
import { renderDoc } from "../../lib/annotate/render";
import { normalizeFindingReferences } from "../../shared/finding-references";

type ChecklistState = Record<
  string,
  {
    result: "untested" | "pass" | "fail" | "na";
    note: string;
    findingKey?: string;
  }
>;

async function renderCapture(entry: CaptureEntry): Promise<string> {
  const [raw, image] = await Promise.all([
    desktop.invoke<string | null>("capture:read-document", { id: entry.id }),
    new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.crossOrigin = "anonymous";
      next.onload = () => resolve(next);
      next.onerror = () =>
        reject(new Error("The selected capture could not be loaded"));
      next.src = entry.assetUrl;
    }),
  ]);
  const doc = parseDoc(raw || "");
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / image.naturalWidth);
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  renderDoc(source.getContext("2d")!, image, doc?.shapes ?? [], {
    selectedId: null,
    forExport: true,
  });
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png").split(",")[1];
}

export function ShareView({
  audit,
  onAuditChange,
  recordActivity,
  onNavigate,
}: {
  audit: AuditProject;
  onAuditChange: (patch: Partial<AuditProject>) => void;
  recordActivity: RecordAuditActivity;
  onNavigate: (stage: WorkspaceStage) => void;
}) {
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const [sampleItems, setSampleItems] = useState<AuditSampleItem[]>([]);
  const [testRuns, setTestRuns] = useState<AuditTestRun[]>([]);
  const [reports, setReports] = useState<PublishedReport[]>([]);
  const [account, setAccount] = useState<Account>({ signedIn: false });
  const [captureId, setCaptureId] = useState("");
  const [title, setTitle] = useState(`${audit.project} accessibility report`);
  const [description, setDescription] = useState(
    audit.scope || `Accessibility review for ${audit.target || audit.project}.`,
  );
  const [attested, setAttested] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [message, show] = useTransientMessage(5000);
  const reportsKey = auditStoreKey(audit.id, "reports");

  useEffect(() => {
    void Promise.all([
      listCaptures(audit.id),
      getStored<Finding[]>(auditStoreKey(audit.id, "findings"), []),
      getStored<ChecklistState>(auditStoreKey(audit.id, "checklist"), {}),
      getStored<AuditSampleItem[]>(auditStoreKey(audit.id, "sampleItems"), []),
      getStored<AuditTestRun[]>(auditStoreKey(audit.id, "testRuns"), []),
      getStored<PublishedReport[]>(reportsKey, []),
      desktop.invoke<Account>("auth:account"),
    ])
      .then(([
        nextCaptures,
        nextFindings,
        nextChecklist,
        nextSampleItems,
        nextTestRuns,
        nextReports,
        nextAccount,
      ]) => {
        setCaptures(nextCaptures);
        const normalized = normalizeFindingReferences(nextFindings);
        setFindings(normalized.findings);
        if (normalized.changed) {
          void setStored(
            auditStoreKey(audit.id, "findings"),
            normalized.findings,
          );
        }
        setChecklist(nextChecklist);
        setSampleItems(nextSampleItems);
        setTestRuns(nextTestRuns);
        setReports(nextReports);
        setAccount(nextAccount);
        setCaptureId((current) => current || nextCaptures[0]?.id || "");
      })
      .catch((error) => show(messageFromError(error), true));
    return desktop.on(
      "account:changed",
      () => void desktop.invoke<Account>("auth:account").then(setAccount),
    );
  }, [audit.id]);

  const selectedCapture =
    captures.find((capture) => capture.id === captureId) ?? null;
  const activeFindings = useMemo(
    () =>
      findings.filter(
        (finding) => finding.status === "open" || finding.status === "retest",
      ),
    [findings],
  );
  const includedFindings = useMemo(
    () =>
      activeFindings.filter(
        (finding) =>
          (!finding.captureId || finding.captureId === captureId),
      ),
    [activeFindings, captureId],
  );
  const delivery = useMemo(() => {
    const plan = auditPlanProgress(audit);
    const applicable = WCAG_CRITERIA.filter(
      (criterion) =>
        audit.standard === "WCAG 2.2 AA" || criterion.level === "A",
    );
    const reviewed = applicable.filter((criterion) => {
      const result = checklist[criterion.sc]?.result;
      return result && result !== "untested";
    }).length;
    const unlinkedFailures = applicable.filter((criterion) => {
      const entry = checklist[criterion.sc];
      return (
        entry?.result === "fail" &&
        (!entry.findingKey ||
          !findings.some((finding) => finding.key === entry.findingKey))
      );
    }).length;
    const undocumentedNA = applicable.filter((criterion) => {
      const entry = checklist[criterion.sc];
      return entry?.result === "na" && !entry.note.trim();
    }).length;
    const failedCriteria = applicable.filter(
      (criterion) => checklist[criterion.sc]?.result === "fail",
    ).length;
    const sampleComplete =
      sampleItems.length > 0 &&
      sampleItems.every((item) => item.status === "complete");
    const testRunsComplete = testRuns.every((run) => run.status === "complete");
    const incompleteFindings = activeFindings.filter(
      (finding) =>
        !finding.wcag.trim() ||
        !finding.location?.trim() ||
        !finding.actualResult?.trim() ||
        !finding.expectedResult?.trim() ||
        !finding.userImpact?.trim() ||
        !finding.affectedUsers?.length ||
        !finding.severityRationale?.trim() ||
        !finding.recommendation?.trim(),
    ).length;
    const recordReady =
      plan.complete === plan.total &&
      sampleComplete &&
      testRunsComplete &&
      reviewed === applicable.length &&
      unlinkedFailures === 0 &&
      undocumentedNA === 0 &&
      incompleteFindings === 0;
    const conclusionReady =
      audit.executiveSummary.trim() &&
      audit.limitations.trim() &&
      audit.completedAt &&
      (audit.conclusion === "meets-target" ||
        audit.conclusion === "does-not-meet-target");
    const canMeetTarget =
      recordReady && failedCriteria === 0 && activeFindings.length === 0;
    return {
      plan,
      applicable: applicable.length,
      reviewed,
      unlinkedFailures,
      undocumentedNA,
      incompleteFindings,
      sampleComplete,
      sampleCount: sampleItems.length,
      testRunsComplete,
      testRunCount: testRuns.length,
      failedCriteria,
      recordReady,
      conclusionReady: Boolean(conclusionReady),
      canMeetTarget,
      conclusionConflict:
        audit.conclusion === "meets-target" && !canMeetTarget,
      fullAuditReady: recordReady && Boolean(conclusionReady),
    };
  }, [activeFindings, audit, checklist, findings, sampleItems, testRuns]);
  const ready = Boolean(
    selectedCapture &&
      title.trim() &&
      description.trim() &&
      attested &&
      includedFindings.length &&
      account.signedIn,
  );

  async function signIn() {
    try {
      await desktop.invoke("auth:sign-in");
      show("Complete sign in in your browser");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function setConclusion(conclusion: AuditProject["conclusion"]) {
    if (conclusion === "meets-target" && !delivery.canMeetTarget) {
      show(
        "The audit cannot be marked as meeting the target while coverage is incomplete or unresolved failures remain.",
        true,
      );
      return;
    }
    const completedAt =
      conclusion === "meets-target" || conclusion === "does-not-meet-target"
        ? audit.completedAt || new Date().toISOString().slice(0, 10)
        : audit.completedAt;
    onAuditChange({ conclusion, completedAt });
    try {
      await recordActivity({
        kind: "review",
        title: "Audit conclusion updated",
        detail:
          conclusion === "meets-target"
            ? `Meets ${audit.standard}`
            : conclusion === "does-not-meet-target"
              ? `Does not meet ${audit.standard}`
              : "Evaluation remains in progress",
      });
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function publish() {
    if (!ready || !selectedCapture || publishing) return;
    setPublishing(true);
    try {
      const imageBase64 = await renderCapture(selectedCapture);
      const issues = includedFindings.map((finding, index) => ({
        n: index + 1,
        sc: finding.wcag || undefined,
        label: finding.title,
        severity: finding.severity,
        note: finding.note,
      }));
      const url = await desktop.invoke<string>("report:publish", {
        title: title.trim(),
        description: description.trim(),
        issues,
        imageBase64,
      });
      if (!url)
        throw new Error("The report service did not return a share link");
      const report: PublishedReport = {
        id: crypto.randomUUID(),
        auditId: audit.id,
        captureId,
        title: title.trim(),
        url,
        findingCount: issues.length,
        createdAt: Date.now(),
      };
      const next = [report, ...reports].slice(0, 40);
      setReports(next);
      await Promise.all([
        setStored(reportsKey, next),
        desktop.invoke("clipboard:write-text", { text: url }),
        recordActivity({
          kind: "published",
          title: "Report published",
          detail: `${issues.length} findings`,
          url,
        }),
      ]);
      setPublishedUrl(url);
      show("Report published. Link copied to clipboard.");
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="share-view">
      <Toast message={message} />
      {publishedUrl ? (
        <section className="publish-success" role="status">
          <span>
            <Check size={22} weight="bold" />
          </span>
          <div>
            <strong>Report is live</strong>
            <p>
              The public link is ready and has been copied to your clipboard.
            </p>
            <code>{publishedUrl}</code>
          </div>
          <div>
            <Button
              icon={Clipboard}
              onClick={() =>
                void desktop.invoke("clipboard:write-text", {
                  text: publishedUrl,
                })
              }
            >
              Copy link
            </Button>
            <Button
              variant="primary"
              icon={ArrowSquareOut}
              onClick={() =>
                void desktop.invoke("shell:open-external", {
                  url: publishedUrl,
                })
              }
            >
              Open report
            </Button>
          </div>
        </section>
      ) : null}

      {!captures.length || !findings.length ? (
        <section className="report-prerequisite" role="status">
          <WarningCircle size={20} weight="duotone" />
          <div>
            <strong>Focused report evidence is not ready</strong>
            <p>
              Publishing requires at least one capture and one unresolved
              finding. Audit conclusion and export remain available below.
            </p>
          </div>
          <Button onClick={() => onNavigate("evidence")}>Go to evidence</Button>
        </section>
      ) : null}

      <section
        className="delivery-readiness"
        aria-labelledby="delivery-readiness-title"
      >
        <div className="delivery-readiness-heading">
          <div>
            <span className="section-label">Auditor delivery check</span>
            <h2 id="delivery-readiness-title">
              Know exactly what is ready to share
            </h2>
            <p>
              This publisher creates a focused evidence report. Only describe
              the work as a complete audit when the evaluation record below is
              complete.
            </p>
          </div>
          <StatusBadge
            tone={delivery.fullAuditReady ? "success" : "warning"}
          >
            {delivery.fullAuditReady ? "Complete audit ready" : "Focused report"}
          </StatusBadge>
        </div>
        <div className="delivery-checks">
          <div data-ready={delivery.plan.complete === delivery.plan.total}>
            {delivery.plan.complete === delivery.plan.total ? (
              <CheckCircle size={18} weight="fill" />
            ) : (
              <WarningCircle size={18} weight="fill" />
            )}
            <span>
              <strong>Evaluation plan</strong>
              <small>
                {delivery.plan.complete} of {delivery.plan.total} core fields
                complete
              </small>
            </span>
          </div>
          <div data-ready={delivery.sampleComplete}>
            {delivery.sampleComplete ? (
              <CheckCircle size={18} weight="fill" />
            ) : (
              <WarningCircle size={18} weight="fill" />
            )}
            <span>
              <strong>Representative sample</strong>
              <small>
                {!delivery.sampleCount
                  ? "No structured sample items"
                  : delivery.sampleComplete
                    ? `${delivery.sampleCount} sample items tested`
                    : "Sample testing is still incomplete"}
              </small>
            </span>
          </div>
          <div data-ready={delivery.testRunsComplete}>
            {delivery.testRunsComplete ? (
              <CheckCircle size={18} weight="fill" />
            ) : (
              <WarningCircle size={18} weight="fill" />
            )}
            <span>
              <strong>Guided test runs</strong>
              <small>
                {!delivery.testRunCount
                  ? "No guided runs were added"
                  : delivery.testRunsComplete
                    ? `${delivery.testRunCount} test runs complete`
                    : "Recorded test runs are still incomplete"}
              </small>
            </span>
          </div>
          <div
            data-ready={
              delivery.reviewed === delivery.applicable &&
              delivery.undocumentedNA === 0
            }
          >
            {delivery.reviewed === delivery.applicable &&
            delivery.undocumentedNA === 0 ? (
              <CheckCircle size={18} weight="fill" />
            ) : (
              <WarningCircle size={18} weight="fill" />
            )}
            <span>
              <strong>Applicable criteria</strong>
              <small>
                {delivery.reviewed !== delivery.applicable
                  ? `${delivery.reviewed} of ${delivery.applicable} decisions recorded`
                  : delivery.undocumentedNA
                    ? `${delivery.undocumentedNA} N/A decisions need reasons`
                    : "Every decision is recorded with required rationale"}
              </small>
            </span>
          </div>
          <div data-ready={delivery.unlinkedFailures === 0}>
            {delivery.unlinkedFailures === 0 ? (
              <CheckCircle size={18} weight="fill" />
            ) : (
              <WarningCircle size={18} weight="fill" />
            )}
            <span>
              <strong>Failure traceability</strong>
              <small>
                {delivery.unlinkedFailures
                  ? `${delivery.unlinkedFailures} failed criteria need findings`
                  : "Every failed criterion is linked"}
              </small>
            </span>
          </div>
          <div data-ready={delivery.incompleteFindings === 0}>
            {delivery.incompleteFindings === 0 ? (
              <CheckCircle size={18} weight="fill" />
            ) : (
              <WarningCircle size={18} weight="fill" />
            )}
            <span>
              <strong>Finding completeness</strong>
              <small>
                {delivery.incompleteFindings
                  ? `${delivery.incompleteFindings} included findings need detail`
                  : "Included findings have core audit details"}
              </small>
            </span>
          </div>
          <div data-ready={delivery.conclusionReady}>
            {delivery.conclusionReady ? (
              <CheckCircle size={18} weight="fill" />
            ) : (
              <WarningCircle size={18} weight="fill" />
            )}
            <span>
              <strong>Audit conclusion</strong>
              <small>
                {delivery.conclusionReady
                  ? "Summary, limitations, outcome, and date recorded"
                  : "Final summary and conclusion are still needed"}
              </small>
            </span>
          </div>
        </div>
      </section>

      <section className="audit-conclusion" aria-labelledby="audit-conclusion-title">
        <div className="audit-conclusion-heading">
          <div>
            <h2 id="audit-conclusion-title">Audit conclusion</h2>
            <p>
              Summarize the evaluation and record an outcome only after the
              underlying audit record supports it.
            </p>
          </div>
          <StatusBadge tone={delivery.conclusionReady ? "success" : "neutral"}>
            {delivery.conclusionReady ? "Recorded" : "Working draft"}
          </StatusBadge>
        </div>
        <div className="audit-conclusion-form">
          <Field label="Outcome">
            <select
              value={audit.conclusion}
              onChange={(event) =>
                void setConclusion(
                  event.target.value as AuditProject["conclusion"],
                )
              }
            >
              <option value="not-set">Not set</option>
              <option value="in-progress">Evaluation in progress</option>
              <option value="does-not-meet-target">
                Does not meet {audit.standard}
              </option>
              <option value="meets-target" disabled={!delivery.canMeetTarget}>
                Meets {audit.standard}
              </option>
            </select>
          </Field>
          <Field label="Evaluation completion date">
            <input
              type="date"
              value={audit.completedAt}
              onChange={(event) =>
                onAuditChange({ completedAt: event.target.value })
              }
            />
          </Field>
          <Field
            label="Executive summary"
            hint="State what was evaluated, the most important outcome, and the remediation priority."
            className="audit-conclusion-wide"
          >
            <textarea
              rows={4}
              value={audit.executiveSummary}
              onChange={(event) =>
                onAuditChange({ executiveSummary: event.target.value })
              }
              placeholder="The evaluation covered the critical purchase journey across the documented sample and environments."
            />
          </Field>
          <Field
            label="Limitations"
            hint="Document unavailable states, blocked tests, third-party exclusions, or other constraints. Enter No known limitations when appropriate."
            className="audit-conclusion-wide"
          >
            <textarea
              rows={3}
              value={audit.limitations}
              onChange={(event) =>
                onAuditChange({ limitations: event.target.value })
              }
              placeholder="The third-party payment iframe was outside the evaluation scope."
            />
          </Field>
        </div>
        {!delivery.canMeetTarget ? (
          <div className="conclusion-safeguard">
            <WarningCircle size={18} weight="fill" />
            <p>
              {delivery.conclusionConflict
                ? "The recorded outcome conflicts with the current audit record. Change the outcome or resolve the incomplete coverage and unresolved failures before export."
                : "Meeting the target remains unavailable until the plan, sample, guided test runs, criterion review, finding details, and all unresolved failures are complete."}
            </p>
          </div>
        ) : null}
      </section>

      <div className="report-layout">
        <section className="report-draft">
          <div className="report-section-heading">
            <span>
              <FileText size={19} weight="duotone" />
            </span>
            <div>
              <h2>Report draft</h2>
              <p>Review every public detail before publishing.</p>
            </div>
            <StatusBadge tone="neutral">Draft</StatusBadge>
          </div>
          <Field label="Evidence capture">
            <select
              value={captureId}
              onChange={(event) => setCaptureId(event.target.value)}
            >
              {captures.map((capture) => (
                <option key={capture.id} value={capture.id}>
                  {capture.title} · {capture.issues} issues
                </option>
              ))}
            </select>
          </Field>
          <Field label="Report title">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
            />
          </Field>
          <Field label="Public summary" hint={`${description.length}/600`}>
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value.slice(0, 600))
              }
              rows={5}
            />
          </Field>
          <div className="access-row">
            <LockKey size={19} weight="duotone" />
            <span>
              <strong>Anyone with the link</strong>
              <small>
                The link is unlisted. Recipients do not need an account.
              </small>
            </span>
            <StatusBadge tone="warning">Public link</StatusBadge>
          </div>
          <label className="attestation">
            <input
              type="checkbox"
              checked={attested}
              onChange={(event) => setAttested(event.target.checked)}
            />
            <span>
              <strong>
                I reviewed this capture for sensitive information.
              </strong>
              <small>
                Redactions are baked into the published image and cannot be
                reversed.
              </small>
            </span>
          </label>
        </section>

        <aside className="report-preview" aria-label="Report preview">
          <div className="report-section-heading">
            <span>
              <Eye size={19} weight="duotone" />
            </span>
            <div>
              <h2>Included evidence</h2>
              <p>Exactly what recipients will see.</p>
            </div>
          </div>
          {selectedCapture ? (
            <div className="report-capture">
              <img
                src={selectedCapture.thumbnailUrl || selectedCapture.assetUrl}
                alt={`Selected evidence: ${selectedCapture.title}`}
              />
              <span>
                {selectedCapture.width} × {selectedCapture.height}
              </span>
            </div>
          ) : null}
          <div className="included-findings">
            <div>
              <strong>{includedFindings.length} findings included</strong>
              <small>Verified fixes and accepted risks are excluded</small>
            </div>
            {includedFindings.slice(0, 6).map((finding) => (
              <article key={finding.key}>
                <i className={`severity-${finding.severity}`} />
                <span>
                  <strong>{finding.title}</strong>
                  <small>{finding.wcag || ISSUE_TYPES.at(-1)?.label}</small>
                </span>
                <StatusBadge
                  tone={
                    finding.severity === "blocker"
                      ? "danger"
                      : finding.severity === "major"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {finding.severity}
                </StatusBadge>
              </article>
            ))}
            {includedFindings.length > 6 ? (
              <p>And {includedFindings.length - 6} more findings</p>
            ) : null}
          </div>
          {!account.signedIn ? (
            <div className="sign-in-callout">
              <WarningCircle size={20} weight="duotone" />
              <div>
                <strong>Sign in to publish</strong>
                <p>Your local audit remains available without an account.</p>
              </div>
              <Button icon={SignIn} onClick={() => void signIn()}>
                Sign in
              </Button>
            </div>
          ) : (
            <div className="signed-in-line">
              <Check size={16} weight="bold" />
              <span>Publishing as {account.email}</span>
            </div>
          )}
          <Button
            className="publish-button"
            variant="primary"
            icon={ShareNetwork}
            disabled={!ready || publishing}
            onClick={() => void publish()}
          >
            {publishing ? "Publishing report" : "Publish report"}
          </Button>
          {!selectedCapture ? (
            <p className="publish-hint">
              Add an evidence capture before publishing.
            </p>
          ) : !attested ? (
            <p className="publish-hint">
              Confirm the privacy review to enable publishing.
            </p>
          ) : !includedFindings.length ? (
            <p className="publish-hint">
              This capture has no included findings.
            </p>
          ) : null}
        </aside>
      </div>

      {reports.length ? (
        <section className="report-history">
          <div className="section-heading">
            <h2>Published reports</h2>
            <button
              onClick={() =>
                void desktop.invoke("shell:open-external", {
                  url: "https://app.thewcag.com/screenshots",
                })
              }
            >
              Manage online
            </button>
          </div>
          {reports.slice(0, 5).map((report) => (
            <button
              key={report.id}
              onClick={() =>
                void desktop.invoke("shell:open-external", { url: report.url })
              }
            >
              <ShareNetwork size={17} />
              <span>
                <strong>{report.title}</strong>
                <small>
                  {report.findingCount} findings ·{" "}
                  {new Date(report.createdAt).toLocaleDateString()}
                </small>
              </span>
              <ArrowSquareOut size={16} />
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
