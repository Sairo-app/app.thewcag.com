import { useEffect, useId, useRef, useState } from "react";
import { ArrowClockwise, ArrowSquareOut, Camera, FloppyDisk, GearSix, LinkSimple, Plus, Ticket, Trash, X } from "./Icon";
import type { AffectedUser } from "@accessibility-build/audit-contracts";
import type {
  CaptureEntry,
  CaptureSavedEvent,
  Finding,
  FindingOccurrence,
  FindingTicketLink,
  TicketConnectorConfiguration,
  TicketConnectorId,
  TicketConnectorPublicConfig,
  TicketExternalSnapshot,
  TicketSourceField,
} from "../shared/desktop";
import {
  DEFAULT_TICKET_FIELD_MAPPINGS,
  TICKET_FIELD_LABELS,
  TICKET_SOURCE_FIELDS,
  resolveTicketConflict,
  reviewTicketSync,
  ticketFieldValuesFromFinding,
} from "../shared/ticket-connectors";
import { findingStatusHistoryAfterChange } from "../shared/finding-lifecycle";
import { findingPrimaryEvidenceCaptureIds } from "../shared/finding-evidence";
import { desktop } from "./api";
import { Button, Field } from "./components";
import { WCAG_CRITERIA } from "./data/wcag";
import {
  cancellationMatchesPendingSession,
  captureMatchesPendingSession,
  type FindingCaptureRole,
  type PendingFindingCapture,
} from "./capture-session";

const AFFECTED_USER_LABELS: Record<AffectedUser, string> = {
  "screen-reader": "Screen reader",
  keyboard: "Keyboard",
  "low-vision": "Low vision",
  "color-vision": "Color vision",
  cognitive: "Cognitive",
  motor: "Motor",
  "voice-control": "Voice control",
  "deaf-hard-of-hearing": "Deaf or hard of hearing",
  "all-users": "All users",
  other: "Other",
};

export interface FindingEditorValue {
  title: string;
  wcag: string;
  severity: Finding["severity"];
  status: Finding["status"];
  location: string;
  evidenceCaptureIds: string[];
  captureId: string;
  beforeCaptureId: string;
  afterCaptureId: string;
  comparisonNote: string;
  occurrences: FindingOccurrence[];
  owner: string;
  ticket: string;
  ticketLink?: FindingTicketLink;
  dueDate: string;
  evidenceLink: string;
  riskAcceptance: string;
  description: string;
  actualResult: string;
  expectedResult: string;
  userImpact: string;
  affectedUsers: AffectedUser[];
  severityRationale: string;
  recommendation: string;
  reproductionSteps: string[];
  note: string;
  retestNote: string;
}

const EMPTY: FindingEditorValue = {
  title: "",
  wcag: "",
  severity: "major",
  status: "open",
  location: "",
  evidenceCaptureIds: [],
  captureId: "",
  beforeCaptureId: "",
  afterCaptureId: "",
  comparisonNote: "",
  occurrences: [],
  owner: "",
  ticket: "",
  dueDate: "",
  evidenceLink: "",
  riskAcceptance: "",
  description: "",
  actualResult: "",
  expectedResult: "",
  userImpact: "",
  affectedUsers: [],
  severityRationale: "",
  recommendation: "",
  reproductionSteps: [],
  note: "",
  retestNote: "",
};

function valueFromFinding(
  finding: Finding | null,
  initialValue?: Partial<FindingEditorValue>,
): FindingEditorValue {
  if (!finding) return { ...EMPTY, ...initialValue };
  return {
    title: finding.title,
    wcag: finding.wcag,
    severity: finding.severity,
    status: finding.status,
    location: finding.location ?? "",
    evidenceCaptureIds: findingPrimaryEvidenceCaptureIds(finding),
    captureId: finding.captureId ?? "",
    beforeCaptureId: finding.beforeCaptureId ?? "",
    afterCaptureId: finding.afterCaptureId ?? "",
    comparisonNote: finding.comparisonNote ?? "",
    occurrences: finding.occurrences ?? [],
    owner: finding.owner ?? "",
    ticket: finding.ticket ?? "",
    ticketLink: finding.ticketLink,
    dueDate: finding.dueDate ?? "",
    evidenceLink: finding.evidenceLink ?? "",
    riskAcceptance: finding.riskAcceptance ?? "",
    description: finding.description ?? finding.note,
    actualResult: finding.actualResult ?? "",
    expectedResult: finding.expectedResult ?? "",
    userImpact: finding.userImpact ?? "",
    affectedUsers: finding.affectedUsers ?? [],
    severityRationale: finding.severityRationale ?? "",
    recommendation: finding.recommendation ?? "",
    reproductionSteps: finding.reproductionSteps ?? [],
    note: finding.note,
    retestNote: finding.retestNote ?? "",
  };
}

