import { useEffect, useId, useRef, useState } from "react";
import { FloppyDisk, Plus, Trash, X } from "@phosphor-icons/react";
import type { AffectedUser } from "@accessibility-build/audit-contracts";
import type {
  CaptureEntry,
  Finding,
  FindingOccurrence,
} from "../shared/desktop";
import { Button, Field } from "./components";
import { WCAG_CRITERIA } from "./data/wcag";

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
  captureId: string;
  beforeCaptureId: string;
  afterCaptureId: string;
  comparisonNote: string;
  occurrences: FindingOccurrence[];
  owner: string;
  ticket: string;
  dueDate: string;
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
  captureId: "",
  beforeCaptureId: "",
  afterCaptureId: "",
  comparisonNote: "",
  occurrences: [],
  owner: "",
  ticket: "",
  dueDate: "",
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
    captureId: finding.captureId ?? "",
    beforeCaptureId: finding.beforeCaptureId ?? "",
    afterCaptureId: finding.afterCaptureId ?? "",
    comparisonNote: finding.comparisonNote ?? "",
    occurrences: finding.occurrences ?? [],
    owner: finding.owner ?? "",
    ticket: finding.ticket ?? "",
    dueDate: finding.dueDate ?? "",
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

export function FindingEditorDialog({
  open,
  finding,
  captures,
  initialValue,
  onClose,
  onSave,
}: {
  open: boolean;
  finding: Finding | null;
  captures: CaptureEntry[];
  initialValue?: Partial<FindingEditorValue>;
  onClose: () => void;
  onSave: (value: FindingEditorValue) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [value, setValue] = useState<FindingEditorValue>(EMPTY);

  useEffect(() => {
    if (open) setValue(valueFromFinding(finding, initialValue));
  }, [finding, initialValue, open]);

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
            <X size={18} />
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
          <Field label="Linked evidence capture">
            <select
              value={value.captureId}
              onChange={(event) => patch("captureId", event.target.value)}
            >
              <option value="">No capture linked</option>
              {captures.map((capture) => (
                <option key={capture.id} value={capture.id}>
                  {capture.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Before remediation evidence">
            <select
              value={value.beforeCaptureId}
              onChange={(event) => patch("beforeCaptureId", event.target.value)}
            >
              <option value="">No before capture</option>
              {captures.map((capture) => (
                <option key={capture.id} value={capture.id}>
                  {capture.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="After remediation evidence">
            <select
              value={value.afterCaptureId}
              onChange={(event) => patch("afterCaptureId", event.target.value)}
            >
              <option value="">No after capture</option>
              {captures.map((capture) => (
                <option key={capture.id} value={capture.id}>
                  {capture.title}
                </option>
              ))}
            </select>
          </Field>
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
            />
          </Field>
          <Field label="Target remediation date">
            <input
              type="date"
              value={value.dueDate}
              onChange={(event) => patch("dueDate", event.target.value)}
            />
          </Field>
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
                      {captures.map((capture) => (
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
                      <Trash size={16} />
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
