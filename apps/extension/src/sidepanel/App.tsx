import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  Check,
  CheckCircle,
  Code,
  Copy,
  Crosshair,
  Desktop,
  DownloadSimple,
  Eye,
  ImageSquare,
  MagicWand,
  MouseSimple,
  Selection,
  ShieldCheck,
  Sparkle,
  Warning,
} from "@phosphor-icons/react";
import {
  parseAiFindingDraft,
  parseEvidencePacket,
  compactFindingId,
  type AffectedUser,
  type AiFindingDraftV1,
  type AuditSummaryV1,
  type DraftConfidence,
  type EvidenceCaptureMode,
  type EvidencePacketV1,
  type FindingSeverity,
} from "@accessibility-build/audit-contracts";
import {
  applyConsent,
  createLocalDraft,
  findingMarkdown,
} from "../evidence";
import {
  generateDesktopDraft,
  hasDesktopPermission,
  listDesktopAudits,
  pingDesktop,
  requestDesktopPermission,
  saveDesktopFinding,
} from "../native";
import type { ExtensionRequest, ExtensionResponse } from "../shared/messages";
import {
  AUDIT_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  EVIDENCE_STORAGE_KEY,
} from "../shared/storage";

type StatusMessage = { text: string; tone: "neutral" | "success" | "danger" } | null;
type DesktopState = "checking" | "connected" | "disconnected";
type ExtensionSurface = "popup" | "sidepanel";

const affectedUserLabels: Record<AffectedUser, string> = {
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

function chromeMessage<T>(message: ExtensionRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response);
    });
  });
}

function displayError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/native messaging host.*not found|Specified native messaging host/i.test(message)) {
    return "The desktop connector is not installed yet. You can continue locally.";
  }
  if (/permission/i.test(message)) return "Desktop permission was not granted.";
  return message || "Something went wrong. Try again.";
}

