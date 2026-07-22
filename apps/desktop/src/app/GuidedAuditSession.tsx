import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle,
  ClipboardText,
  NotePencil,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  AuditSampleItem,
  AuditTestRun,
  CaptureEntry,
  Finding,
  WorkspaceStage,
} from "../shared/desktop";
import { desktop, getStored, listCaptures, setStored } from "./api";
import { findNextAuditSession, type AuditSessionSelection } from "./audit-coverage";
import { auditStoreKey, type RecordAuditActivity } from "./audits";
import { Button, Field, StatusBadge, Toast } from "./components";
import {
  FindingEditorDialog,
  type FindingEditorValue,
} from "./FindingEditorDialog";
import { messageFromError, useTransientMessage } from "./hooks";
import { nextFindingReference } from "../shared/finding-references";
import { findingStatusHistoryAfterChange } from "../shared/finding-lifecycle";
import { auditTestRunComplete } from "./audit-plan";

const SAMPLE_STATUS_LABELS: Record<AuditSampleItem["status"], string> = {
  planned: "Planned",
  "in-progress": "In progress",
  complete: "Tested",
  blocked: "Blocked",
};

const RUN_STATUS_LABELS: Record<AuditTestRun["status"], string> = {
  planned: "Planned",
  "in-progress": "In progress",
  complete: "Complete",
  blocked: "Blocked",
};

function statusTone(status: AuditSampleItem["status"] | AuditTestRun["status"]) {
  if (status === "complete") return "success" as const;
  if (status === "blocked") return "danger" as const;
  if (status === "in-progress") return "warning" as const;
  return "neutral" as const;
}

