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
  Plus,
  Selection,
  ShieldCheck,
  Sparkle,
  Trash,
  Warning,
  X,
} from "./Icon";
import {
  WCAG_CRITERIA,
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
  NativeConnectorError,
  pingDesktop,
  queueDesktopFinding,
  requestDesktopPermission,
  saveDesktopFinding,
} from "../native";
import {
  PANEL_PORT_NAME,
  type ExtensionRequest,
  type ExtensionResponse,
  type PanelPortMessage,
} from "../shared/messages";
import {
  AUDIT_STORAGE_KEY,
  CAPTURE_TAB_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  EVIDENCE_STORAGE_KEY,
  QUEUED_FINDING_STORAGE_KEY,
  SAVED_FINDING_STORAGE_KEY,
  storageWriteFailureMessage,
} from "../shared/storage";
import {
  clampEvidencePatch,
  consumeOwnStorageEcho,
  draftPersistenceAction,
  EVIDENCE_EDITABLE_LIMITS,
  rememberStorageWrite,
  restoreEvidencePacket,
  restoreSavedFindingMarker,
  type LastWrittenStorage,
  type SavedFindingMarker,
} from "./storage-state";

type StatusMessage = { text: string; tone: "neutral" | "success" | "danger" } | null;
type DesktopState = "checking" | "connected" | "disconnected";
type ExtensionSurface = "popup" | "sidepanel";
const EVIDENCE_RETENTION_MS = 24 * 60 * 60 * 1_000;

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
  if (error instanceof NativeConnectorError) {
    if (error.failure === "not-registered") {
      return "Chrome cannot find the desktop connector. Open TheWCAG once, then try Connect desktop again.";
    }
    if (error.failure === "extension-not-allowed") {
      return "This extension is not paired with the installed TheWCAG app. Install matching extension and desktop versions.";
    }
    if (error.failure === "host-exited") {
      return "The desktop connector started but closed before responding. Restart TheWCAG, then try again.";
    }
    if (error.failure === "timeout") {
      return `${error.message} Restart or update TheWCAG, then try again.`;
    }
    if (error.failure === "protocol-error") {
      return "The extension and desktop connector could not complete a secure handshake. Update both and try again.";
    }
  }
  const message = error instanceof Error ? error.message : String(error);
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
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} rows={rows} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint ? <small>{hint}</small> : null}
      {maxLength ? <small>{value.length}/{maxLength} characters</small> : null}
    </label>
  );
}