function download(name: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function ConfidenceBadge({ value }: { value: DraftConfidence }) {
  return <span className={`confidence confidence-${value}`}>{value} confidence</span>;
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function App({ surface }: { surface: ExtensionSurface }) {
  const [evidence, setEvidence] = useState<EvidencePacketV1 | null>(null);
  const [draft, setDraft] = useState<AiFindingDraftV1 | null>(null);
  const [capturing, setCapturing] = useState<EvidenceCaptureMode | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [desktopState, setDesktopState] = useState<DesktopState>("checking");
  const [desktopVersion, setDesktopVersion] = useState("");
  const [audits, setAudits] = useState<AuditSummaryV1[]>([]);
  const [selectedAudit, setSelectedAudit] = useState("");
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeElementText, setIncludeElementText] = useState(true);
  const [includeUrl, setIncludeUrl] = useState(true);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void chrome.storage.local.get([EVIDENCE_STORAGE_KEY, DRAFT_STORAGE_KEY, AUDIT_STORAGE_KEY]).then((stored) => {
      try {
        if (stored[EVIDENCE_STORAGE_KEY]) setEvidence(parseEvidencePacket(stored[EVIDENCE_STORAGE_KEY]));
        if (stored[DRAFT_STORAGE_KEY]) setDraft(parseAiFindingDraft(stored[DRAFT_STORAGE_KEY]));
        if (typeof stored[AUDIT_STORAGE_KEY] === "string") setSelectedAudit(stored[AUDIT_STORAGE_KEY]);
      } catch {
        void chrome.storage.local.remove([EVIDENCE_STORAGE_KEY, DRAFT_STORAGE_KEY]);
      }
    });
    void chrome.windows.getCurrent().then((currentWindow) => {
      if (typeof currentWindow.id === "number") setCurrentWindowId(currentWindow.id);
    });
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id !== undefined) return chrome.action.setBadgeText({ tabId: tab.id, text: "" });
      return undefined;
    }).catch(() => undefined);
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName,
    ) => {
      if (areaName !== "local") return;
      try {
        if (changes[EVIDENCE_STORAGE_KEY]) {
          const next = changes[EVIDENCE_STORAGE_KEY].newValue;
          setEvidence(next ? parseEvidencePacket(next) : null);
        }
        if (changes[DRAFT_STORAGE_KEY]) {
          const next = changes[DRAFT_STORAGE_KEY].newValue;
          setDraft(next ? parseAiFindingDraft(next) : null);
        }
      } catch {
        setStatus({ text: "The saved capture could not be restored. Start a new capture.", tone: "danger" });
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    void checkDesktop(false);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    if (!status) return;
    statusRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (!evidence) return;
    const timeout = setTimeout(() => {
      void chrome.storage.local.set({ [EVIDENCE_STORAGE_KEY]: evidence });
    }, 250);
    return () => clearTimeout(timeout);
  }, [evidence]);

  useEffect(() => {
    if (!draft) return;
    const timeout = setTimeout(() => {
      void chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: draft });
    }, 250);
    return () => clearTimeout(timeout);
  }, [draft]);

  async function checkDesktop(requestPermission: boolean) {
    setDesktopState("checking");
    try {
      const allowed = requestPermission ? await requestDesktopPermission() : await hasDesktopPermission();
      if (!allowed) {
        setDesktopState("disconnected");
        return;
      }
      const [version, nextAudits] = await Promise.all([pingDesktop(), listDesktopAudits()]);
      setDesktopVersion(version);
      setAudits(nextAudits);
      const preferred = selectedAudit || nextAudits.find((audit) => audit.active)?.id || nextAudits[0]?.id || "";
      setSelectedAudit(preferred);
      if (preferred) void chrome.storage.local.set({ [AUDIT_STORAGE_KEY]: preferred });
      setDesktopState("connected");
      if (requestPermission) setStatus({ text: `Connected to TheWCAG ${version}`, tone: "success" });
    } catch (error) {
      setDesktopState("disconnected");
      if (requestPermission) setStatus({ text: displayError(error), tone: "danger" });
    }
  }

  async function startCapture(mode: EvidenceCaptureMode) {
    setCapturing(mode);
    setStatus({ text: mode === "element" ? "Select an element on the page. Press Escape to cancel." : "Drag around the affected region. Press Escape to cancel.", tone: "neutral" });
    try {
      const response = await chromeMessage<ExtensionResponse>({ type: "capture:start", mode });
      if (!response.ok) {
        if (!response.cancelled) setStatus({ text: response.message, tone: "danger" });
        else setStatus(null);
        return;
      }
      const packet = response.evidence;
      setEvidence(packet);
      setDraft(null);
      setStatus({ text: "Evidence captured locally. Review it before generating a draft.", tone: "success" });
    } catch (error) {
      setStatus({ text: displayError(error), tone: "danger" });
    } finally {
      setCapturing(null);
    }
  }

  function patchEvidence(patch: Partial<EvidencePacketV1>) {
    setEvidence((current) => current ? { ...current, ...patch } : current);
  }

  function patchDraft(patch: Partial<AiFindingDraftV1>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  async function generateDraft() {
    if (!evidence) return;
    if (evidence.observation.trim().length < 8) {
      setStatus({ text: "Describe what you observed before generating the finding.", tone: "danger" });
      return;
    }
    setGenerating(true);
    try {
      const approved = applyConsent(evidence, { includeScreenshot, includeElementText, includeUrl });
      const scoped = selectedAudit ? parseEvidencePacket({ ...approved, auditId: selectedAudit }) : approved;
      let nextDraft: AiFindingDraftV1;
      let fallbackMessage: string | null = null;
      if (desktopState === "connected" && selectedAudit) {
        try {
          nextDraft = parseAiFindingDraft(await generateDesktopDraft(scoped));
        } catch (error) {
          nextDraft = createLocalDraft(scoped);
          fallbackMessage = `${displayError(error)} A local structured draft was created instead.`;
        }
      } else {
        nextDraft = createLocalDraft(scoped);
      }
      setEvidence(scoped);
      setDraft(nextDraft);
      await chrome.storage.local.set({ [EVIDENCE_STORAGE_KEY]: scoped, [DRAFT_STORAGE_KEY]: nextDraft });
      if (nextDraft.provenance.source === "ai") setStatus({ text: "AI draft ready. Confirm every field before saving.", tone: "success" });
      else if (fallbackMessage) setStatus({ text: fallbackMessage, tone: "neutral" });
      else setStatus({ text: "Local structured draft ready. Connect the desktop app to enable AI authoring.", tone: "success" });
    } catch (error) {
      setStatus({ text: displayError(error), tone: "danger" });
    } finally {
      setGenerating(false);
    }
  }

  async function saveFinding() {
    if (!evidence || !draft || !selectedAudit) return;
    setSaving(true);
    try {
      const validated = parseAiFindingDraft(draft);
      await saveDesktopFinding(selectedAudit, { ...evidence, auditId: selectedAudit }, validated);
      setStatus({ text: "Finding saved to the selected desktop audit.", tone: "success" });
    } catch (error) {
      setStatus({ text: displayError(error), tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setEvidence(null);
    setDraft(null);
    setStatus(null);
    await chrome.storage.local.remove([EVIDENCE_STORAGE_KEY, DRAFT_STORAGE_KEY]);
  }

  function openWorkspace() {
    if (currentWindowId === null) {
      setStatus({ text: "The expanded workspace is not ready yet. Try again.", tone: "danger" });
      return;
    }
    void chrome.sidePanel.open({ windowId: currentWindowId }).then(() => {
      if (surface === "popup") window.close();
    }).catch(() => {
      setStatus({ text: "The expanded workspace could not open. Reopen TheWCAG from the toolbar and try again.", tone: "danger" });
    });
  }

  const targetLabel = evidence ? evidence.target.accessibleName || evidence.target.role || evidence.target.tagName || "Selected region" : "";
  const hasFailures = evidence?.checks.some((check) => check.outcome === "fail") ?? false;
  const selectedAuditName = audits.find((audit) => audit.id === selectedAudit)?.project;
  const confidenceByField = useMemo(() => new Map(draft?.fieldConfidence.map((item) => [item.field, item]) ?? []), [draft]);

  return (
    <div className={`app-shell surface-${surface}`}>
      <header className="app-header">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div>
            <strong>TheWCAG</strong>
            <span>{surface === "popup" ? "Quick capture" : "Evidence workspace"}</span>
          </div>
        </div>
        <div className="header-actions">
          <span className={`connection connection-${desktopState}`}>
            <span aria-hidden="true" />
            {desktopState === "connected" ? "Desktop ready" : desktopState === "checking" ? "Checking" : "Local mode"}
          </span>
          {surface === "popup" ? (
            <button className="icon-button" onClick={openWorkspace} aria-label="Open expanded evidence workspace" title="Open expanded workspace">
              <ArrowSquareOut size={17} />
            </button>
          ) : null}
        </div>
      </header>

      {status ? (
        <div className={`status status-${status.tone}`} role={status.tone === "danger" ? "alert" : "status"} tabIndex={-1} ref={statusRef}>
          {status.tone === "danger" ? <Warning size={17} weight="fill" /> : status.tone === "success" ? <CheckCircle size={17} weight="fill" /> : <Eye size={17} />}
          <span>{status.text}</span>
          <button onClick={() => setStatus(null)} aria-label="Dismiss message">×</button>
        </div>
      ) : null}

      <main>
        {surface === "popup" && evidence ? (
          <section className="popup-ready" aria-labelledby="popup-ready-heading">
            <div className="section-heading">
              <div>
                <span className="step">{draft ? "Draft ready" : "Capture ready"}</span>
                <h1 id="popup-ready-heading">{draft?.title || "Evidence ready to review"}</h1>
              </div>
              <CheckCircle size={24} weight="fill" aria-hidden="true" />
            </div>
            {evidence.image ? (
              <figure className="capture-preview popup-preview">
                <img src={evidence.image.dataUrl} alt={`Page context showing ${targetLabel} highlighted in orange as issue 1`} />
                <figcaption>
                  <span><ImageSquare size={14} /> Context screenshot</span>
                  <strong><Crosshair size={14} /> {evidence.captureMode === "element" ? "Control highlighted" : "Region highlighted"}</strong>
                </figcaption>
              </figure>
            ) : null}
            <div className="target-summary">
              <div className="target-icon"><Code size={18} /></div>
              <div>
                <span>Selected target</span>
                <strong>{targetLabel}</strong>
                <code>{evidence.target.selector || evidence.target.structuralPath || "Visual region"}</code>
              </div>
            </div>
            <p className="popup-ready-copy">
              {draft
                ? "Your structured finding is saved locally and ready for detailed review."
                : `${evidence.checks.length} captured ${evidence.checks.length === 1 ? "signal" : "signals"}. Add your observation and control the AI payload in the expanded workspace.`}
            </p>
            <div className="action-stack popup-actions">
              <button className="button button-primary button-full" onClick={openWorkspace}>
                <ArrowSquareOut size={18} /> Review in workspace
              </button>
              <button className="button button-secondary button-full" onClick={() => void reset()}>
                <ArrowCounterClockwise size={18} /> Start another capture
              </button>
            </div>
          </section>
        ) : !evidence ? (
          <section className="start-view" aria-labelledby="start-heading">
            <div className="intro-icon"><Crosshair size={24} weight="duotone" /></div>
            <h1 id="start-heading">Mark the barrier, not the whole page.</h1>
            <p>Select the exact element or region. TheWCAG captures its visual and semantic context without reading form values or browser data.</p>

            <div className="capture-actions">
              <button className="capture-card capture-primary" disabled={capturing !== null} onClick={() => void startCapture("element")}>
                <span className="capture-card-icon"><MouseSimple size={21} /></span>
                <span><strong>{capturing === "element" ? "Select on page" : "Select element"}</strong><small>Best for controls, text, and images</small></span>
                <Crosshair size={19} />
              </button>
              <button className="capture-card" disabled={capturing !== null} onClick={() => void startCapture("region")}>
                <span className="capture-card-icon"><Selection size={21} /></span>
                <span><strong>{capturing === "region" ? "Drag on page" : "Select region"}</strong><small>Use when the barrier spans several elements</small></span>
                <Selection size={19} />
              </button>
            </div>

            <div className="privacy-note">
              <ShieldCheck size={20} weight="duotone" />
              <div><strong>Local until you approve</strong><p>Evidence is reviewed in this panel before anything can be sent for AI generation.</p></div>
            </div>

            {desktopState !== "connected" ? (
              <button className="button button-secondary button-full" onClick={() => void checkDesktop(true)} disabled={desktopState === "checking"}>
                <Desktop size={18} /> {desktopState === "checking" ? "Checking desktop" : "Connect desktop app"}
              </button>
            ) : (
              <div className="desktop-card">
                <Desktop size={19} />
                <div><strong>TheWCAG {desktopVersion}</strong><span>{audits.length ? `${audits.length} local ${audits.length === 1 ? "audit" : "audits"}` : "No audits yet"}</span></div>
                <Check size={18} weight="bold" />
              </div>
            )}
          </section>
        ) : !draft ? (
          <section className="evidence-view" aria-labelledby="evidence-heading">
            <div className="section-heading">
              <div><span className="step">Evidence 01</span><h1 id="evidence-heading">Review what was captured</h1></div>
              <button className="icon-button" onClick={() => void reset()} aria-label="Discard capture"><ArrowCounterClockwise size={18} /></button>
            </div>

            {evidence.image ? (
              <figure className="capture-preview">
                <img src={evidence.image.dataUrl} alt={`Page context showing ${targetLabel} highlighted in orange as issue 1`} />
                <figcaption>
                  <span><ImageSquare size={15} /> {evidence.image.width} × {evidence.image.height}</span>
                  <strong><Crosshair size={14} /> {evidence.captureMode === "element" ? "Control highlighted" : "Region highlighted"}</strong>
                </figcaption>
              </figure>
            ) : null}

            <div className="target-summary">
              <div className="target-icon"><Code size={18} /></div>
              <div><span>Selected target</span><strong>{targetLabel}</strong><code>{evidence.target.selector || evidence.target.structuralPath || "Visual region"}</code></div>
            </div>

            <details className="payload-review">
              <summary>Inspect captured page and element data</summary>
              <div>
                <p>
                  This is the complete text context available for this finding.
                  The marked image is shown above and can be withheld separately.
                </p>
                <pre>{JSON.stringify({
                  page: evidence.page,
                  target: evidence.target,
                  deterministicChecks: evidence.checks,
                  omissions: evidence.omissions,
                }, null, 2)}</pre>
              </div>
            </details>

            {evidence.checks.length ? (
              <section className="checks" aria-labelledby="checks-heading">
                <div className="subheading"><h2 id="checks-heading">Captured signals</h2><span>{evidence.checks.length}</span></div>
                {evidence.checks.map((check) => (
                  <div className={`check check-${check.outcome}`} key={check.id}>
                    {check.outcome === "fail" ? <Warning size={17} weight="fill" /> : <Eye size={17} />}
                    <div><strong>{check.title}</strong><span>{check.wcag.length ? `WCAG ${check.wcag.join(", ")}` : "Manual review"}</span></div>
                  </div>
                ))}
              </section>
            ) : (
              <div className="quiet-callout"><Eye size={18} /><p>No deterministic issue was found for this target. Your observation will guide the draft and all mappings will require manual review.</p></div>
            )}

            <Field
              label="What did you observe?"
              value={evidence.observation}
              onChange={(observation) => patchEvidence({ observation })}
              multiline
              rows={4}
              hint="Describe the behavior, not the fix. Example: The button is announced only as “button.”"
            />
            <Field
              label="Task context (optional)"
              value={evidence.taskContext}
              onChange={(taskContext) => patchEvidence({ taskContext })}
              hint="Example: Complete checkout or submit the support form"
            />

            {desktopState === "connected" && audits.length ? (
              <label className="field">
                <span>Save into audit</span>
                <select value={selectedAudit} onChange={(event) => {
                  setSelectedAudit(event.target.value);
                  void chrome.storage.local.set({ [AUDIT_STORAGE_KEY]: event.target.value });
                }}>
                  {audits.map((audit) => <option value={audit.id} key={audit.id}>{audit.project}{audit.active ? " (active)" : ""}</option>)}
                </select>
              </label>
            ) : null}

            <fieldset className="payload-options">
              <legend>Include in generation</legend>
              <label><input type="checkbox" checked={includeScreenshot} onChange={(event) => setIncludeScreenshot(event.target.checked)} /><ImageSquare size={17} /><span><strong>Screenshot</strong><small>Context view with the selected target highlighted</small></span></label>
              <label><input type="checkbox" checked={includeElementText} onChange={(event) => setIncludeElementText(event.target.checked)} /><Code size={17} /><span><strong>Element text</strong><small>Name, labels, and DOM excerpt</small></span></label>
              <label><input type="checkbox" checked={includeUrl} onChange={(event) => setIncludeUrl(event.target.checked)} /><ArrowSquareOut size={17} /><span><strong>Page context</strong><small>Title and address, with query and fragment removed</small></span></label>
            </fieldset>

            <div className="consent-copy"><ShieldCheck size={18} /><p>Generation starts only after this action. The selected payload will be recorded locally with its approval time.</p></div>
            <button className="button button-primary button-full" onClick={() => void generateDraft()} disabled={generating}>
              <MagicWand size={18} weight="fill" /> {generating ? "Preparing draft" : desktopState === "connected" ? "Generate finding draft" : "Create local draft"}
            </button>
          </section>
        ) : (
          <section className="draft-view" aria-labelledby="draft-heading">
            <div className="section-heading">
              <div><span className="step">Finding draft</span><h1 id="draft-heading">Confirm the audit language</h1></div>
              <ConfidenceBadge value={draft.confidence} />
            </div>

            <div className={`draft-source ${draft.provenance.source === "ai" ? "draft-source-ai" : ""}`}>
              <Sparkle size={18} weight="fill" />
              <div><strong>{draft.provenance.source === "ai" ? "AI-assisted draft" : "Local structured draft"}</strong><span>Suggested until you save it</span></div>
            </div>

            <button
              type="button"
              className="finding-identity"
              title={evidence.findingId}
              onClick={() => {
                void navigator.clipboard.writeText(evidence.findingId);
                setStatus({ text: "Finding ID copied.", tone: "success" });
              }}
            >
              <span>Immutable finding ID</span>
              <code>{compactFindingId(evidence.findingId)}</code>
              <Copy size={14} />
            </button>

            <Field label="Issue title" value={draft.title} onChange={(title) => patchDraft({ title })} />
            <Field label="Issue description" value={draft.description} onChange={(description) => patchDraft({ description })} multiline />
            <Field label="Actual result" value={draft.actualResult} onChange={(actualResult) => patchDraft({ actualResult })} multiline />
            <Field label="Expected result" value={draft.expectedResult} onChange={(expectedResult) => patchDraft({ expectedResult })} multiline />
            <Field label="User impact" value={draft.userImpact} onChange={(userImpact) => patchDraft({ userImpact })} multiline />

            <div className="field-row">
              <label className="field">
                <span>Severity</span>
                <select value={draft.severity} onChange={(event) => patchDraft({ severity: event.target.value as FindingSeverity })}>
                  <option value="blocker">Blocker</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                </select>
                {confidenceByField.get("severity") ? <small>{confidenceByField.get("severity")!.reason}</small> : null}
              </label>
            </div>
            <Field label="Severity rationale" value={draft.severityRationale} onChange={(severityRationale) => patchDraft({ severityRationale })} multiline />

            <fieldset className="affected-users">
              <legend>Affected users</legend>
              <div>
                {(Object.keys(affectedUserLabels) as AffectedUser[]).map((user) => (
                  <label key={user} className={draft.affectedUsers.includes(user) ? "selected" : ""}>
                    <input
                      type="checkbox"
                      checked={draft.affectedUsers.includes(user)}
                      onChange={(event) => patchDraft({
                        affectedUsers: event.target.checked
                          ? [...new Set([...draft.affectedUsers, user])]
                          : draft.affectedUsers.filter((item) => item !== user),
                      })}
                    />
                    {affectedUserLabels[user]}
                  </label>
                ))}
              </div>
            </fieldset>

            <section className="wcag-editor" aria-labelledby="wcag-heading">
              <div className="subheading"><h2 id="wcag-heading">WCAG mapping</h2><span>{draft.wcag.length}</span></div>
              {draft.wcag.length ? draft.wcag.map((mapping, index) => (
                <div className="wcag-card" key={`${mapping.criterion}-${index}`}>
                  <div className="wcag-card-top">
                    <input aria-label={`WCAG criterion ${index + 1}`} value={mapping.criterion} onChange={(event) => patchDraft({ wcag: draft.wcag.map((item, itemIndex) => itemIndex === index ? { ...item, criterion: event.target.value } : item) })} />
                    <input aria-label={`WCAG name ${index + 1}`} value={mapping.name} onChange={(event) => patchDraft({ wcag: draft.wcag.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} />
                    <ConfidenceBadge value={mapping.confidence} />
                  </div>
                  <textarea aria-label={`WCAG rationale ${index + 1}`} rows={3} value={mapping.rationale} onChange={(event) => patchDraft({ wcag: draft.wcag.map((item, itemIndex) => itemIndex === index ? { ...item, rationale: event.target.value } : item) })} />
                </div>
              )) : <div className="quiet-callout"><Warning size={18} /><p>No criterion was assigned. Complete a manual review before saving this finding.</p></div>}
            </section>

            <Field label="Suggested resolution" value={draft.recommendation} onChange={(recommendation) => patchDraft({ recommendation })} multiline rows={4} />
            <Field label="Example fix (optional)" value={draft.exampleFix} onChange={(exampleFix) => patchDraft({ exampleFix })} multiline rows={4} />
            <Field
              label="Reproduction steps"
              value={draft.reproductionSteps.join("\n")}
              onChange={(value) => patchDraft({ reproductionSteps: value.split("\n").map((step) => step.trim()).filter(Boolean) })}
              multiline
              rows={4}
              hint="One step per line"
            />

            <div className="manual-checks">
              <strong>Before saving</strong>
              {draft.manualChecks.map((check, index) => <p key={`${check}-${index}`}><CheckCircle size={16} />{check}</p>)}
            </div>

            <div className="action-stack">
              {desktopState === "connected" && selectedAudit ? (
                <button className="button button-primary button-full" disabled={saving} onClick={() => void saveFinding()}>
                  <Check size={18} weight="bold" /> {saving ? "Saving finding" : `Save to ${selectedAuditName || "desktop audit"}`}
                </button>
              ) : (
                <button className="button button-secondary button-full" onClick={() => void checkDesktop(true)}>
                  <Desktop size={18} /> Connect desktop to save
                </button>
              )}
              <button className="button button-secondary button-full" onClick={() => {
                const markdown = findingMarkdown(evidence, draft);
                download(`thewcag-${evidence.id.slice(0, 8)}.md`, markdown, "text/markdown;charset=utf-8");
                setStatus({ text: "Markdown draft exported.", tone: "success" });
              }}><DownloadSimple size={18} /> Export Markdown</button>
              <button className="button button-quiet button-full" onClick={() => {
                void navigator.clipboard.writeText(findingMarkdown(evidence, draft));
                setStatus({ text: "Finding copied as Markdown.", tone: "success" });
              }}><Copy size={18} /> Copy finding</button>
              <button className="button button-quiet button-full" onClick={() => setDraft(null)}><ArrowCounterClockwise size={18} /> Back to evidence</button>
            </div>
          </section>
        )}
      </main>

      <footer>
        <ShieldCheck size={15} />
        <span>{hasFailures ? "Deterministic failure captured" : "Human review remains required"}</span>
      </footer>
    </div>
  );
}