function findingWithEditorValue(finding: Finding, value: FindingEditorValue): Finding {
  const changedAt = Date.now();
  const evidenceCaptureIds = [...new Set([
    ...value.evidenceCaptureIds,
    ...(value.captureId ? [value.captureId] : []),
  ])];
  return {
    ...finding,
    ...value,
    title: value.title.trim(),
    wcag: value.wcag.trim(),
    description: value.description.trim(),
    actualResult: value.actualResult.trim(),
    expectedResult: value.expectedResult.trim(),
    userImpact: value.userImpact.trim(),
    owner: value.owner.trim(),
    ticket: value.ticket.trim(),
    dueDate: value.dueDate,
    evidenceLink: value.evidenceLink.trim(),
    evidenceCaptureIds,
    captureId: evidenceCaptureIds[0],
    statusHistory: findingStatusHistoryAfterChange(finding, value.status, changedAt),
    modifiedAt: changedAt,
  };
}

function ticketErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function FindingEditorDialog({
  open,
  finding,
  captures,
  initialValue,
  onClose,
  onSave,
  onTicketUpdate,
  auditId,
  sampleItemId,
  testRunId,
}: {
  open: boolean;
  finding: Finding | null;
  captures: CaptureEntry[];
  initialValue?: Partial<FindingEditorValue>;
  onClose: () => void;
  onSave: (value: FindingEditorValue) => void;
  onTicketUpdate?: (finding: Finding) => Promise<void> | void;
  auditId?: string;
  sampleItemId?: string;
  testRunId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [value, setValue] = useState<FindingEditorValue>(EMPTY);
  const [ticketConfiguration, setTicketConfiguration] = useState<TicketConnectorConfiguration | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<TicketConnectorId>("jira");
  const [connectorDraft, setConnectorDraft] = useState<TicketConnectorPublicConfig | null>(null);
  const [ticketBusy, setTicketBusy] = useState<"configure" | "create" | "sync" | "resolve" | null>(null);
  const [ticketMessage, setTicketMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureMessage, setCaptureMessage] = useState("");
  const [pendingCapture, setPendingCapture] = useState<PendingFindingCapture | null>(null);
  const [recentCaptures, setRecentCaptures] = useState<CaptureEntry[]>([]);
  const credentialRef = useRef<HTMLInputElement>(null);
  const pendingCaptureRef = useRef<PendingFindingCapture | null>(null);
  const captureIntentRoleRef = useRef<FindingCaptureRole | null>(null);
  const earlyCapturesRef = useRef(new Map<string, CaptureSavedEvent>());
  const cancelledCaptureSessionsRef = useRef(new Set<string>());
  const pendingCaptureRole = pendingCapture?.role ?? null;

  function updatePendingCapture(next: PendingFindingCapture | null) {
    pendingCaptureRef.current = next;
    setPendingCapture(next);
  }

  function attachCapturedEntry(role: FindingCaptureRole, entry: CaptureSavedEvent) {
    setValue((current) => {
      if (role === "before") return { ...current, beforeCaptureId: entry.id };
      if (role === "after") return { ...current, afterCaptureId: entry.id };
      const evidenceCaptureIds = [...new Set([...current.evidenceCaptureIds, entry.id])];
      return {
        ...current,
        evidenceCaptureIds,
        captureId: evidenceCaptureIds[0] ?? "",
      };
    });
    captureIntentRoleRef.current = null;
    updatePendingCapture(null);
    setCaptureBusy(false);
    setCaptureMessage("Capture attached. Add annotations in the capture window, then return here when ready.");
  }

  useEffect(() => {
    if (open) {
      setValue(valueFromFinding(finding, initialValue));
      setRecentCaptures([]);
      captureIntentRoleRef.current = null;
      earlyCapturesRef.current.clear();
      cancelledCaptureSessionsRef.current.clear();
      updatePendingCapture(null);
      setCaptureBusy(false);
      setCaptureMessage("");
    }
  }, [finding, initialValue, open]);

  useEffect(() => {
    if (!open) return;
    const stopSaved = desktop.on<CaptureSavedEvent>("capture:saved", (entry) => {
      if (auditId && entry.auditId !== auditId) return;
      setRecentCaptures((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
      const pending = pendingCaptureRef.current;
      if (captureMatchesPendingSession(pending, entry)) {
        attachCapturedEntry(pending.role, entry);
      } else if (!pending && captureIntentRoleRef.current && entry.sessionId) {
        earlyCapturesRef.current.set(entry.sessionId, entry);
      }
    });
    const stopCancelled = desktop.on<{ sessionId: string }>("capture:cancelled", ({ sessionId }) => {
      cancelledCaptureSessionsRef.current.add(sessionId);
      const pending = pendingCaptureRef.current;
      if (!cancellationMatchesPendingSession(pending, sessionId)) return;
      captureIntentRoleRef.current = null;
      updatePendingCapture(null);
      setCaptureBusy(false);
      setCaptureMessage("Capture cancelled. Start another capture when ready.");
    });
    return () => {
      stopSaved();
      stopCancelled();
    };
  }, [auditId, open]);

  useEffect(() => {
    if (!open || !finding) return;
    let active = true;
    setTicketMessage(null);
    void desktop.invoke<TicketConnectorConfiguration>("ticket:configuration")
      .then((configuration) => {
        if (!active) return;
        setTicketConfiguration(configuration);
        const connector = finding.ticketLink?.connector
          ?? configuration.connectors.find((item) => item.configured)?.id
          ?? "jira";
        setSelectedConnector(connector);
        setConnectorDraft(configuration.connectors.find((item) => item.id === connector) ?? null);
      })
      .catch((error) => {
        if (active) setTicketMessage({ text: ticketErrorMessage(error), error: true });
      });
    return () => { active = false; };
  }, [finding, open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function patch<K extends keyof FindingEditorValue>(
    key: K,
    next: FindingEditorValue[K],
  ) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  const availableCaptures = [
    ...recentCaptures,
    ...captures.filter((capture) => !recentCaptures.some((item) => item.id === capture.id)),
  ];

  async function captureForFinding(role: FindingCaptureRole) {
    setCaptureBusy(true);
    captureIntentRoleRef.current = role;
    updatePendingCapture(null);
    setCaptureMessage("Drag around the evidence. The annotated capture will attach here automatically.");
    try {
      const { sessionId } = await desktop.invoke<{ sessionId: string }>("capture:begin", {
        mode: "capture",
        auditId,
        sampleItemId,
        testRunId,
      });
      if (cancelledCaptureSessionsRef.current.delete(sessionId)) {
        captureIntentRoleRef.current = null;
        setCaptureBusy(false);
        setCaptureMessage("Capture cancelled. Start another capture when ready.");
        return;
      }
      const earlyCapture = earlyCapturesRef.current.get(sessionId);
      if (earlyCapture) {
        earlyCapturesRef.current.delete(sessionId);
        attachCapturedEntry(role, earlyCapture);
        return;
      }
      updatePendingCapture({ role, sessionId });
    } catch (error) {
      captureIntentRoleRef.current = null;
      updatePendingCapture(null);
      setCaptureBusy(false);
      setCaptureMessage(ticketErrorMessage(error));
    }
  }

  function attachExistingCapture(captureId: string) {
    if (!captureId) return;
    patch("evidenceCaptureIds", [...new Set([...value.evidenceCaptureIds, captureId])]);
    if (!value.captureId) patch("captureId", captureId);
  }

  function removeEvidenceCapture(captureId: string) {
    const evidenceCaptureIds = value.evidenceCaptureIds.filter((id) => id !== captureId);
    setValue((current) => ({
      ...current,
      evidenceCaptureIds,
      captureId: evidenceCaptureIds[0] ?? "",
    }));
  }

  function chooseConnector(id: TicketConnectorId) {
    setSelectedConnector(id);
    setConnectorDraft(
      ticketConfiguration?.connectors.find((connector) => connector.id === id)
      ?? {
        id,
        label: id === "jira" ? "Jira" : id === "linear" ? "Linear" : "GitHub Issues",
        configured: false,
        mapping: DEFAULT_TICKET_FIELD_MAPPINGS[id],
      },
    );
    setTicketMessage(null);
    if (credentialRef.current) credentialRef.current.value = "";
  }

  function patchConnector<K extends keyof TicketConnectorPublicConfig>(
    key: K,
    next: TicketConnectorPublicConfig[K],
  ) {
    setConnectorDraft((current) => current ? { ...current, [key]: next } : current);
  }

  function patchMapping(field: TicketSourceField, target: string) {
    setConnectorDraft((current) => current
      ? { ...current, mapping: { ...current.mapping, [field]: target } }
      : current);
  }

  async function saveConnector() {
    if (!connectorDraft) return;
    setTicketBusy("configure");
    setTicketMessage(null);
    try {
      const configuration = await desktop.invoke<TicketConnectorConfiguration>("ticket:save-connector", {
        connector: connectorDraft.id,
        credential: credentialRef.current?.value ?? "",
        mapping: connectorDraft.mapping,
        baseUrl: connectorDraft.baseUrl ?? "",
        email: connectorDraft.email ?? "",
        projectKey: connectorDraft.projectKey ?? "",
        issueType: connectorDraft.issueType ?? "Bug",
        teamId: connectorDraft.teamId ?? "",
        repository: connectorDraft.repository ?? "",
      });
      if (credentialRef.current) credentialRef.current.value = "";
      setTicketConfiguration(configuration);
      setConnectorDraft(configuration.connectors.find((item) => item.id === connectorDraft.id) ?? null);
      setTicketMessage({ text: `${connectorDraft.label} connector saved in encrypted desktop storage.`, error: false });
    } catch (error) {
      setTicketMessage({ text: ticketErrorMessage(error), error: true });
    } finally {
      setTicketBusy(null);
    }
  }

  async function removeConnector() {
    if (!connectorDraft) return;
    setTicketBusy("configure");
    setTicketMessage(null);
    try {
      const configuration = await desktop.invoke<TicketConnectorConfiguration>("ticket:remove-connector", {
        connector: connectorDraft.id,
      });
      setTicketConfiguration(configuration);
      setConnectorDraft(configuration.connectors.find((item) => item.id === connectorDraft.id) ?? null);
      setTicketMessage({ text: `${connectorDraft.label} credentials removed. Existing ticket links remain on findings.`, error: false });
    } catch (error) {
      setTicketMessage({ text: ticketErrorMessage(error), error: true });
    } finally {
      setTicketBusy(null);
    }
  }

  async function persistTicketUpdate(updated: Finding) {
    setValue(valueFromFinding(updated));
    await onTicketUpdate?.(updated);
  }

  async function createTicket() {
    if (!finding || !connectorDraft?.configured || value.ticketLink) return;
    setTicketBusy("create");
    setTicketMessage(null);
    try {
      const local = findingWithEditorValue(finding, value);
      const link = await desktop.invoke<FindingTicketLink>("ticket:create", {
        connector: selectedConnector,
        fields: ticketFieldValuesFromFinding(local),
      });
      await persistTicketUpdate({ ...local, ticket: link.key, ticketLink: link });
      setTicketMessage({ text: `${link.key} created with the finding fields and linked to this record.`, error: false });
    } catch (error) {
      setTicketMessage({ text: ticketErrorMessage(error), error: true });
    } finally {
      setTicketBusy(null);
    }
  }

  async function syncTicket() {
    if (!finding || !value.ticketLink) return;
    setTicketBusy("sync");
    setTicketMessage(null);
    try {
      const local = findingWithEditorValue(finding, value);
      const external = await desktop.invoke<TicketExternalSnapshot>("ticket:sync", { link: value.ticketLink });
      const link = reviewTicketSync(local, value.ticketLink, external);
      await persistTicketUpdate({ ...local, ticketLink: link });
      setTicketMessage({
        text: link.conflicts.length
          ? `${link.conflicts.length} external ${link.conflicts.length === 1 ? "change needs" : "changes need"} auditor review. No local decision was changed.`
          : "Ticket state is in sync.",
        error: false,
      });
    } catch (error) {
      const link = value.ticketLink;
      if (link) await persistTicketUpdate({
        ...findingWithEditorValue(finding, value),
        ticketLink: { ...link, syncState: "error", lastError: ticketErrorMessage(error) },
      });
      setTicketMessage({ text: ticketErrorMessage(error), error: true });
    } finally {
      setTicketBusy(null);
    }
  }

  async function resolveConflict(field: TicketSourceField | "status", resolution: "keep-local" | "use-external") {
    if (!finding || !value.ticketLink) return;
    setTicketBusy("resolve");
    setTicketMessage(null);
    try {
      const local = findingWithEditorValue(finding, value);
      const updated = resolveTicketConflict(local, field, resolution);
      await persistTicketUpdate(updated);
      setTicketMessage({
        text: resolution === "use-external"
          ? "The selected external value was explicitly applied to the local finding."
          : "The auditor's local value was kept and the external difference was acknowledged.",
        error: false,
      });
    } catch (error) {
      setTicketMessage({ text: ticketErrorMessage(error), error: true });
    } finally {
      setTicketBusy(null);
    }
  }
  const missingRetest = value.status === "fixed" && !value.retestNote.trim();
  const missingRiskAcceptance =
    value.status === "accepted" && !value.riskAcceptance.trim();
  const saveDisabled =
    !value.title.trim() || missingRetest || missingRiskAcceptance;

  return (
    <dialog
      ref={ref}
      className="modal-dialog finding-editor-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!saveDisabled) onSave(value);
        }}
      >
        <header className="finding-editor-heading">
          <div>
            <span>{finding ? "Finding record" : "Manual finding"}</span>
            <h2 id={titleId}>{finding ? "Edit audit finding" : "Document a new barrier"}</h2>
            <p>Record observable behavior and user impact. Confirm mappings and severity before delivery.</p>
          </div>
          <button type="button" aria-label="Close finding editor" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="finding-editor-body">
          <Field label="Issue title" className="finding-editor-wide">
            <input
              autoFocus
              required
              maxLength={240}
              value={value.title}
              onChange={(event) => patch("title", event.target.value)}
              placeholder="Describe the barrier in one specific sentence"
            />
          </Field>
          <Field label="WCAG criterion" hint="Use a criterion such as 2.4.7, or leave blank until manual mapping is complete.">
            <select
              value={value.wcag}
              onChange={(event) => patch("wcag", event.target.value)}
            >
              <option value="">Needs manual mapping</option>
              {value.wcag && !WCAG_CRITERIA.some((criterion) => criterion.sc === value.wcag) ? (
                <option value={value.wcag}>{value.wcag} (custom mapping)</option>
              ) : null}
              {WCAG_CRITERIA.map((criterion) => (
                <option key={criterion.sc} value={criterion.sc}>
                  {criterion.sc} · {criterion.name} · Level {criterion.level}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Page, screen, or component">
            <input
              value={value.location}
              onChange={(event) => patch("location", event.target.value)}
              placeholder="Checkout / Payment method dialog"
            />
          </Field>
          <section className="finding-evidence-editor finding-editor-wide" aria-labelledby="finding-evidence-title">
            <div className="finding-evidence-heading">
              <div>
                <strong id="finding-evidence-title">Evidence attached to this finding</strong>
                <p>Capture and annotate without leaving finding authoring. You can attach more than one capture.</p>
              </div>
              <Button
                type="button"
                variant="primary"
                icon={Camera}
                disabled={captureBusy}
                onClick={() => void captureForFinding("evidence")}
              >
                {pendingCaptureRole === "evidence" ? "Waiting for capture" : "Add evidence"}
              </Button>
            </div>
            {value.evidenceCaptureIds.length ? (
              <ul className="finding-evidence-list" aria-label="Attached evidence captures">
                {value.evidenceCaptureIds.map((captureId, index) => {
                  const capture = availableCaptures.find((entry) => entry.id === captureId);
                  return (
                    <li key={captureId}>
                      <span><strong>{capture?.title ?? "Local capture"}</strong><small>{index === 0 ? "Primary evidence" : "Additional evidence"}</small></span>
                      <button type="button" onClick={() => void desktop.invoke("capture:open", { id: captureId })
                        .catch((error) => setCaptureMessage(ticketErrorMessage(error)))}>Annotate</button>
                      <button type="button" aria-label={`Remove ${capture?.title ?? "capture"} from finding`} onClick={() => removeEvidenceCapture(captureId)}><X size={20} /></button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="finding-evidence-empty">No evidence attached yet.</p>
            )}
            <label className="finding-evidence-existing">
              <span>Attach from capture library</span>
              <select value="" onChange={(event) => attachExistingCapture(event.target.value)}>
                <option value="">Choose an existing capture</option>
                {availableCaptures
                  .filter((capture) => !value.evidenceCaptureIds.includes(capture.id))
                  .map((capture) => <option key={capture.id} value={capture.id}>{capture.title}</option>)}
              </select>
            </label>
            {captureMessage ? <p className="finding-evidence-message" role="status">{captureMessage}</p> : null}
          </section>
          <div className="field">
            <label>
              <span className="field-label">Before remediation evidence</span>
              <select value={value.beforeCaptureId} onChange={(event) => patch("beforeCaptureId", event.target.value)}>
                <option value="">No before capture</option>
                {availableCaptures.map((capture) => <option key={capture.id} value={capture.id}>{capture.title}</option>)}
              </select>
            </label>
            <button className="field-inline-action" type="button" disabled={captureBusy} onClick={() => void captureForFinding("before")}>Capture before</button>
          </div>
          <div className="field">
            <label>
              <span className="field-label">After remediation evidence</span>
              <select value={value.afterCaptureId} onChange={(event) => patch("afterCaptureId", event.target.value)}>
                <option value="">No after capture</option>
                {availableCaptures.map((capture) => <option key={capture.id} value={capture.id}>{capture.title}</option>)}
              </select>
            </label>
            <button className="field-inline-action" type="button" disabled={captureBusy} onClick={() => void captureForFinding("after")}>Capture after</button>
          </div>
          <Field
            label="Evidence comparison note"
            hint="Explain what changed and which environment was used for the retest."
            className="finding-editor-wide"
          >
            <textarea
              rows={3}
              value={value.comparisonNote}
              onChange={(event) => patch("comparisonNote", event.target.value)}
              placeholder="Before: focus was not visible. After: a 3 px indicator is visible in Windows High Contrast and at 200% zoom."
            />
          </Field>
          <Field label="Severity">
            <select
              value={value.severity}
              onChange={(event) => patch("severity", event.target.value as Finding["severity"])}
            >
              <option value="blocker">Blocker</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </Field>
          <Field label="Remediation status">
            <select
              value={value.status}
              onChange={(event) => patch("status", event.target.value as Finding["status"])}
            >
              <option value="open">Open</option>
              <option value="retest">Ready for retest</option>
              <option value="fixed">Verified fixed</option>
              <option value="accepted">Risk accepted</option>
            </select>
          </Field>
          <Field label="Remediation owner">
            <input
              value={value.owner}
              onChange={(event) => patch("owner", event.target.value)}
              placeholder="Team or person responsible"
            />
          </Field>
          <Field label="Ticket or reference">
            <input
              value={value.ticket}
              onChange={(event) => patch("ticket", event.target.value)}
              placeholder="A11Y-142 or issue URL"
              readOnly={Boolean(value.ticketLink)}
            />
          </Field>
          <Field label="Target remediation date">
            <input
              type="date"
              value={value.dueDate}
              onChange={(event) => patch("dueDate", event.target.value)}
            />
          </Field>
          <Field label="Evidence link" hint="Use a shareable report, capture, or test-evidence URL for the external ticket.">
            <input
              type="url"
              value={value.evidenceLink}
              onChange={(event) => patch("evidenceLink", event.target.value)}
              placeholder="https://app.thewcag.com/s/..."
            />
          </Field>
          {finding ? (
            <section className="finding-ticket-panel finding-editor-wide" aria-labelledby="finding-ticket-heading">
              <div className="finding-ticket-heading">
                <span aria-hidden="true"><Ticket size={20} /></span>
                <div>
                  <h3 id="finding-ticket-heading">Create ticket</h3>
                  <p>Send this finding without retyping it. External changes always wait for auditor review.</p>
                </div>
                {value.ticketLink ? (
                  <span className={`status ${value.ticketLink.syncState === "in-sync" ? "status-success" : value.ticketLink.syncState === "review" ? "status-warning" : "status-danger"}`}>
                    {value.ticketLink.syncState === "in-sync" ? "In sync" : value.ticketLink.syncState === "review" ? "Review needed" : "Sync error"}
                  </span>
                ) : null}
              </div>

              {value.ticketLink ? (
                <div className="finding-ticket-linked">
                  <div>
                    <strong>{value.ticketLink.key}</strong>
                    <span>{value.ticketLink.connector === "github" ? "GitHub Issues" : value.ticketLink.connector[0].toUpperCase() + value.ticketLink.connector.slice(1)}</span>
                  </div>
                  <dl>
                    <div><dt>Local decision</dt><dd>{value.status}</dd></div>
                    <div><dt>External status</dt><dd>{value.ticketLink.externalStatus || "Unknown"}</dd></div>
                  </dl>
                  <div className="finding-ticket-actions">
                    <Button
                      type="button"
                      icon={ArrowSquareOut}
                      onClick={() => void desktop.invoke("shell:open-external", { url: value.ticketLink!.url })
                        .catch((error) => setTicketMessage({ text: ticketErrorMessage(error), error: true }))}
                    >
                      Open ticket
                    </Button>
                    <Button
                      type="button"
                      icon={ArrowClockwise}
                      disabled={ticketBusy !== null}
                      onClick={() => void syncTicket()}
                    >
                      {ticketBusy === "sync" ? "Checking..." : "Re-sync"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="finding-ticket-create-row">
                  <Field label="Connector">
                    <select
                      value={selectedConnector}
                      onChange={(event) => chooseConnector(event.target.value as TicketConnectorId)}
                    >
                      {(ticketConfiguration?.connectors ?? []).map((connector) => (
                        <option key={connector.id} value={connector.id}>
                          {connector.label}{connector.configured ? " · configured" : " · setup required"}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    type="button"
                    variant="primary"
                    icon={LinkSimple}
                    disabled={ticketBusy !== null || !connectorDraft?.configured}
                    onClick={() => void createTicket()}
                  >
                    {ticketBusy === "create" ? "Creating..." : `Create in ${connectorDraft?.label ?? "connector"}`}
                  </Button>
                </div>
              )}

              {value.ticketLink?.conflicts.length ? (
                <div className="finding-ticket-conflicts" role="status" aria-live="polite">
                  <div>
                    <strong>External changes need review</strong>
                    <p>Nothing below has been applied to the local audit record.</p>
                  </div>
                  <ul>
                    {value.ticketLink.conflicts.map((conflict) => (
                      <li key={conflict.field}>
                        <div>
                          <strong>{conflict.field === "status" ? "Remediation status" : TICKET_FIELD_LABELS[conflict.field]}</strong>
                          <span>{conflict.kind === "diverged" ? "Both sides changed" : "External change"}</span>
                        </div>
                        <dl>
                          <div><dt>Local</dt><dd>{conflict.localValue || "Empty"}</dd></div>
                          <div><dt>External</dt><dd>{conflict.externalValue || "Empty"}</dd></div>
                        </dl>
                        <div className="finding-ticket-conflict-actions">
                          <Button type="button" disabled={ticketBusy !== null} onClick={() => void resolveConflict(conflict.field, "keep-local")}>
                            {conflict.field === "status" ? "Keep local decision" : "Keep local"}
                          </Button>
                          {conflict.field !== "status" ? (
                            <Button type="button" disabled={ticketBusy !== null} onClick={() => void resolveConflict(conflict.field, "use-external")}>
                              Apply external
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {ticketMessage ? (
                <p className={ticketMessage.error ? "finding-ticket-message finding-ticket-message-error" : "finding-ticket-message"} role={ticketMessage.error ? "alert" : "status"}>
                  {ticketMessage.text}
                </p>
              ) : null}

              <details className="finding-ticket-settings">
                <summary><GearSix size={16} /> Connector settings and field mapping</summary>
                <div className="finding-ticket-settings-body">
                  <div className="finding-ticket-settings-intro">
                    <Field label="Configure connector">
                      <select value={selectedConnector} onChange={(event) => chooseConnector(event.target.value as TicketConnectorId)}>
                        {(ticketConfiguration?.connectors ?? []).map((connector) => (
                          <option key={connector.id} value={connector.id}>{connector.label}</option>
                        ))}
                      </select>
                    </Field>
                    <p>
                      API credentials are sent across the allowlisted IPC boundary and encrypted by the desktop main process. They are never returned to this screen.
                    </p>
                  </div>
                  {connectorDraft ? (
                    <>
                      <div className="finding-ticket-credential-grid">
                        {connectorDraft.id === "jira" ? (
                          <>
                            <Field label="Jira site URL"><input value={connectorDraft.baseUrl ?? ""} onChange={(event) => patchConnector("baseUrl", event.target.value)} placeholder="https://company.atlassian.net" /></Field>
                            <Field label="Jira account email"><input type="email" value={connectorDraft.email ?? ""} onChange={(event) => patchConnector("email", event.target.value)} /></Field>
                            <Field label="Project key"><input value={connectorDraft.projectKey ?? ""} onChange={(event) => patchConnector("projectKey", event.target.value)} placeholder="A11Y" /></Field>
                            <Field label="Issue type"><input value={connectorDraft.issueType ?? "Bug"} onChange={(event) => patchConnector("issueType", event.target.value)} /></Field>
                          </>
                        ) : connectorDraft.id === "linear" ? (
                          <Field label="Linear team ID"><input value={connectorDraft.teamId ?? ""} onChange={(event) => patchConnector("teamId", event.target.value)} placeholder="Team UUID" /></Field>
                        ) : (
                          <Field label="GitHub repository"><input value={connectorDraft.repository ?? ""} onChange={(event) => patchConnector("repository", event.target.value)} placeholder="owner/repository" /></Field>
                        )}
                        <Field label={`${connectorDraft.label} API token`} hint={connectorDraft.credentialHint ? `Saved credential ${connectorDraft.credentialHint}. Leave blank to keep it.` : "Stored only in encrypted desktop storage."}>
                          <input ref={credentialRef} type="password" autoComplete="new-password" placeholder={connectorDraft.configured ? "Keep saved token" : "Paste token"} />
                        </Field>
                      </div>
                      <div className="finding-ticket-mapping">
                        <div>
                          <strong>Field mapping</strong>
                          <p>Map each finding value to a provider field or custom field ID. Leave a target empty to omit it.</p>
                        </div>
                        <div className="finding-ticket-mapping-grid">
                          {TICKET_SOURCE_FIELDS.map((field) => (
                            <label key={field}>
                              <span>{TICKET_FIELD_LABELS[field]}</span>
                              <input
                                value={connectorDraft.mapping[field]}
                                onChange={(event) => patchMapping(field, event.target.value)}
                                aria-label={`External field for ${TICKET_FIELD_LABELS[field]}`}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="finding-ticket-settings-actions">
                        {connectorDraft.configured ? (
                          <Button type="button" disabled={ticketBusy !== null} onClick={() => void removeConnector()}>Remove credentials</Button>
                        ) : null}
                        <Button type="button" variant="primary" disabled={ticketBusy !== null || !ticketConfiguration?.secureStorageAvailable} onClick={() => void saveConnector()}>
                          {ticketBusy === "configure" ? "Saving..." : "Save connector"}
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              </details>
            </section>
          ) : null}
          <Field label="Issue description" className="finding-editor-wide">
            <textarea
              rows={3}
              value={value.description}
              onChange={(event) => patch("description", event.target.value)}
              placeholder="Summarize the accessibility barrier and where it occurs."
            />
          </Field>
          <Field label="Actual result">
            <textarea
              rows={4}
              value={value.actualResult}
              onChange={(event) => patch("actualResult", event.target.value)}
              placeholder="Describe what happens now, using observable behavior."
            />
          </Field>
          <Field label="Expected result">
            <textarea
              rows={4}
              value={value.expectedResult}
              onChange={(event) => patch("expectedResult", event.target.value)}
              placeholder="Describe the accessible behavior required."
            />
          </Field>
          <Field label="User impact">
            <textarea
              rows={4}
              value={value.userImpact}
              onChange={(event) => patch("userImpact", event.target.value)}
              placeholder="Who is affected, what task is disrupted, and whether a workaround exists?"
            />
          </Field>
          <fieldset className="affected-users finding-editor-wide">
            <legend>Affected users</legend>
            <p>Select every group directly affected by this barrier.</p>
            <div>
              {(Object.keys(AFFECTED_USER_LABELS) as AffectedUser[]).map((user) => (
                <label key={user}>
                  <input
                    type="checkbox"
                    checked={value.affectedUsers.includes(user)}
                    onChange={(event) =>
                      patch(
                        "affectedUsers",
                        event.target.checked
                          ? [...new Set([...value.affectedUsers, user])]
                          : value.affectedUsers.filter((item) => item !== user),
                      )
                    }
                  />
                  <span>{AFFECTED_USER_LABELS[user]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Severity rationale">
            <textarea
              rows={4}
              value={value.severityRationale}
              onChange={(event) => patch("severityRationale", event.target.value)}
              placeholder="Explain task criticality, reach, frequency, and available workarounds."
            />
          </Field>
          <Field label="Suggested resolution">
            <textarea
              rows={4}
              value={value.recommendation}
              onChange={(event) => patch("recommendation", event.target.value)}
              placeholder="Give implementation direction without prescribing an unverified fix."
            />
          </Field>
          <Field label="Reproduction steps" className="finding-editor-wide" hint="Enter one step per line.">
            <textarea
              rows={4}
              value={value.reproductionSteps.join("\n")}
              onChange={(event) => patch(
                "reproductionSteps",
                event.target.value.split("\n").map((step) => step.trim()).filter(Boolean),
              )}
              placeholder={"1. Open the checkout page\n2. Move focus to Payment method\n3. Observe the focus indicator"}
            />
          </Field>
          <fieldset className="occurrence-editor finding-editor-wide">
            <legend>Repeated occurrences</legend>
            <p>
              Track every confirmed location without copying the full finding.
            </p>
            {value.occurrences.length ? (
              <div className="occurrence-editor-list">
                {value.occurrences.map((occurrence, index) => (
                  <div className="occurrence-editor-row" key={occurrence.id}>
                    <input
                      value={occurrence.location}
                      onChange={(event) =>
                        patch(
                          "occurrences",
                          value.occurrences.map((item) =>
                            item.id === occurrence.id
                              ? { ...item, location: event.target.value }
                              : item,
                          ),
                        )
                      }
                      aria-label={`Location for occurrence ${index + 1}`}
                      placeholder="Page, screen, or component"
                    />
                    <select
                      value={occurrence.captureId ?? ""}
                      onChange={(event) =>
                        patch(
                          "occurrences",
                          value.occurrences.map((item) =>
                            item.id === occurrence.id
                              ? { ...item, captureId: event.target.value || undefined }
                              : item,
                          ),
                        )
                      }
                      aria-label={`Evidence for occurrence ${index + 1}`}
                    >
                      <option value="">No capture</option>
                      {availableCaptures.map((capture) => (
                        <option key={capture.id} value={capture.id}>
                          {capture.title}
                        </option>
                      ))}
                    </select>
                    <input
                      value={occurrence.note}
                      onChange={(event) =>
                        patch(
                          "occurrences",
                          value.occurrences.map((item) =>
                            item.id === occurrence.id
                              ? { ...item, note: event.target.value }
                              : item,
                          ),
                        )
                      }
                      aria-label={`Note for occurrence ${index + 1}`}
                      placeholder="Variant or reproduction note"
                    />
                    <button
                      type="button"
                      className="row-action"
                      aria-label={`Remove occurrence ${index + 1}`}
                      onClick={() =>
                        patch(
                          "occurrences",
                          value.occurrences.filter(
                            (item) => item.id !== occurrence.id,
                          ),
                        )
                      }
                    >
                      <Trash size={20} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <Button
              type="button"
              icon={Plus}
              onClick={() =>
                patch("occurrences", [
                  ...value.occurrences,
                  {
                    id: crypto.randomUUID(),
                    location: "",
                    note: "",
                    createdAt: Date.now(),
                  },
                ])
              }
            >
              Add occurrence
            </Button>
          </fieldset>
          <Field label="Implementation note">
            <textarea
              rows={3}
              value={value.note}
              onChange={(event) => patch("note", event.target.value)}
              placeholder="Optional internal note, ticket reference, or owner."
            />
          </Field>
          <Field label="Retest record" hint="Record the build, date, environment, and outcome when remediation is checked.">
            <textarea
              rows={3}
              value={value.retestNote}
              onChange={(event) => patch("retestNote", event.target.value)}
              placeholder="Retested in build 3.0.4 with NVDA and Chrome."
            />
          </Field>
          <Field
            label="Risk acceptance rationale"
            hint="Required when status is Risk accepted. Record the decision owner, reason, and review date."
            className="finding-editor-wide"
          >
            <textarea
              rows={3}
              value={value.riskAcceptance}
              onChange={(event) => patch("riskAcceptance", event.target.value)}
              placeholder="Accepted by the product owner until 2026-10-01 because…"
            />
          </Field>
        </div>

        <footer className="finding-editor-actions">
          {missingRetest ? (
            <p role="alert">Add a retest record before marking this verified fixed.</p>
          ) : missingRiskAcceptance ? (
            <p role="alert">Add a rationale before recording accepted risk.</p>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={FloppyDisk} disabled={saveDisabled}>
            {finding ? "Save finding" : "Create finding"}
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