export function App({ surface }: { surface: ExtensionSurface }) {
  const [evidence, setEvidence] = useState<EvidencePacketV1 | null>(null);
  const [draft, setDraft] = useState<AiFindingDraftV1 | null>(null);
  const [capturing, setCapturing] = useState<EvidenceCaptureMode | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queuedFinding, setQueuedFinding] = useState<{
    key: string;
    source: "local" | "ai";
  } | null>(null);
  const [savedFinding, setSavedFinding] = useState<SavedFindingMarker | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [desktopState, setDesktopState] = useState<DesktopState>("checking");
  const [desktopVersion, setDesktopVersion] = useState("");
  const [audits, setAudits] = useState<AuditSummaryV1[]>([]);
  const [selectedAudit, setSelectedAudit] = useState("");
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeElementText, setIncludeElementText] = useState(true);
  const [includeUrl, setIncludeUrl] = useState(true);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [capturedTabId, setCapturedTabId] = useState<number | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const selectedAuditRef = useRef("");
  const evidenceRef = useRef<EvidencePacketV1 | null>(null);
  const lastWrittenRef = useRef<LastWrittenStorage>({});
  const draftClearedRef = useRef(false);
  const panelPortRef = useRef<chrome.runtime.Port | null>(null);
  const [storageRestored, setStorageRestored] = useState(false);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: PANEL_PORT_NAME });
    panelPortRef.current = port;
    let disconnected = false;
    void chrome.windows.getCurrent().then((currentWindow) => {
      if (disconnected || typeof currentWindow.id !== "number") return;
      setCurrentWindowId(currentWindow.id);
      port.postMessage({ type: "panel-connected", windowId: currentWindow.id } satisfies PanelPortMessage);
    }).catch(() => undefined);
    return () => {
      disconnected = true;
      if (panelPortRef.current === port) panelPortRef.current = null;
      try {
        port.disconnect();
      } catch {
        // The service worker may already have closed the channel.
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await chrome.storage.local.get([
          EVIDENCE_STORAGE_KEY,
          DRAFT_STORAGE_KEY,
          AUDIT_STORAGE_KEY,
          CAPTURE_TAB_STORAGE_KEY,
          QUEUED_FINDING_STORAGE_KEY,
          SAVED_FINDING_STORAGE_KEY,
        ]);
        if (cancelled) return;
        const restored = stored[EVIDENCE_STORAGE_KEY]
          ? restoreEvidencePacket(stored[EVIDENCE_STORAGE_KEY])
          : null;
        const restoredEvidence = restored?.evidence ?? null;
        if (restored?.recoveredFields.length) {
          void writeLocal({ [EVIDENCE_STORAGE_KEY]: restoredEvidence }).catch(() => {
            if (!cancelled) setStatus({
              text: "The saved note was recovered for this session, but extension storage could not be updated.",
              tone: "danger",
            });
          });
          setStatus({
            text: "A saved note exceeded its character limit. It was truncated and the rest of the capture was recovered.",
            tone: "neutral",
          });
        }
        const expired = Boolean(
          restoredEvidence && Date.now() - restoredEvidence.capturedAt > EVIDENCE_RETENTION_MS,
        );
        if (expired) {
          await chrome.storage.local.remove([
            EVIDENCE_STORAGE_KEY,
            DRAFT_STORAGE_KEY,
            CAPTURE_TAB_STORAGE_KEY,
            QUEUED_FINDING_STORAGE_KEY,
            SAVED_FINDING_STORAGE_KEY,
          ]);
          setStatus({ text: "The previous capture expired after 24 hours and was removed from local extension storage.", tone: "neutral" });
        } else {
          setEvidence(restoredEvidence);
          if (stored[DRAFT_STORAGE_KEY]) {
            draftClearedRef.current = false;
            setDraft(parseAiFindingDraft(stored[DRAFT_STORAGE_KEY]));
          }
          const queued = stored[QUEUED_FINDING_STORAGE_KEY] as Record<string, unknown> | undefined;
          if (
            queued &&
            typeof queued.key === "string" &&
            (queued.source === "local" || queued.source === "ai")
          ) {
            setQueuedFinding({ key: queued.key, source: queued.source });
          }
          setSavedFinding(restoreSavedFindingMarker(
            stored[SAVED_FINDING_STORAGE_KEY],
            restoredEvidence?.findingId,
          ));
        }
        const storedAudit = typeof stored[AUDIT_STORAGE_KEY] === "string" ? stored[AUDIT_STORAGE_KEY] : "";
        selectedAuditRef.current = storedAudit;
        setSelectedAudit(storedAudit);
        const storedTabId = !expired && typeof stored[CAPTURE_TAB_STORAGE_KEY] === "number"
          ? stored[CAPTURE_TAB_STORAGE_KEY]
          : null;
        setCapturedTabId(storedTabId);
        if (storedTabId !== null) notifyEvidenceSeen(storedTabId);
        await checkDesktop(false, storedAudit);
      } catch {
        await chrome.storage.local.remove([
          EVIDENCE_STORAGE_KEY,
          DRAFT_STORAGE_KEY,
          CAPTURE_TAB_STORAGE_KEY,
          QUEUED_FINDING_STORAGE_KEY,
          SAVED_FINDING_STORAGE_KEY,
        ]);
        if (!cancelled) setStatus({ text: "The saved capture could not be restored. Start a new capture.", tone: "danger" });
      } finally {
        if (!cancelled) setStorageRestored(true);
      }
    })();
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName,
    ) => {
      if (areaName !== "local") return;
      try {
        if (changes[EVIDENCE_STORAGE_KEY]) {
          const next = changes[EVIDENCE_STORAGE_KEY].newValue;
          if (!consumeOwnStorageEcho(lastWrittenRef.current, EVIDENCE_STORAGE_KEY, next)) {
            if (next) {
              const restored = restoreEvidencePacket(next);
              evidenceRef.current = restored.evidence;
              setEvidence(restored.evidence);
              if (restored.recoveredFields.length) {
                void writeLocal({ [EVIDENCE_STORAGE_KEY]: restored.evidence }).catch(() => {
                  setStatus({
                    text: "The saved note was recovered for this session, but extension storage could not be updated.",
                    tone: "danger",
                  });
                });
                setStatus({
                  text: "A saved note exceeded its character limit. It was truncated and the rest of the capture was recovered.",
                  tone: "neutral",
                });
              }
            } else {
              evidenceRef.current = null;
              setEvidence(null);
            }
          }
        }
        if (changes[DRAFT_STORAGE_KEY]) {
          const next = changes[DRAFT_STORAGE_KEY].newValue;
          if (!consumeOwnStorageEcho(lastWrittenRef.current, DRAFT_STORAGE_KEY, next)) {
            draftClearedRef.current = !next;
            setDraft(next ? parseAiFindingDraft(next) : null);
          }
        }
        if (changes[CAPTURE_TAB_STORAGE_KEY]) {
          const next = changes[CAPTURE_TAB_STORAGE_KEY].newValue;
          const tabId = typeof next === "number" ? next : null;
          setCapturedTabId(tabId);
          if (tabId !== null) notifyEvidenceSeen(tabId);
        }
        if (changes[QUEUED_FINDING_STORAGE_KEY]) {
          const next = changes[QUEUED_FINDING_STORAGE_KEY].newValue as Record<string, unknown> | undefined;
          setQueuedFinding(
            next &&
              typeof next.key === "string" &&
              (next.source === "local" || next.source === "ai")
              ? { key: next.key, source: next.source }
              : null,
          );
        }
        if (changes[SAVED_FINDING_STORAGE_KEY]) {
          setSavedFinding(restoreSavedFindingMarker(
            changes[SAVED_FINDING_STORAGE_KEY].newValue,
            evidenceRef.current?.findingId,
          ));
        }
      } catch {
        setStatus({ text: "The saved capture could not be restored. Start a new capture.", tone: "danger" });
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    selectedAuditRef.current = selectedAudit;
  }, [selectedAudit]);

  useEffect(() => {
    evidenceRef.current = evidence;
  }, [evidence]);

  useEffect(() => {
    if (!status) return;
    statusRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (!evidence) return;
    const timeout = setTimeout(() => {
      void writeLocal({ [EVIDENCE_STORAGE_KEY]: evidence }).catch(reportStorageWriteFailure);
    }, 250);
    return () => clearTimeout(timeout);
  }, [evidence]);

  useEffect(() => {
    const action = draftPersistenceAction(storageRestored, draft);
    if (action === "none") return;
    const timeout = setTimeout(() => {
      if (action === "set" && !draftClearedRef.current) {
        void writeLocal({ [DRAFT_STORAGE_KEY]: draft }).catch(reportStorageWriteFailure);
      } else {
        void chrome.storage.local.remove(DRAFT_STORAGE_KEY).catch(reportStorageWriteFailure);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [draft, storageRestored]);

  async function writeLocal(values: Record<string, unknown>): Promise<void> {
    rememberStorageWrite(lastWrittenRef.current, values);
    try {
      await chrome.storage.local.set(values);
    } catch (error) {
      for (const [key, value] of Object.entries(values)) {
        consumeOwnStorageEcho(lastWrittenRef.current, key, value);
      }
      throw error;
    }
  }

  function reportStorageWriteFailure(error: unknown): void {
    setStatus({ text: storageWriteFailureMessage(error), tone: "danger" });
  }

  function notifyEvidenceSeen(tabId: number): void {
    try {
      panelPortRef.current?.postMessage({ type: "evidence-seen", tabId } satisfies PanelPortMessage);
    } catch {
      // The service worker owns badge state and may be restarting between messages.
    }
  }

  async function clearDraft(): Promise<void> {
    draftClearedRef.current = true;
    setDraft(null);
    await chrome.storage.local.remove(DRAFT_STORAGE_KEY);
  }

  async function checkDesktop(requestPermission: boolean, preferredAuditId = selectedAuditRef.current) {
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
      const preferred = nextAudits.some((audit) => audit.id === preferredAuditId)
        ? preferredAuditId
        : nextAudits.find((audit) => audit.active)?.id || nextAudits[0]?.id || "";
      selectedAuditRef.current = preferred;
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
    setStatus({
      text: mode === "element"
        ? "Select an element with the pointer, or use Tab or arrow keys and press Enter. Press Escape to cancel."
        : "Drag around the affected region, or use Tab or arrow keys and press Enter to capture a control region. Press Escape to cancel.",
      tone: "neutral",
    });
    try {
      const response = await chromeMessage<ExtensionResponse>({ type: "capture:start", mode });
      if (!response.ok) {
        if (!response.cancelled) setStatus({ text: response.message, tone: "danger" });
        else setStatus(null);
        return;
      }
      const packet = response.evidence;
      setEvidence(packet);
      await clearDraft();
      setQueuedFinding(null);
      setSavedFinding(null);
      setStatus({ text: "Component captured. Describe the issue, then send it to review.", tone: "success" });
    } catch (error) {
      setStatus({ text: displayError(error), tone: "danger" });
    } finally {
      setCapturing(null);
    }
  }

  function patchEvidence(patch: Partial<EvidencePacketV1>) {
    const bounded = clampEvidencePatch(patch);
    setEvidence((current) => current ? { ...current, ...bounded } : current);
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
      draftClearedRef.current = false;
      setDraft(nextDraft);
      await writeLocal({ [EVIDENCE_STORAGE_KEY]: scoped, [DRAFT_STORAGE_KEY]: nextDraft });
      if (nextDraft.provenance.source === "ai") setStatus({ text: "AI draft ready. Confirm every field before saving.", tone: "success" });
      else if (fallbackMessage) setStatus({ text: fallbackMessage, tone: "neutral" });
      else setStatus({ text: "Local structured draft ready. Connect the desktop app to enable AI authoring.", tone: "success" });
    } catch (error) {
      setStatus({ text: displayError(error), tone: "danger" });
    } finally {
      setGenerating(false);
    }
  }

  async function queueForReview() {
    if (!evidence || !selectedAudit) return;
    if (evidence.observation.trim().length < 8) {
      setStatus({ text: "Describe what happened before sending this issue for review.", tone: "danger" });
      return;
    }
    setSaving(true);
    try {
      const approved = applyConsent(evidence, { includeScreenshot, includeElementText, includeUrl });
      const scoped = parseEvidencePacket({ ...approved, auditId: selectedAudit });
      const queued = await queueDesktopFinding(selectedAudit, scoped);
      setEvidence(scoped);
      await clearDraft();
      setSavedFinding(null);
      setQueuedFinding({ key: queued.findingKey, source: queued.draftSource });
      await writeLocal({
        [EVIDENCE_STORAGE_KEY]: scoped,
        [QUEUED_FINDING_STORAGE_KEY]: {
          key: queued.findingKey,
          source: queued.draftSource,
        },
      });
      await chrome.storage.local.remove(SAVED_FINDING_STORAGE_KEY);
      setStatus({
        text: `Issue sent to ${audits.find((audit) => audit.id === selectedAudit)?.project || "the desktop audit"}. It is in Needs review and no auditor decision was applied.`,
        tone: "success",
      });
    } catch (error) {
      setStatus({ text: displayError(error), tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  async function saveFinding() {
    if (!evidence || !draft || !selectedAudit) return;
    if (!draft.wcag.length) {
      setStatus({ text: "Add and confirm at least one WCAG 2.2 criterion before saving the finding.", tone: "danger" });
      return;
    }
    setSaving(true);
    try {
      const validated = parseAiFindingDraft(draft);
      const scoped = parseEvidencePacket({ ...evidence, auditId: selectedAudit });
      const findingKey = await saveDesktopFinding(selectedAudit, scoped, validated);
      const marker: SavedFindingMarker = {
        key: findingKey,
        findingId: scoped.findingId,
        auditId: selectedAudit,
      };
      setEvidence(scoped);
      setQueuedFinding(null);
      setSavedFinding(marker);
      try {
        await writeLocal({
          [EVIDENCE_STORAGE_KEY]: scoped,
          [SAVED_FINDING_STORAGE_KEY]: marker,
        });
        await clearDraft();
        await chrome.storage.local.remove(QUEUED_FINDING_STORAGE_KEY);
        setStatus({ text: "Finding saved to the selected desktop audit.", tone: "success" });
      } catch (error) {
        setStatus({
          text: `Finding saved to the desktop audit. ${storageWriteFailureMessage(error)}`,
          tone: "danger",
        });
      }
    } catch (error) {
      setStatus({ text: displayError(error), tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (capturedTabId !== null) {
      notifyEvidenceSeen(capturedTabId);
    }
    setEvidence(null);
    draftClearedRef.current = true;
    setDraft(null);
    setQueuedFinding(null);
    setSavedFinding(null);
    setCapturedTabId(null);
    setStatus(null);
    await chrome.storage.local.remove([
      EVIDENCE_STORAGE_KEY,
      DRAFT_STORAGE_KEY,
      CAPTURE_TAB_STORAGE_KEY,
      QUEUED_FINDING_STORAGE_KEY,
      SAVED_FINDING_STORAGE_KEY,
    ]);
  }

  function addWcagMapping() {
    if (!draft || draft.wcag.length >= 8) return;
    const nextCriterion = WCAG_CRITERIA.find(
      (criterion) => !draft.wcag.some((mapping) => mapping.criterion === criterion.sc),
    );
    if (!nextCriterion) return;
    patchDraft({
      wcag: [
        ...draft.wcag,
        {
          criterion: nextCriterion.sc,
          level: nextCriterion.level,
          name: nextCriterion.name,
          rationale: "Confirm this criterion applies to the observed behavior.",
          confidence: "low",
        },
      ],
    });
  }

  function updateWcagCriterion(index: number, criterionId: string) {
    if (!draft) return;
    const criterion = WCAG_CRITERIA.find((item) => item.sc === criterionId);
    if (!criterion) return;
    patchDraft({
      wcag: draft.wcag.map((mapping, mappingIndex) =>
        mappingIndex === index
          ? { ...mapping, criterion: criterion.sc, name: criterion.name, level: criterion.level }
          : mapping,
      ),
    });
  }

  function removeWcagMapping(index: number) {
    if (!draft) return;
    patchDraft({ wcag: draft.wcag.filter((_, mappingIndex) => mappingIndex !== index) });
  }

  async function copyFinding() {
    if (!evidence || !draft) return;
    try {
      await navigator.clipboard.writeText(findingMarkdown(evidence, draft));
      setStatus({ text: "Finding copied as Markdown.", tone: "success" });
    } catch (error) {
      setStatus({ text: displayError(error), tone: "danger" });
    }
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
      <a className="skip-link" href="#extension-main">Skip to capture workspace</a>
      <header className="app-header">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div>
            <strong>TheWCAG</strong>
            <span>{surface === "popup" ? "Quick capture" : "Issue capture"}</span>
          </div>
        </div>
        <div className="header-actions">
          <span className={`connection connection-${desktopState}`} role="status" aria-live="polite">
            <span aria-hidden="true" />
            {desktopState === "connected" ? "Desktop ready" : desktopState === "checking" ? "Checking" : "Local mode"}
          </span>
          {surface === "popup" ? (
            <button className="icon-button" onClick={openWorkspace} aria-label="Open expanded evidence workspace" title="Open expanded workspace">
              <ArrowSquareOut size={20} />
            </button>
          ) : null}
        </div>
      </header>

      {status ? (
        <div className={`status status-${status.tone}`} role={status.tone === "danger" ? "alert" : "status"} tabIndex={-1} ref={statusRef}>
          {status.tone === "danger" ? <Warning size={16} weight="fill" /> : status.tone === "success" ? <CheckCircle size={16} weight="fill" /> : <Eye size={16} />}
          <span>{status.text}</span>
          <button onClick={() => setStatus(null)} aria-label="Dismiss message"><X size={20} /></button>
        </div>
      ) : null}

      <main id="extension-main" tabIndex={-1}>
        {savedFinding && evidence ? (
          <section className="queued-view" aria-labelledby="saved-heading">
            <CheckCircle size={32} weight="fill" aria-hidden="true" />
            <span className="step">Desktop audit</span>
            <h1 id="saved-heading">Finding saved</h1>
            <p>
              The finding is stored in {audits.find((audit) => audit.id === savedFinding.auditId)?.project || "the selected desktop audit"}.
              Repeated save requests for this capture will reuse the same finding.
            </p>
            <button
              type="button"
              className="finding-identity"
              title={savedFinding.findingId}
              onClick={() => {
                void navigator.clipboard.writeText(savedFinding.findingId);
                setStatus({ text: "Finding ID copied.", tone: "success" });
              }}
            >
              <span>Immutable finding ID</span>
              <code>{compactFindingId(savedFinding.findingId)}</code>
              <Copy size={20} />
            </button>
            <div className="action-stack">
              <button className="button button-primary button-full" onClick={() => void reset()}>
                <Plus size={20} /> Capture another issue
              </button>
            </div>
          </section>
        ) : queuedFinding && evidence ? (
          <section className="queued-view" aria-labelledby="queued-heading">
            <CheckCircle size={32} weight="fill" aria-hidden="true" />
            <span className="step">Desktop review queue</span>
            <h1 id="queued-heading">Issue sent for review</h1>
            <p>
              The screenshot, component context, and your observation were saved with the finding.
              {queuedFinding.source === "ai" ? " The desktop prepared an AI-assisted draft." : " A local structured draft was prepared."}
              {" "}An auditor must still confirm every field.
            </p>
            <div className="target-summary">
              <div className="target-icon"><Code size={20} /></div>
              <div><span>Queued component</span><strong>{targetLabel}</strong><code>{evidence.target.selector || evidence.target.structuralPath || "Visual region"}</code></div>
            </div>
            <div className="action-stack">
              <button className="button button-primary button-full" onClick={() => void reset()}>
                <Plus size={20} /> Capture another issue
              </button>
            </div>
          </section>
        ) : surface === "popup" && evidence ? (
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
                  <span><ImageSquare size={16} /> Context screenshot</span>
                  <strong><Crosshair size={16} /> {evidence.captureMode === "element" ? "Control highlighted" : "Region highlighted"}</strong>
                </figcaption>
              </figure>
            ) : null}
            <div className="target-summary">
              <div className="target-icon"><Code size={20} /></div>
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
                <ArrowSquareOut size={20} /> Add issue details
              </button>
              <button className="button button-secondary button-full" onClick={() => void reset()}>
                <ArrowCounterClockwise size={20} /> Start another capture
              </button>
            </div>
          </section>
        ) : !evidence ? (
          <section className="start-view" aria-labelledby="start-heading">
            <div className="intro-icon"><Crosshair size={24} /></div>
            <h1 id="start-heading">Capture the affected component.</h1>
            <p>Select a component or region, describe what happened, and send its screenshot and context to desktop review.</p>

            <div className="capture-actions">
              <button className="capture-card capture-primary" disabled={capturing !== null} onClick={() => void startCapture("element")}>
                <span className="capture-card-icon"><MouseSimple size={20} /></span>
                <span><strong>{capturing === "element" ? "Select on page" : "Component"}</strong><small>Controls, text, or images</small></span>
                <Crosshair size={20} />
              </button>
              <button className="capture-card" disabled={capturing !== null} onClick={() => void startCapture("region")}>
                <span className="capture-card-icon"><Selection size={20} /></span>
                <span><strong>{capturing === "region" ? "Drag on page" : "Region"}</strong><small>Several related elements</small></span>
                <Selection size={20} />
              </button>
            </div>

            <div className="privacy-note">
              <ShieldCheck size={20} />
              <div><strong>Local until you approve</strong><p>Evidence is reviewed in this panel before anything can be sent for AI generation.</p></div>
            </div>

            {desktopState !== "connected" ? (
              <button className="button button-secondary button-full" onClick={() => void checkDesktop(true)} disabled={desktopState === "checking"}>
                <Desktop size={20} /> {desktopState === "checking" ? "Checking desktop" : "Connect desktop app"}
              </button>
            ) : (
              <div className="desktop-card">
                <Desktop size={20} />
                <div><strong>TheWCAG {desktopVersion}</strong><span>{audits.length ? `${audits.length} local ${audits.length === 1 ? "audit" : "audits"}` : "No audits yet"}</span></div>
                <Check size={20} />
              </div>
            )}
          </section>
        ) : !draft ? (
          <section className="evidence-view" aria-labelledby="evidence-heading">
            <div className="section-heading">
              <div><span className="step">Issue capture</span><h1 id="evidence-heading">Describe the issue</h1></div>
              <button className="icon-button" onClick={() => void reset()} aria-label="Discard capture"><ArrowCounterClockwise size={20} /></button>
            </div>

            {evidence.image ? (
              <figure className="capture-preview">
                <img src={evidence.image.dataUrl} alt={`Page context showing ${targetLabel} highlighted in orange as issue 1`} />
                <figcaption>
                  <span><ImageSquare size={16} /> {evidence.image.width} × {evidence.image.height}</span>
                  <strong><Crosshair size={16} /> {evidence.captureMode === "element" ? "Control highlighted" : "Region highlighted"}</strong>
                </figcaption>
              </figure>
            ) : null}

            <div className="target-summary">
              <div className="target-icon"><Code size={20} /></div>
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
                    {check.outcome === "fail" ? <Warning size={16} weight="fill" /> : <Eye size={16} />}
                    <div><strong>{check.title}</strong><span>{check.wcag.length ? `WCAG ${check.wcag.join(", ")}` : "Manual review"}</span></div>
                  </div>
                ))}
              </section>
            ) : (
              <div className="quiet-callout"><Eye size={20} /><p>No deterministic issue was found for this target. Your observation will guide the draft and all mappings will require manual review.</p></div>
            )}

            <Field
              label="What did you observe?"
              value={evidence.observation}
              onChange={(observation) => patchEvidence({ observation })}
              multiline
              rows={4}
              hint="Describe the behavior, not the fix. Example: The button is announced only as “button.”"
              maxLength={EVIDENCE_EDITABLE_LIMITS.observation}
            />
            <Field
              label="Task context (optional)"
              value={evidence.taskContext}
              onChange={(taskContext) => patchEvidence({ taskContext })}
              hint="Example: Complete checkout or submit the support form"
              maxLength={EVIDENCE_EDITABLE_LIMITS.taskContext}
            />

            {desktopState === "connected" && audits.length ? (
              <label className="field">
                <span>Audit</span>
                <select value={selectedAudit} onChange={(event) => {
                  selectedAuditRef.current = event.target.value;
                  setSelectedAudit(event.target.value);
                  void chrome.storage.local.set({ [AUDIT_STORAGE_KEY]: event.target.value });
                }}>
                  {audits.map((audit) => <option value={audit.id} key={audit.id}>{audit.project}{audit.active ? " (active)" : ""}</option>)}
                </select>
              </label>
            ) : null}

            <fieldset className="payload-options">
              <legend>Send with issue</legend>
              <label><input type="checkbox" checked={includeScreenshot} onChange={(event) => setIncludeScreenshot(event.target.checked)} /><ImageSquare size={16} /><span><strong>Screenshot</strong><small>Marked context image</small></span></label>
              <label><input type="checkbox" checked={includeElementText} onChange={(event) => setIncludeElementText(event.target.checked)} /><Code size={16} /><span><strong>Component data</strong><small>Name, role, selector, and HTML details</small></span></label>
              <label><input type="checkbox" checked={includeUrl} onChange={(event) => setIncludeUrl(event.target.checked)} /><ArrowSquareOut size={16} /><span><strong>Page</strong><small>Title, address, browser/device details, and locale</small></span></label>
            </fieldset>

            <div className="consent-copy"><ShieldCheck size={20} /><p>Nothing is sent until you choose the action below. Desktop drafts stay in Needs review until an auditor confirms them.</p></div>
            {desktopState === "connected" && selectedAudit ? (
              <div className="action-stack compact-actions">
                <button className="button button-primary button-full" onClick={() => void queueForReview()} disabled={saving}>
                  <Desktop size={20} /> {saving ? "Sending issue" : "Send to desktop review"}
                </button>
                <button className="button button-quiet button-full" onClick={() => void generateDraft()} disabled={generating}>
                  <MagicWand size={20} /> {generating ? "Preparing draft" : "Edit draft here instead"}
                </button>
              </div>
            ) : (
              <div className="action-stack compact-actions">
                <button className="button button-primary button-full" onClick={() => void generateDraft()} disabled={generating}>
                  <MagicWand size={20} /> {generating ? "Preparing draft" : "Create local draft"}
                </button>
                <button className="button button-quiet button-full" onClick={() => void checkDesktop(true)} disabled={desktopState === "checking"}>
                  <Desktop size={20} /> Connect desktop
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="draft-view" aria-labelledby="draft-heading">
            <div className="section-heading">
              <div><span className="step">Finding draft</span><h1 id="draft-heading">Confirm the audit language</h1></div>
              <ConfidenceBadge value={draft.confidence} />
            </div>

            <div className={`draft-source ${draft.provenance.source === "ai" ? "draft-source-ai" : ""}`}>
              <Sparkle size={20} />
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
              <Copy size={20} />
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
                <div className="wcag-card" key={index}>
                  <div className="wcag-card-top">
                    <select aria-label={`WCAG criterion ${index + 1}`} value={mapping.criterion} onChange={(event) => updateWcagCriterion(index, event.target.value)}>
                      {WCAG_CRITERIA.map((criterion) => (
                        <option
                          key={criterion.sc}
                          value={criterion.sc}
                          disabled={draft.wcag.some((item, itemIndex) => itemIndex !== index && item.criterion === criterion.sc)}
                        >
                          {criterion.sc} {criterion.name} ({criterion.level})
                        </option>
                      ))}
                    </select>
                    <ConfidenceBadge value={mapping.confidence} />
                    <button type="button" className="button button-quiet" aria-label={`Remove WCAG ${mapping.criterion}`} onClick={() => removeWcagMapping(index)}>
                      <Trash size={20} /> Remove
                    </button>
                  </div>
                  <strong>{mapping.name} · Level {mapping.level}</strong>
                  <textarea aria-label={`WCAG rationale ${index + 1}`} rows={3} value={mapping.rationale} onChange={(event) => patchDraft({ wcag: draft.wcag.map((item, itemIndex) => itemIndex === index ? { ...item, rationale: event.target.value } : item) })} />
                </div>
              )) : <div className="quiet-callout"><Warning size={20} /><p>No criterion was assigned. Complete a manual review before saving this finding.</p></div>}
              <button type="button" className="button button-secondary button-full" disabled={draft.wcag.length >= 8} onClick={addWcagMapping}>
                <Plus size={20} /> Add WCAG criterion
              </button>
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
                  <Check size={20} /> {saving ? "Saving finding" : `Save to ${selectedAuditName || "desktop audit"}`}
                </button>
              ) : (
                <button className="button button-secondary button-full" onClick={() => void checkDesktop(true)}>
                  <Desktop size={20} /> Connect desktop to save
                </button>
              )}
              <button className="button button-secondary button-full" onClick={() => {
                const markdown = findingMarkdown(evidence, draft);
                download(`thewcag-${evidence.id.slice(0, 8)}.md`, markdown, "text/markdown;charset=utf-8");
                setStatus({ text: "Markdown draft exported.", tone: "success" });
              }}><DownloadSimple size={20} /> Export Markdown</button>
              <button className="button button-quiet button-full" onClick={() => void copyFinding()}><Copy size={20} /> Copy finding</button>
              <button className="button button-quiet button-full" onClick={() => void clearDraft()}><ArrowCounterClockwise size={20} /> Back to evidence</button>
            </div>
          </section>
        )}
      </main>

      <footer>
        <ShieldCheck size={16} />
        <span>{hasFailures ? "Deterministic failure captured" : "Human review remains required"}</span>
      </footer>
    </div>
  );
}