export function GuidedAuditSession({
  auditId,
  initialSession,
  onNavigate,
  recordActivity,
}: {
  auditId: string;
  initialSession: AuditSessionSelection | null;
  onNavigate: (stage: WorkspaceStage) => void;
  recordActivity: RecordAuditActivity;
}) {
  const [sampleItems, setSampleItems] = useState<AuditSampleItem[]>([]);
  const [testRuns, setTestRuns] = useState<AuditTestRun[]>([]);
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selection, setSelection] = useState<AuditSessionSelection | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSeed, setEditorSeed] = useState<Partial<FindingEditorValue>>({});
  const [message, show] = useTransientMessage(5000);
  const sampleWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const runWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const findingWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const sampleKey = auditStoreKey(auditId, "sampleItems");
  const runsKey = auditStoreKey(auditId, "testRuns");
  const findingsKey = auditStoreKey(auditId, "findings");

  function persistSamples(next: AuditSampleItem[]) {
    const request = sampleWriteQueue.current.then(() => setStored(sampleKey, next));
    sampleWriteQueue.current = request.catch(() => undefined);
    return request;
  }

  function persistRuns(next: AuditTestRun[]) {
    const request = runWriteQueue.current.then(() => setStored(runsKey, next));
    runWriteQueue.current = request.catch(() => undefined);
    return request;
  }

  function persistFindings(next: Finding[]) {
    const request = findingWriteQueue.current.then(() => setStored(findingsKey, next));
    findingWriteQueue.current = request.catch(() => undefined);
    return request;
  }

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setSelection(null);
    void Promise.all([
      getStored<AuditSampleItem[]>(sampleKey, []),
      getStored<AuditTestRun[]>(runsKey, []),
      listCaptures(auditId),
      getStored<Finding[]>(findingsKey, []),
    ])
      .then(([nextSamples, nextRuns, nextCaptures, nextFindings]) => {
        if (cancelled) return;
        setSampleItems(nextSamples);
        setTestRuns(nextRuns);
        setCaptures(nextCaptures);
        setFindings(nextFindings);
        const requestedSample = initialSession && nextSamples.some(
          (sample) => sample.id === initialSession.sampleItemId,
        );
        if (requestedSample) {
          setSelection({
            sampleItemId: initialSession.sampleItemId,
            testRunId: nextRuns.some((run) => run.id === initialSession.testRunId)
              ? initialSession.testRunId
              : undefined,
          });
        } else {
          const activeRun = nextRuns.find((run) => run.status === "in-progress");
          const activeSample = activeRun?.sampleItemId
            ? nextSamples.find((sample) => sample.id === activeRun.sampleItemId)
            : nextSamples.find((sample) => sample.status === "in-progress");
          if (activeSample) {
            setSelection({ sampleItemId: activeSample.id, testRunId: activeRun?.id });
          }
        }
        setLoaded(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoaded(true);
          show(messageFromError(error), true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auditId, findingsKey, initialSession?.sampleItemId, initialSession?.testRunId, runsKey, sampleKey]);

  useEffect(
    () => desktop.on<CaptureEntry>("capture:saved", (entry) => {
      if (entry.auditId !== auditId) return;
      setCaptures((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
    }),
    [auditId],
  );

  const sample = selection
    ? sampleItems.find((item) => item.id === selection.sampleItemId)
    : undefined;
  const run = selection?.testRunId
    ? testRuns.find((item) => item.id === selection.testRunId)
    : undefined;
  const contextCaptures = useMemo(
    () => sample
      ? captures.filter((capture) =>
          capture.sampleItemId === sample.id && (!run || capture.testRunId === run.id),
        )
      : [],
    [captures, run, sample],
  );
  const contextFindings = useMemo(
    () => sample
      ? findings.filter((finding) =>
          finding.sampleItemId === sample.id && (!run || finding.testRunId === run.id),
        )
      : [],
    [findings, run, sample],
  );
  const completedSteps = run?.steps.filter(
    (step) => step.complete && step.observation.trim(),
  ).length ?? 0;
  const runReady = !run || auditTestRunComplete(run);
  const nextSelection = findNextAuditSession(sampleItems, testRuns);
  const needsActivation = Boolean(
    sample &&
    (sample.status === "planned" || run?.status === "planned" || (run && run.sampleItemId !== sample.id)),
  );

  async function activateSession(next = nextSelection) {
    if (!next) {
      show("Every available sample and guided run is complete.");
      return;
    }
    const requestedRun = next.testRunId
      ? testRuns.find((item) => item.id === next.testRunId)
      : undefined;
    if (
      requestedRun?.sampleItemId &&
      requestedRun.sampleItemId !== next.sampleItemId
    ) {
      show("That guided run is already linked to another sample. Add a separate run in Plan for this sample.", true);
      return;
    }
    const now = Date.now();
    const nextSamples = sampleItems.map((item) =>
      item.id === next.sampleItemId && item.status === "planned"
        ? { ...item, status: "in-progress" as const, modifiedAt: now }
        : item,
    );
    const nextRuns = testRuns.map((item) =>
      item.id === next.testRunId
        ? {
            ...item,
            sampleItemId: next.sampleItemId,
            status: item.status === "planned" || (item.status === "complete" && !auditTestRunComplete(item))
              ? "in-progress" as const
              : item.status,
            modifiedAt: now,
          }
        : item,
    );
    try {
      await Promise.all([persistSamples(nextSamples), persistRuns(nextRuns)]);
      setSampleItems(nextSamples);
      setTestRuns(nextRuns);
      setSelection(next);
      await recordActivity({
        kind: "updated",
        title: "Guided audit session started",
        detail: `${nextSamples.find((item) => item.id === next.sampleItemId)?.label ?? "Sample"}${next.testRunId ? ` · ${nextRuns.find((item) => item.id === next.testRunId)?.title ?? "Guided run"}` : ""}`,
      });
      show("Guided session ready");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  function patchSample(patch: Partial<AuditSampleItem>) {
    if (!sample) return;
    if (patch.status === "complete" && !runReady) {
      show("Complete the linked guided run before marking this sample tested.", true);
      return;
    }
    const next = sampleItems.map((item) =>
      item.id === sample.id ? { ...item, ...patch, modifiedAt: Date.now() } : item,
    );
    setSampleItems(next);
    void persistSamples(next).catch((error) => show(messageFromError(error), true));
  }

  function patchRun(patch: Partial<AuditTestRun>) {
    if (!run) return;
    if (
      patch.status === "complete" &&
      !run.steps.every((step) => step.complete && step.observation.trim())
    ) {
      show("Complete every step and add its observation before closing this run.", true);
      return;
    }
    const next = testRuns.map((item) => {
      if (item.id !== run.id) return item;
      const updated = { ...item, ...patch, sampleItemId: sample?.id, modifiedAt: Date.now() };
      if (patch.steps && updated.status !== "blocked") {
        const complete = patch.steps.every(
          (step) => step.complete && step.observation.trim(),
        );
        const started = patch.steps.some(
          (step) => step.complete || step.observation.trim(),
        );
        updated.status = complete ? "complete" : started ? "in-progress" : "planned";
      }
      return updated;
    });
    setTestRuns(next);
    void persistRuns(next).catch((error) => show(messageFromError(error), true));
  }

  async function captureEvidence() {
    if (!sample) return;
    setCaptureBusy(true);
    try {
      await desktop.invoke("capture:begin", {
        mode: "capture",
        auditId,
        sampleItemId: sample.id,
        testRunId: run?.id,
      });
      show("Drag around the evidence. It will be linked to this session automatically.");
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setCaptureBusy(false);
    }
  }

  function openFindingEditor() {
    if (!sample) return;
    setEditorSeed({
      location: sample.location,
      actualResult: run?.steps
        .filter((step) => step.observation.trim())
        .map((step) => `${step.label}: ${step.observation.trim()}`)
        .join("\n") ?? "",
      reproductionSteps: run?.steps.map((step) => step.label) ?? [],
      note: run?.notes ?? sample.notes,
    });
    setEditorOpen(true);
  }

  async function saveFinding(value: FindingEditorValue) {
    if (!sample) return;
    const now = Date.now();
    const finding: Finding = {
      key: `manual-${crypto.randomUUID()}`,
      reference: nextFindingReference(findings),
      sampleItemId: sample.id,
      testRunId: run?.id,
      title: value.title.trim(),
      wcag: value.wcag.trim(),
      severity: value.severity,
      status: value.status,
      note: value.note.trim(),
      location: value.location.trim(),
      evidenceCaptureIds: value.evidenceCaptureIds,
      captureId: value.evidenceCaptureIds[0] || value.captureId || undefined,
      beforeCaptureId: value.beforeCaptureId || undefined,
      afterCaptureId: value.afterCaptureId || undefined,
      comparisonNote: value.comparisonNote.trim(),
      occurrences: value.occurrences.map((occurrence) => ({
        ...occurrence,
        location: occurrence.location.trim(),
        note: occurrence.note.trim(),
      })),
      owner: value.owner.trim(),
      ticket: value.ticket.trim(),
      ticketLink: value.ticketLink,
      dueDate: value.dueDate,
      evidenceLink: value.evidenceLink.trim(),
      riskAcceptance: value.riskAcceptance.trim(),
      description: value.description.trim(),
      actualResult: value.actualResult.trim(),
      expectedResult: value.expectedResult.trim(),
      userImpact: value.userImpact.trim(),
      affectedUsers: value.affectedUsers,
      severityRationale: value.severityRationale.trim(),
      recommendation: value.recommendation.trim(),
      reproductionSteps: value.reproductionSteps,
      retestNote: value.retestNote.trim(),
      statusHistory: findingStatusHistoryAfterChange(undefined, value.status, now),
      createdAt: now,
      modifiedAt: now,
      schemaVersion: 2,
      source: "manual",
    };
    const next = [finding, ...findings];
    try {
      await persistFindings(next);
      setFindings(next);
      setEditorOpen(false);
      await recordActivity({
        kind: "finding",
        title: "Session finding created",
        detail: finding.title,
      });
      show("Finding linked to this guided session");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function completeSample() {
    if (!sample || !runReady) return;
    const next = sampleItems.map((item) =>
      item.id === sample.id
        ? { ...item, status: "complete" as const, modifiedAt: Date.now() }
        : item,
    );
    try {
      await persistSamples(next);
      setSampleItems(next);
    } catch (error) {
      show(messageFromError(error), true);
      return;
    }
    try {
      await recordActivity({
        kind: "updated",
        title: "Sample testing completed",
        detail: sample.label,
      });
      show("Sample marked tested. Start the next test when ready.");
    } catch (error) {
      show(`The sample was completed, but its activity entry was not saved: ${messageFromError(error)}`, true);
    }
  }

  return (
    <section className="guided-session" aria-labelledby="guided-session-title">
      <Toast message={message} />
      <div className="guided-session-heading">
        <div className="guided-session-icon"><ClipboardText size={24} weight="duotone" /></div>
        <div>
          <span className="section-label">Guided audit session</span>
          <h2 id="guided-session-title">Keep the current test in one place</h2>
          <p>Select the next planned sample and script, record each observation, then attach evidence and findings to the same context.</p>
        </div>
        <div className="guided-progress" aria-label="Guided audit progress">
          <strong>{sampleItems.filter((item) => item.status === "complete").length}/{sampleItems.length}</strong>
          <span>samples tested</span>
        </div>
      </div>

      {!loaded ? (
        <div className="guided-session-empty"><span>Loading the current audit plan…</span></div>
      ) : !sampleItems.length ? (
        <div className="guided-session-empty">
          <WarningCircle size={22} weight="duotone" />
          <div><strong>Plan the representative sample first</strong><p>The session uses the exact locations approved in Plan.</p></div>
          <Button icon={ArrowRight} onClick={() => onNavigate("plan")}>Open plan</Button>
        </div>
      ) : !selection || !sample ? (
        <div className="guided-launch">
          <div>
            {nextSelection ? <ClipboardText size={25} weight="duotone" /> : <CheckCircle size={25} weight="fill" />}
            <span>
              <strong>{nextSelection ? "Ready for the next planned test" : "All planned testing is complete"}</strong>
              <p>{nextSelection ? "One action will select and start the next available sample and guided run." : "Use the coverage map in Plan to review traceability or reopen a completed test."}</p>
            </span>
          </div>
          {nextSelection ? (
            <Button variant="primary" icon={ArrowRight} onClick={() => void activateSession()}>
              Start next test
            </Button>
          ) : (
            <Button icon={CheckCircle} onClick={() => onNavigate("plan")}>Review coverage</Button>
          )}
        </div>
      ) : (
        <div className="guided-session-body">
          <div className="guided-context-bar">
            <Field label="Current sample">
              <select
                value={sample.id}
                onChange={(event) => {
                  const sampleItemId = event.target.value;
                  setSelection({
                    sampleItemId,
                    testRunId: !run?.sampleItemId || run.sampleItemId === sampleItemId
                      ? selection.testRunId
                      : undefined,
                  });
                }}
              >
                {sampleItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Guided test">
              <select
                value={run?.id ?? ""}
                onChange={(event) => setSelection({
                  sampleItemId: sample.id,
                  testRunId: event.target.value || undefined,
                })}
              >
                <option value="">Sample review without a script</option>
                {testRuns
                  .filter((item) => !item.sampleItemId || item.sampleItemId === sample.id)
                  .map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </Field>
            <Button variant="primary" icon={ArrowRight} disabled={!needsActivation} onClick={() => void activateSession(selection)}>
              {needsActivation ? "Begin session" : "Session active"}
            </Button>
          </div>

          <div className="guided-location">
            <div>
              <span>Test location</span>
              <strong>{sample.label}</strong>
              <p>{sample.location}</p>
            </div>
            <StatusBadge tone={statusTone(sample.status)}>{SAMPLE_STATUS_LABELS[sample.status]}</StatusBadge>
          </div>

          <div className="guided-columns">
            <div className="guided-test-panel">
              {run ? (
                <>
                  <div className="guided-panel-heading">
                    <div>
                      <span>{run.category}</span>
                      <h3>{run.title}</h3>
                      <p>{completedSteps} of {run.steps.length} steps have an observation.</p>
                    </div>
                    <StatusBadge tone={statusTone(run.status)}>{RUN_STATUS_LABELS[run.status]}</StatusBadge>
                  </div>
                  <progress value={completedSteps} max={Math.max(1, run.steps.length)}>{completedSteps} of {run.steps.length}</progress>
                  <ol className="guided-step-list">
                    {run.steps.map((step, index) => (
                      <li key={step.id} data-complete={step.complete && Boolean(step.observation.trim())}>
                        <label>
                          <input
                            type="checkbox"
                            checked={step.complete}
                            onChange={(event) => patchRun({
                              steps: run.steps.map((item) => item.id === step.id
                                ? { ...item, complete: event.target.checked }
                                : item),
                            })}
                          />
                          <span><b>{String(index + 1).padStart(2, "0")}</b>{step.label}</span>
                        </label>
                        <textarea
                          rows={2}
                          value={step.observation}
                          onChange={(event) => patchRun({
                            steps: run.steps.map((item) => item.id === step.id
                              ? { ...item, observation: event.target.value }
                              : item),
                          })}
                          aria-label={`Observation for ${step.label}`}
                          placeholder="Record what happened, the environment, and any evidence reference"
                        />
                        {step.complete && !step.observation.trim() ? <small>Add an observation to complete this step.</small> : null}
                      </li>
                    ))}
                  </ol>
                  <Field label="Run notes" hint="Record blockers, deviations, or coverage limitations.">
                    <textarea rows={3} value={run.notes} onChange={(event) => patchRun({ notes: event.target.value })} />
                  </Field>
                  <Field label="Run status">
                    <select value={run.status} onChange={(event) => patchRun({ status: event.target.value as AuditTestRun["status"] })}>
                      {(Object.keys(RUN_STATUS_LABELS) as AuditTestRun["status"][]).map((value) => (
                        <option key={value} value={value}>{RUN_STATUS_LABELS[value]}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <div className="guided-no-run">
                  <ClipboardText size={23} weight="duotone" />
                  <div><strong>Sample-led review</strong><p>Use the inspection tools below, record scope notes here, and attach evidence or findings to this sample.</p></div>
                  <Field label="Sample notes">
                    <textarea rows={4} value={sample.notes} onChange={(event) => patchSample({ notes: event.target.value })} />
                  </Field>
                </div>
              )}
            </div>

            <aside className="guided-record-panel" aria-label="Current session records">
              <div className="guided-record-heading">
                <span>Session record</span>
                <strong>{contextCaptures.length + contextFindings.length}</strong>
              </div>
              <div className="guided-record-metrics">
                <button type="button" onClick={() => onNavigate("evidence")}><Camera size={18} /><strong>{contextCaptures.length}</strong><span>captures</span></button>
                <button type="button" onClick={() => onNavigate("evidence")}><NotePencil size={18} /><strong>{contextFindings.length}</strong><span>findings</span></button>
              </div>
              <Button variant="primary" icon={NotePencil} onClick={openFindingEditor}>Create finding</Button>
              <Button icon={Camera} disabled={captureBusy} onClick={() => void captureEvidence()}>
                {captureBusy ? "Opening capture" : "Capture only"}
              </Button>
              <p>Add evidence inside the finding editor to link it immediately. Capture only keeps an unassigned image in the local library for later use.</p>
            </aside>
          </div>

          <div className="guided-session-actions">
            <label>
              <span>Sample status</span>
              <select value={sample.status} onChange={(event) => patchSample({ status: event.target.value as AuditSampleItem["status"] })}>
                {(Object.keys(SAMPLE_STATUS_LABELS) as AuditSampleItem["status"][]).map((value) => (
                  <option key={value} value={value}>{SAMPLE_STATUS_LABELS[value]}</option>
                ))}
              </select>
            </label>
            <span>{run && !runReady ? "Complete every step with an observation before closing this sample." : "The current test record is ready to close."}</span>
            <Button icon={CheckCircle} disabled={!runReady || sample.status === "complete"} onClick={() => void completeSample()}>
              Mark sample tested
            </Button>
            <Button
              variant="primary"
              icon={ArrowRight}
              disabled={!nextSelection || (sample.status !== "complete" && sample.status !== "blocked")}
              onClick={() => void activateSession()}
            >
              Start next test
            </Button>
          </div>
        </div>
      )}

      <FindingEditorDialog
        open={editorOpen}
        finding={null}
        captures={contextCaptures}
        auditId={auditId}
        sampleItemId={sample?.id}
        testRunId={run?.id}
        initialValue={editorSeed}
        onClose={() => setEditorOpen(false)}
        onSave={(value) => void saveFinding(value)}
      />
    </section>
  );
}
