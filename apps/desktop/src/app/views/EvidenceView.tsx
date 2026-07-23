import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CaretDown,
  Copy,
  FileArrowDown,
  FloppyDisk,
  FrameCorners,
  Image,
  MagnifyingGlass,
  NotePencil,
  PencilSimple,
  Plus,
  ShareNetwork,
  Sparkle,
  Trash,
  WarningCircle,
} from "../Icon";
import {
  compactFindingId,
  createFindingId,
  parseEvidencePacket,
  type EvidencePacketV1,
} from "@accessibility-build/audit-contracts";
import type {
  CaptureEntry,
  Finding,
  FindingSavedView,
  OverlayResult,
  WorkspaceStage,
} from "../../shared/desktop";
import { desktop, getStored, listCaptures, saveStoredFindings, setStored } from "../api";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Segmented,
  StatusBadge,
  Toast,
} from "../components";
import { messageFromError, useTransientMessage } from "../hooks";
import {
  STANDALONE_FINDINGS_KEY,
  STANDALONE_FINDING_VIEWS_KEY,
} from "../evidence-storage";
import {
  findingReferenceWithId,
  nextFindingReference,
  normalizeFindingReferences,
} from "../../shared/finding-references";
import { findingStatusHistoryAfterChange } from "../../shared/finding-lifecycle";
import { retainFindingSelection } from "../../shared/finding-selection";
import {
  findingEvidenceStoreKey,
  findingPrimaryEvidenceCaptureIds,
  unassignedCaptures,
} from "../../shared/finding-evidence";
import {
  FindingEditorDialog,
  type FindingEditorValue,
} from "../FindingEditorDialog";

type Tab = "captures" | "findings";
type BuiltInFindingView = "all" | "needs-review" | "blockers" | "retest" | "missing-mapping" | "overdue";

const BUILT_IN_FINDING_VIEWS: Array<{ id: BuiltInFindingView; label: string }> = [
  { id: "all", label: "All findings" },
  { id: "needs-review", label: "Needs review" },
  { id: "blockers", label: "Blockers" },
  { id: "retest", label: "Retest queue" },
  { id: "missing-mapping", label: "Missing WCAG mapping" },
  { id: "overdue", label: "Overdue remediation" },
];

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

export function EvidenceView({
  auditId,
  initialTab = "captures",
  onNavigate,
  recordActivity,
}: {
  auditId?: string;
  initialTab?: Tab;
  onNavigate?: (stage: WorkspaceStage) => void;
  recordActivity?: RecordAuditActivity;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [query, setQuery] = useState("");
  const [findingStatus, setFindingStatus] = useState<"all" | Finding["status"]>("all");
  const [findingSeverity, setFindingSeverity] = useState<"all" | Finding["severity"]>("all");
  const [findingSort, setFindingSort] = useState<
    "updated" | "severity" | "criterion" | "due"
  >("updated");
  const [findingViewId, setFindingViewId] = useState<string>("all");
  const [savedViews, setSavedViews] = useState<FindingSavedView[]>([]);
  const [savedViewName, setSavedViewName] = useState("");
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkOwner, setBulkOwner] = useState("");
  const [bulkStatus, setBulkStatus] = useState<"open" | "retest">("open");
  const [bulkSeverity, setBulkSeverity] = useState<Finding["severity"]>("major");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [captureToDelete, setCaptureToDelete] =
    useState<CaptureEntry | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [findingEvidence, setFindingEvidence] = useState<
    Record<string, EvidencePacketV1 | null>
  >({});
  const [message, show] = useTransientMessage(5000);
  const [editingFinding, setEditingFinding] = useState<Finding | null | undefined>(undefined);
  const deletedRef = useRef<{
    item: Finding;
    index: number;
    links: string[];
    evidence?: { key: string; value: unknown };
  } | null>(null);
  const bulkUndoRef = useRef<{ findings: Finding[]; label: string } | null>(null);
  const findingsWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const refreshVersion = useRef(0);
  const findingsKey = auditId ? auditStoreKey(auditId, "findings") : STANDALONE_FINDINGS_KEY;
  const findingViewsKey = auditId ? auditStoreKey(auditId, "findingViews") : STANDALONE_FINDING_VIEWS_KEY;
  const logActivity: RecordAuditActivity = recordActivity ?? (async () => undefined);

  function openCaptureForAnnotation(id: string) {
    void desktop.invoke("capture:open", { id })
      .catch((error) => show(messageFromError(error, "The capture could not be opened."), true));
  }

  function persistFindings(next: Finding[], previous: Finding[] = findings) {
    const key = findingsKey;
    const request = findingsWriteQueue.current.then(() => saveStoredFindings(key, previous, next));
    findingsWriteQueue.current = request.then(() => undefined, () => undefined);
    return request;
  }

  async function refresh() {
    const version = ++refreshVersion.current;
    const [nextCaptures, storedFindings, nextViews] = await Promise.all([
      listCaptures(auditId),
      getStored<Finding[]>(findingsKey, []),
      getStored<FindingSavedView[]>(findingViewsKey, []),
    ]);
    if (version !== refreshVersion.current) return;
    const normalized = normalizeFindingReferences(storedFindings);
    setCaptures(nextCaptures);
    setFindings(normalized.findings);
    setSavedViews(nextViews);
    setSelectedFindings((current) =>
      retainFindingSelection(current, normalized.findings),
    );
    if (normalized.changed) {
      const saved = await persistFindings(normalized.findings, storedFindings);
      setFindings(saved);
    }
  }

  useEffect(() => {
    setSelectedFindings(new Set());
    void refresh().catch((error) => show(messageFromError(error), true));
    const stopCapture = desktop.on("capture:saved", () => void refresh());
    const stopFindings = desktop.on<{ key: string | null }>("findings:changed", ({ key }) => {
      if (key === null || key === findingsKey) void refresh();
    });
    return () => {
      stopCapture();
      stopFindings();
    };
  }, [auditId, findingViewsKey, findingsKey]);
  useEffect(
    () =>
      desktop.on<OverlayResult>("capture:result", (result) => {
        if (result.mode === "capture") void refresh();
      }),
    [auditId],
  );

  async function startCapture(full = false) {
    setBusy(true);
    try {
      if (full) await desktop.invoke("capture:fullscreen", { auditId, standalone: !auditId });
      else await desktop.invoke("capture:begin", { mode: "capture", auditId, standalone: !auditId });
      await refresh();
      if (full)
        await logActivity({
          kind: "captured",
          title: "Full screen captured",
        });
      show(full ? "Full screen captured" : "Drag to select an area");
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCaptureDelete() {
    if (!captureToDelete) return;
    setDeleteBusy(true);
    try {
      await desktop.invoke("capture:delete", { id: captureToDelete.id });
      await refresh();
      setCaptureToDelete(null);
      show("Capture deleted");
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function updateFinding(key: string, patch: Partial<Finding>) {
    const currentFinding = findings.find((item) => item.key === key);
    if (!currentFinding) return;
    if (patch.status === "fixed" && !currentFinding.retestNote?.trim()) {
      setEditingFinding(currentFinding);
      show("Add a retest record before marking this finding verified fixed.", true);
      return;
    }
    if (patch.status === "accepted" && !currentFinding.riskAcceptance?.trim()) {
      setEditingFinding(currentFinding);
      show("Record the risk acceptance rationale before accepting this finding.", true);
      return;
    }
    const changedAt = Date.now();
    const next = findings.map((item) =>
      item.key === key
        ? {
            ...item,
            ...patch,
            statusHistory:
              patch.status === undefined
                ? item.statusHistory
                : findingStatusHistoryAfterChange(item, patch.status, changedAt),
            modifiedAt: changedAt,
            retestedAt:
              patch.status === "fixed" && item.status !== "fixed"
                ? changedAt
                : item.retestedAt,
          }
        : item,
    );
    setFindings(next);
    try {
      const saved = await persistFindings(next);
      setFindings(saved);
    } catch (error) {
      setFindings(findings);
      show(messageFromError(error), true);
    }
  }

  async function saveFinding(value: FindingEditorValue) {
    const now = Date.now();
    const existing = editingFinding;
    const nextFinding: Finding = {
      ...(existing ?? {
        id: createFindingId(now),
        key: `manual-${crypto.randomUUID()}`,
        reference: nextFindingReference(findings),
        createdAt: now,
        schemaVersion: 2 as const,
        source: "manual" as const,
      }),
      ...value,
      reviewState: "reviewed",
      title: value.title.trim(),
      wcag: value.wcag.trim(),
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
      note: value.note.trim(),
      retestNote: value.retestNote.trim(),
      statusHistory: findingStatusHistoryAfterChange(existing ?? undefined, value.status, now),
      modifiedAt: now,
      retestedAt:
        value.status === "fixed" && existing?.status !== "fixed"
          ? now
          : existing?.retestedAt,
    };
    const next = existing
      ? findings.map((item) => item.key === existing.key ? nextFinding : item)
      : [nextFinding, ...findings];
    try {
      const saved = await persistFindings(next);
      setFindings(saved);
      setEditingFinding(undefined);
      try {
        await logActivity({
          kind: "finding",
          title: existing ? "Finding updated" : "Manual finding created",
          detail: nextFinding.title,
        });
      } catch (error) {
        show(
          `${existing ? "Finding updated" : "Finding created"}, but its activity entry could not be saved: ${messageFromError(error)}`,
          true,
        );
        return;
      }
      show(existing ? "Finding updated" : "Finding created");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function saveTicketFinding(updated: Finding) {
    const prior = findings;
    const next = findings.map((item) => item.key === updated.key ? updated : item);
    setFindings(next);
    setEditingFinding(updated);
    try {
      const saved = await persistFindings(next);
      setFindings(saved);
      setEditingFinding(saved.find((item) => item.key === updated.key));
    } catch (error) {
      setFindings(prior);
      setEditingFinding(prior.find((item) => item.key === updated.key));
      throw error;
    }
  }

  async function removeFinding(key: string) {
    const index = findings.findIndex((item) => item.key === key);
    if (index < 0) return;
    const removed = findings[index];
    const next = findings.filter((item) => item.key !== key);
    const checklistKey = auditId ? auditStoreKey(auditId, "checklist") : null;
    const evidenceKey = findingEvidenceStoreKey(removed);
    let evidenceValue: unknown = null;
    let checklist: Record<string, { result: string; note: string; findingKey?: string }> = {};
    let links: string[] = [];
    try {
      if (checklistKey) {
        checklist = await getStored<Record<string, { result: string; note: string; findingKey?: string }>>(
          checklistKey,
          {},
        );
      }
      if (evidenceKey) {
        evidenceValue = await getStored<unknown | null>(evidenceKey, null);
      }
      links = Object.entries(checklist)
        .filter(([, entry]) => entry.findingKey === key)
        .map(([criterion]) => criterion);
      const nextChecklist = Object.fromEntries(
        Object.entries(checklist).map(([criterion, entry]) => [
          criterion,
          entry.findingKey === key ? { ...entry, findingKey: undefined } : entry,
        ]),
      );
      if (checklistKey) await setStored(checklistKey, nextChecklist);
      if (evidenceKey) {
        await desktop.invoke("store:remove", { key: evidenceKey });
      }
      try {
        const saved = await persistFindings(next);
        setFindings(saved);
      } catch (error) {
        await Promise.all([
          checklistKey
            ? setStored(checklistKey, checklist)
            : Promise.resolve(),
          evidenceKey && evidenceValue !== null
            ? setStored(evidenceKey, evidenceValue)
            : Promise.resolve(),
        ]).catch(() => undefined);
        throw error;
      }
      deletedRef.current = {
        item: removed,
        index,
        links,
        ...(evidenceKey && evidenceValue !== null
          ? { evidence: { key: evidenceKey, value: evidenceValue } }
          : {}),
      };
      show("Finding removed. Use Undo below to restore it.");
    } catch (error) {
      if (checklistKey) {
        await setStored(checklistKey, checklist).catch(() => undefined);
      }
      show(messageFromError(error), true);
    }
  }

  async function undoFinding() {
    const deleted = deletedRef.current;
    if (!deleted) return;
    const next = [...findings];
    next.splice(deleted.index, 0, deleted.item);
    const checklistKey = auditId ? auditStoreKey(auditId, "checklist") : null;
    const checklist = checklistKey
      ? await getStored<Record<string, { result: string; note: string; findingKey?: string }>>(
          checklistKey,
          {},
        )
      : {};
    const nextChecklist = Object.fromEntries(
      Object.entries(checklist).map(([criterion, entry]) => [
        criterion,
        deleted.links.includes(criterion)
          ? { ...entry, findingKey: deleted.item.key }
          : entry,
      ]),
    );
    deletedRef.current = null;
    const [saved] = await Promise.all([
      persistFindings(next),
      checklistKey ? setStored(checklistKey, nextChecklist) : Promise.resolve(),
      deleted.evidence
        ? setStored(deleted.evidence.key, deleted.evidence.value)
        : Promise.resolve(),
    ]);
    setFindings(saved);
    show("Finding restored");
  }

  async function toggleFinding(item: Finding) {
    if (expandedFinding === item.key) {
      setExpandedFinding(null);
      return;
    }
    setExpandedFinding(item.key);
    if (!item.evidenceId || Object.hasOwn(findingEvidence, item.key)) return;
    try {
      const stored = await getStored<unknown | null>(
        `evidence-${item.evidenceId}`,
        null,
      );
      setFindingEvidence((current) => ({
        ...current,
        [item.key]: stored ? parseEvidencePacket(stored) : null,
      }));
    } catch {
      setFindingEvidence((current) => ({ ...current, [item.key]: null }));
    }
  }

  async function exportMarkdown(items = findings) {
    const findingSections = items.map((item) => {
      const section = [
        `## ${findingReferenceWithId(item)}: ${item.title}`,
        "",
        `- Finding ID: ${item.id}`,
        `- WCAG: ${item.wcag}`,
        `- Severity: ${item.severity}`,
        `- Status: ${item.status}`,
        item.location ? `- Location: ${item.location}` : "",
        item.owner ? `- Owner: ${item.owner}` : "",
        item.ticket ? `- Ticket: ${item.ticket}` : "",
        item.dueDate ? `- Target date: ${item.dueDate}` : "",
        item.duplicateOf ? `- Duplicated from: ${item.duplicateOf}` : "",
        item.occurrences?.length ? `- Confirmed occurrences: ${item.occurrences.length}` : "",
        item.affectedUsers?.length
          ? `- Affected users: ${item.affectedUsers.join(", ")}`
          : "",
        item.note ? `- Note: ${item.note}` : "",
      ];
      const addSection = (heading: string, value?: string) => {
        if (!value) return;
        section.push("", `### ${heading}`, "", value);
      };
      addSection("Actual result", item.actualResult);
      addSection("Expected result", item.expectedResult);
      addSection("User impact", item.userImpact);
      addSection("Severity rationale", item.severityRationale);
      addSection("Suggested resolution", item.recommendation);
      addSection("Risk acceptance", item.riskAcceptance);
      addSection("Retest record", item.retestNote);
      addSection("Before and after comparison", item.comparisonNote);
      if (item.occurrences?.length) {
        section.push("", "### Confirmed occurrences", "");
        item.occurrences.forEach((occurrence, index) => {
          section.push(
            `${index + 1}. ${occurrence.location || "Location not documented"}${occurrence.note ? `: ${occurrence.note}` : ""}`,
          );
        });
      }
      if (item.exampleFix) {
        section.push("", "### Example fix", "", `\`\`\`html\n${item.exampleFix}\n\`\`\``);
      }
      return section.filter(Boolean).join("\n");
    });
    const lines = [
      "# Accessibility findings",
      "",
      `Exported ${new Date().toLocaleDateString()}`,
      "",
      ...findingSections,
    ];
    const path = await desktop.invoke<string | null>("dialog:save-text", {
      name: "accessibility-findings.md",
      text: lines.join("\n"),
    });
    if (path) {
      await logActivity({
        kind: "exported",
        title: "Findings exported",
        detail: `${items.length} findings in Markdown`,
      });
      show("Findings exported");
    }
  }

  function chooseFindingView(id: string) {
    setFindingViewId(id);
    setSelectedFindings(new Set());
    const saved = savedViews.find((view) => view.id === id);
    if (saved) {
      setQuery(saved.query);
      setFindingStatus(saved.status);
      setFindingSeverity(saved.severity);
      setFindingSort(saved.sort);
      return;
    }
    setQuery("");
    setFindingStatus("all");
    setFindingSeverity("all");
    setFindingSort(id === "overdue" ? "due" : id === "blockers" ? "severity" : "updated");
  }

  async function saveFindingView() {
    const name = savedViewName.trim();
    if (!name) return;
    const view: FindingSavedView = {
      id: `view-${crypto.randomUUID()}`,
      name: name.slice(0, 60),
      query,
      status: findingStatus,
      severity: findingSeverity,
      sort: findingSort,
      createdAt: Date.now(),
    };
    const next = [...savedViews, view];
    try {
      await setStored(findingViewsKey, next);
      setSavedViews(next);
      setFindingViewId(view.id);
      setSavedViewName("");
      show("Finding view saved");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function deleteSavedView() {
    if (!findingViewId.startsWith("view-")) return;
    const next = savedViews.filter((view) => view.id !== findingViewId);
    try {
      await setStored(findingViewsKey, next);
      setSavedViews(next);
      chooseFindingView("all");
      show("Saved view deleted");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function duplicateFinding(item: Finding) {
    const now = Date.now();
    const duplicate: Finding = {
      ...item,
      id: createFindingId(now),
      key: `manual-${crypto.randomUUID()}`,
      reference: nextFindingReference(findings),
      duplicateOf: item.reference,
      duplicateOfId: item.id,
      status: "open",
      location: "",
      evidenceCaptureIds: [],
      captureId: undefined,
      beforeCaptureId: undefined,
      afterCaptureId: undefined,
      comparisonNote: "",
      occurrences: [],
      owner: "",
      ticket: "",
      dueDate: "",
      riskAcceptance: "",
      retestNote: "",
      retestedAt: undefined,
      statusHistory: [{ status: "open", changedAt: now }],
      createdAt: now,
      modifiedAt: now,
      source: "manual",
      reviewState: "reviewed",
    };
    const next = [duplicate, ...findings];
    try {
      const saved = await persistFindings(next);
      setFindings(saved);
      setEditingFinding(saved.find((finding) => finding.key === duplicate.key) ?? duplicate);
      await logActivity({
        kind: "finding",
        title: "Finding duplicated",
        detail: `${duplicate.reference} from ${item.reference}`,
      });
      show("Duplicate created. Add its location and evidence.");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function applyBulkPatch(patch: Partial<Finding>, label: string) {
    if (!selectedFindings.size) return;
    const previous = findings;
    const now = Date.now();
    const next = findings.map((finding) =>
      selectedFindings.has(finding.key)
        ? {
            ...finding,
            ...patch,
            statusHistory:
              patch.status === undefined
                ? finding.statusHistory
                : findingStatusHistoryAfterChange(finding, patch.status, now),
            modifiedAt: now,
          }
        : finding,
    );
    try {
      const saved = await persistFindings(next);
      bulkUndoRef.current = { findings: previous, label };
      setFindings(saved);
      const count = selectedFindings.size;
      setSelectedFindings(new Set());
      await logActivity({
        kind: "finding",
        title: "Bulk finding update",
        detail: `${label}, ${count} findings`,
      });
      show(`${label} applied to ${count} findings`);
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function undoBulkUpdate() {
    const undo = bulkUndoRef.current;
    if (!undo) return;
    try {
      const undoByKey = new Map(undo.findings.map((finding) => [finding.key, finding]));
      const next = findings.map((finding) => undoByKey.get(finding.key) ?? finding);
      const saved = await persistFindings(next);
      setFindings(saved);
      bulkUndoRef.current = null;
      show(`${undo.label} undone`);
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  const filteredCaptures = useMemo(
    () =>
      captures.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [captures, query],
  );
  const unassignedCaptureIds = useMemo(
    () => new Set(unassignedCaptures(captures, findings).map((capture) => capture.id)),
    [captures, findings],
  );
  const filteredFindings = useMemo(
    () =>
      findings
        .filter((item) =>
          (findingViewId !== "needs-review" || item.reviewState === "pending") &&
          (findingViewId !== "blockers" || item.severity === "blocker") &&
          (findingViewId !== "retest" || item.status === "retest") &&
          (findingViewId !== "missing-mapping" || !item.wcag.trim() || /needs/i.test(item.wcag)) &&
          (findingViewId !== "overdue" ||
            ((item.status === "open" || item.status === "retest") &&
              Boolean(item.dueDate) &&
              item.dueDate! < new Date().toISOString().slice(0, 10))) &&
          (findingStatus === "all" || item.status === findingStatus) &&
          (findingSeverity === "all" || item.severity === findingSeverity) &&
          `${item.id} ${item.reference ?? ""} ${item.title} ${item.wcag} ${item.location ?? ""} ${item.owner ?? ""} ${item.ticket ?? ""} ${item.note} ${item.actualResult ?? ""} ${item.userImpact ?? ""} ${item.recommendation ?? ""} ${(item.occurrences ?? []).map((occurrence) => `${occurrence.location} ${occurrence.note}`).join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((left, right) => {
          if (findingSort === "severity") {
            const priority = { blocker: 0, major: 1, minor: 2 };
            return priority[left.severity] - priority[right.severity];
          }
          if (findingSort === "criterion") {
            return left.wcag.localeCompare(right.wcag, undefined, { numeric: true });
          }
          if (findingSort === "due") {
            return (left.dueDate || "9999-12-31").localeCompare(
              right.dueDate || "9999-12-31",
            );
          }
          return (right.modifiedAt || right.createdAt) - (left.modifiedAt || left.createdAt);
        }),
    [findingSeverity, findingSort, findingStatus, findingViewId, findings, query],
  );
  const pendingReviewCount = findings.filter((item) => item.reviewState === "pending").length;
  const selectedVisible = filteredFindings.filter((item) =>
    selectedFindings.has(item.key),
  );

  return (
    <div className="evidence-view">
      <Toast message={message} />
      <section className="capture-banner">
        <div className="capture-illustration">
          <FrameCorners size={32} />
          <span>
            <Camera size={16} />
          </span>
        </div>
        <div>
          <span className="section-label">{auditId ? "Optional capture library" : "Standalone screenshot workspace"}</span>
          <h2>{auditId ? "Capture here, or add evidence inside a finding" : "Capture and annotate without starting an audit"}</h2>
          <p>
            {auditId
              ? "Finding authoring is the fastest way to keep evidence linked. This library remains available for capture-only work and legacy unassigned images."
              : "Select a region or the current display. Annotate, copy, or export it locally—no audit or finding is created."}
          </p>
        </div>
        <div className="capture-actions">
          <Button
            id="capture-annotate-action"
            variant="primary"
            icon={FrameCorners}
            disabled={busy}
            onClick={() => void startCapture(false)}
          >
            Select region
          </Button>
          <Button
            icon={Camera}
            disabled={busy}
            onClick={() => void startCapture(true)}
          >
            Full screen
          </Button>
        </div>
      </section>

      <div className="library-toolbar">
        {auditId ? (
          <Segmented
            value={tab}
            onChange={setTab}
            label="Library type"
            options={[
              { value: "captures", label: `Captures ${captures.length}` },
              { value: "findings", label: `Findings ${findings.length}` },
            ]}
          />
        ) : <strong className="standalone-library-label">Recent local captures · {captures.length}/100</strong>}
        <label className="search-field">
          <MagnifyingGlass size={16} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (tab === "findings") setFindingViewId("all");
            }}
            placeholder={`Search ${tab}`}
            aria-label={`Search ${tab}`}
          />
        </label>
        <div className="toolbar-spacer" />
        {tab === "captures" ? (
          <Button icon={Plus} onClick={() => void startCapture(false)}>
            New capture
          </Button>
        ) : (
          <>
            <Button icon={Plus} onClick={() => setEditingFinding(null)}>
              Add finding
            </Button>
            <Button icon={FileArrowDown} onClick={() => void exportMarkdown()}>
              Export
            </Button>
            <Button
              variant="primary"
              icon={ShareNetwork}
              disabled={!findings.length || !captures.length}
              onClick={() => onNavigate?.("share")}
            >
              Review report
            </Button>
          </>
        )}
      </div>

      {tab === "findings" ? (
        <div className="finding-controlbar">
          <Field label="View">
            <select
              value={findingViewId}
              onChange={(event) => chooseFindingView(event.target.value)}
            >
              {BUILT_IN_FINDING_VIEWS.map((view) => (
                <option key={view.id} value={view.id}>{view.label}</option>
              ))}
              {savedViews.length ? (
                <optgroup label="Saved views">
                  {savedViews.map((view) => (
                    <option key={view.id} value={view.id}>{view.name}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={findingStatus}
              onChange={(event) => {
                setFindingStatus(event.target.value as typeof findingStatus);
                setFindingViewId("all");
              }}
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="retest">Ready for retest</option>
              <option value="fixed">Verified fixed</option>
              <option value="accepted">Risk accepted</option>
            </select>
          </Field>
          <Field label="Severity">
            <select
              value={findingSeverity}
              onChange={(event) => {
                setFindingSeverity(event.target.value as typeof findingSeverity);
                setFindingViewId("all");
              }}
            >
              <option value="all">All severities</option>
              <option value="blocker">Blocker</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </Field>
          <Field label="Sort">
            <select
              value={findingSort}
              onChange={(event) => {
                setFindingSort(event.target.value as typeof findingSort);
                setFindingViewId("all");
              }}
            >
              <option value="updated">Recently updated</option>
              <option value="severity">Severity</option>
              <option value="criterion">WCAG criterion</option>
              <option value="due">Target date</option>
            </select>
          </Field>
          <form
            className="save-view-control"
            onSubmit={(event) => {
              event.preventDefault();
              void saveFindingView();
            }}
          >
            <Field label="Save current filters">
              <input
                value={savedViewName}
                onChange={(event) => setSavedViewName(event.target.value)}
                placeholder="My review queue"
                maxLength={60}
              />
            </Field>
            <Button type="submit" icon={FloppyDisk} disabled={!savedViewName.trim()}>
              Save
            </Button>
          </form>
          {findingViewId.startsWith("view-") ? (
            <button
              className="row-action"
              aria-label="Delete selected saved view"
              onClick={() => void deleteSavedView()}
            >
              <Trash size={20} />
            </button>
          ) : null}
          <Button
            disabled={!filteredFindings.length}
            onClick={() =>
              setSelectedFindings(
                selectedVisible.length === filteredFindings.length
                  ? new Set()
                  : new Set(filteredFindings.map((finding) => finding.key)),
              )
            }
          >
            {filteredFindings.length &&
            selectedVisible.length === filteredFindings.length
              ? "Clear visible"
              : `Select visible${filteredFindings.length ? ` (${filteredFindings.length})` : ""}`}
          </Button>
        </div>
      ) : null}

      {tab === "findings" && selectedFindings.size ? (
        <div className="bulk-finding-bar" role="region" aria-label="Bulk finding actions">
          <strong>{selectedFindings.size} selected</strong>
          <label>
            <span>Owner</span>
            <input value={bulkOwner} onChange={(event) => setBulkOwner(event.target.value)} placeholder="Team or person" />
          </label>
          <Button disabled={!bulkOwner.trim()} onClick={() => void applyBulkPatch({ owner: bulkOwner.trim() }, "Owner update")}>Set owner</Button>
          <label>
            <span>Status</span>
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as typeof bulkStatus)}>
              <option value="open">Open</option>
              <option value="retest">Ready for retest</option>
            </select>
          </label>
          <Button onClick={() => void applyBulkPatch({ status: bulkStatus }, "Status update")}>Set status</Button>
          <label>
            <span>Severity</span>
            <select value={bulkSeverity} onChange={(event) => setBulkSeverity(event.target.value as Finding["severity"])}>
              <option value="blocker">Blocker</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </label>
          <Button onClick={() => void applyBulkPatch({ severity: bulkSeverity }, "Severity update")}>Set severity</Button>
          <label>
            <span>Target date</span>
            <input type="date" value={bulkDueDate} onChange={(event) => setBulkDueDate(event.target.value)} />
          </label>
          <Button disabled={!bulkDueDate} onClick={() => void applyBulkPatch({ dueDate: bulkDueDate }, "Target date update")}>Set date</Button>
          <Button icon={FileArrowDown} onClick={() => void exportMarkdown(selectedVisible)}>Export selected</Button>
          <button className="text-action" onClick={() => setSelectedFindings(new Set())}>Clear selection</button>
        </div>
      ) : null}

      {deletedRef.current && tab === "findings" ? (
        <div className="undo-strip" role="status">
          <span>A finding was removed.</span>
          <button onClick={() => void undoFinding()}>Undo</button>
        </div>
      ) : null}
      {bulkUndoRef.current && tab === "findings" ? (
        <div className="undo-strip" role="status">
          <span>{bulkUndoRef.current.label} was applied.</span>
          <button onClick={() => void undoBulkUpdate()}>Undo bulk update</button>
        </div>
      ) : null}

      {tab === "findings" ? (
        <section className="finding-table" aria-label="Audit findings">
          {filteredFindings.length ? (
            <>
              <div className="finding-summary">
                <div>
                  <strong>{pendingReviewCount}</strong>
                  <span>needs review</span>
                </div>
                <div>
                  <strong>
                    {findings.filter((item) => item.status === "retest").length}
                  </strong>
                  <span>ready for retest</span>
                </div>
                <div>
                  <strong>
                    {findings.filter((item) => item.severity === "blocker").length}
                  </strong>
                  <span>blockers</span>
                </div>
                <div>
                  <strong>{findings.filter((item) => item.status === "fixed").length}</strong>
                  <span>verified fixed</span>
                </div>
              </div>
              <div className="table-head">
                <label className="finding-selection-head">
                  <input
                    type="checkbox"
                    checked={
                      Boolean(filteredFindings.length) &&
                      selectedVisible.length === filteredFindings.length
                    }
                    onChange={(event) =>
                      setSelectedFindings(
                        event.target.checked
                          ? new Set(filteredFindings.map((finding) => finding.key))
                          : new Set(),
                      )
                    }
                    aria-label="Select all visible findings"
                  />
                  <span>Finding</span>
                </label>
                <span>Criterion</span>
                <span>Severity</span>
                <span>Status</span>
                <span />
              </div>
              {filteredFindings.map((item) => (
                <Fragment key={item.key}>
                <article className={`finding-row ${expandedFinding === item.key ? "finding-row-expanded" : ""}`}>
                  <div>
                    <input
                      className="finding-selection"
                      type="checkbox"
                      checked={selectedFindings.has(item.key)}
                      onChange={(event) =>
                        setSelectedFindings((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(item.key);
                          else next.delete(item.key);
                          return next;
                        })
                      }
                      aria-label={`Select ${item.reference} ${item.title}`}
                    />
                    <span
                      className={`severity-marker severity-${item.severity}`}
                    />
                    <span>
                      <span className="finding-reference">{item.reference}</span>
                      <strong>{item.title}</strong>
                      <button
                        type="button"
                        className="finding-id-copy"
                        title={`Copy ${item.id}`}
                        aria-label={`Copy finding ID ${item.id}`}
                        onClick={() => {
                          void desktop.invoke("clipboard:write-text", { text: item.id })
                            .then(() => show("Finding ID copied"))
                            .catch((error) => show(messageFromError(error, "The finding ID could not be copied."), true));
                        }}
                      >
                        <code>{compactFindingId(item.id)}</code>
                        <Copy size={20} />
                      </button>
                      {item.reviewState === "pending" ? (
                        <span className="finding-review-state">Needs review</span>
                      ) : null}
                      <small>
                        {[item.location, item.note].filter(Boolean).join(" · ") || "No location or implementation note"}
                      </small>
                      {item.schemaVersion === 2 ? (
                        <button
                          className="finding-toggle"
                          aria-expanded={expandedFinding === item.key}
                          aria-controls={`finding-detail-${item.key}`}
                          onClick={() => void toggleFinding(item)}
                        >
                          <Sparkle size={20} />
                          {item.source === "ai"
                            ? "AI-assisted evidence"
                            : item.source === "manual"
                              ? "Manual finding"
                              : "Browser evidence"}
                          <CaretDown size={20} className={expandedFinding === item.key ? "rotated" : ""} />
                        </button>
                      ) : null}
                    </span>
                  </div>
                  <code>{item.wcag}</code>
                  <StatusBadge
                    tone={
                      item.severity === "blocker"
                        ? "danger"
                        : item.severity === "major"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {item.severity}
                  </StatusBadge>
                  <select
                    value={item.status}
                    aria-label={`Status for ${item.title}`}
                    onChange={(event) =>
                      void updateFinding(item.key, {
                        status: event.target.value as Finding["status"],
                      })
                    }
                  >
                    <option value="open">Open</option>
                    <option value="retest">Ready for retest</option>
                    <option value="fixed">Verified fixed</option>
                    <option value="accepted">Risk accepted</option>
                  </select>
                  <div className="row-actions">
                    <button
                      className="row-action"
                      aria-label={`Duplicate ${item.reference} ${item.title}`}
                      onClick={() => void duplicateFinding(item)}
                    >
                      <Copy size={20} />
                    </button>
                    <button
                      className="row-action"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => setEditingFinding(item)}
                    >
                      <PencilSimple size={20} />
                    </button>
                    <button
                      className="row-action"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => void removeFinding(item.key)}
                    >
                      <Trash size={20} />
                    </button>
                  </div>
                </article>
                {item.schemaVersion === 2 && expandedFinding === item.key ? (
                  <section className="finding-detail" id={`finding-detail-${item.key}`} aria-label={`Details for ${item.title}`}>
                    <div className="finding-detail-meta">
                      <span>
                        {item.reference} · {item.reviewState === "pending"
                          ? "Browser intake awaiting auditor review"
                          : item.source === "ai"
                            ? "AI-assisted draft, auditor confirmed"
                            : item.source === "manual"
                              ? "Manually documented finding"
                              : "Structured browser evidence"}
                        {item.duplicateOf ? ` · Duplicated from ${item.duplicateOf}` : ""}
                      </span>
                      {item.confidence ? <span className={`finding-confidence finding-confidence-${item.confidence}`}>{item.confidence} confidence</span> : null}
                    </div>
                    <div className="finding-global-identity">
                      <span>Immutable finding ID</span>
                      <code>{item.id}</code>
                    </div>
                    {findingEvidence[item.key]?.image ? (
                      <figure className="finding-evidence-preview">
                        <img
                          src={findingEvidence[item.key]?.image?.dataUrl}
                          alt={`Marked browser evidence for ${item.title}`}
                        />
                        <figcaption>
                          <strong>Contextual page evidence</strong>
                          <span>
                            {findingEvidence[item.key]?.target.selector ||
                              "Selected visual region"}
                          </span>
                        </figcaption>
                      </figure>
                    ) : null}
                    {findingPrimaryEvidenceCaptureIds(item).length ? (
                      <section className="finding-capture-evidence" aria-label={`Attached captures for ${item.reference}`}>
                        <strong>Attached evidence · {findingPrimaryEvidenceCaptureIds(item).length}</strong>
                        <div>
                          {findingPrimaryEvidenceCaptureIds(item).map((captureId) => {
                            const capture = captures.find((entry) => entry.id === captureId);
                            return capture ? (
                              <button key={captureId} type="button" onClick={() => openCaptureForAnnotation(captureId)}>
                                <img src={capture.thumbnailUrl || capture.assetUrl} alt="" />
                                <span>{capture.title}</span>
                              </button>
                            ) : <span className="missing-evidence-reference" key={captureId}>Missing local capture · {captureId}</span>;
                          })}
                        </div>
                      </section>
                    ) : null}
                    {item.beforeCaptureId || item.afterCaptureId ? (
                      <section className="evidence-comparison" aria-label={`Before and after evidence for ${item.reference}`}>
                        <div className="evidence-comparison-heading">
                          <strong>Remediation comparison</strong>
                          <span>{item.comparisonNote || "Add a comparison note in the finding editor."}</span>
                        </div>
                        <div>
                          {([
                            ["Before", item.beforeCaptureId],
                            ["After", item.afterCaptureId],
                          ] as const).map(([label, captureId]) => {
                            const capture = captures.find((entry) => entry.id === captureId);
                            return (
                              <figure key={label}>
                                {capture ? (
                                  <img src={capture.thumbnailUrl || capture.assetUrl} alt={`${label} remediation evidence: ${capture.title}`} />
                                ) : (
                                  <div className="comparison-missing"><Image size={24} /><span>No {label.toLowerCase()} capture linked</span></div>
                                )}
                                <figcaption><strong>{label}</strong><span>{capture?.title || "Not linked"}</span></figcaption>
                              </figure>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}
                    <div className="finding-detail-grid">
                      <div><span>Actual result</span><p>{item.actualResult}</p></div>
                      <div><span>Expected result</span><p>{item.expectedResult}</p></div>
                    </div>
                    {item.location ? <div className="finding-detail-block"><span>Location</span><p>{item.location}</p></div> : null}
                    {item.owner || item.ticket || item.dueDate ? (
                      <div className="finding-detail-block">
                        <span>Remediation tracking</span>
                        <p>{[
                          item.owner ? `Owner: ${item.owner}` : "",
                          item.ticket ? `Reference: ${item.ticket}` : "",
                          item.dueDate ? `Target: ${item.dueDate}` : "",
                        ].filter(Boolean).join(" · ")}</p>
                        {item.ticketLink ? (
                          <div className="finding-ticket-summary">
                            <dl>
                              <div><dt>Local decision</dt><dd>{item.status}</dd></div>
                              <div><dt>External status</dt><dd>{item.ticketLink.externalStatus || "Unknown"}</dd></div>
                            </dl>
                            <span className={`status ${item.ticketLink.syncState === "in-sync" ? "status-success" : item.ticketLink.syncState === "review" ? "status-warning" : "status-danger"}`}>
                              {item.ticketLink.syncState === "in-sync" ? "In sync" : item.ticketLink.syncState === "review" ? `${item.ticketLink.conflicts.length} to review` : "Sync error"}
                            </span>
                            <button
                              type="button"
                              className="text-action"
                              onClick={() => void desktop.invoke("shell:open-external", { url: item.ticketLink!.url })
                                .catch((error) => show(messageFromError(error, "The ticket link could not be opened."), true))}
                            >
                              Open ticket
                            </button>
                            {item.ticketLink.syncState !== "in-sync" ? (
                              <button type="button" className="text-action" onClick={() => setEditingFinding(item)}>Review changes</button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="finding-detail-block"><span>User impact</span><p>{item.userImpact}</p></div>
                    {item.affectedUsers?.length ? (
                      <div className="finding-user-tags" aria-label="Affected users">
                        {item.affectedUsers.map((user) => <span key={user}>{user.replaceAll("-", " ")}</span>)}
                      </div>
                    ) : null}
                    {item.occurrences?.length ? (
                      <div className="finding-occurrences">
                        <strong>{item.occurrences.length} confirmed occurrence{item.occurrences.length === 1 ? "" : "s"}</strong>
                        <ol>
                          {item.occurrences.map((occurrence) => {
                            const capture = captures.find((entry) => entry.id === occurrence.captureId);
                            return (
                              <li key={occurrence.id}>
                                <span><strong>{occurrence.location || "Location not documented"}</strong>{occurrence.note ? ` · ${occurrence.note}` : ""}</span>
                                {capture ? <button onClick={() => openCaptureForAnnotation(capture.id)}>Open {capture.title}</button> : null}
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ) : null}
                    {item.severityRationale ? (
                      <div className="finding-detail-block">
                        <span>Severity rationale</span>
                        <p>{item.severityRationale}</p>
                      </div>
                    ) : null}
                    {item.wcagMappings?.length ? (
                      <div className="finding-wcag-list">
                        {item.wcagMappings.map((mapping) => (
                          <div key={mapping.criterion}>
                            <strong>{mapping.criterion} {mapping.name}</strong>
                            <span>Level {mapping.level} · {mapping.confidence} confidence</span>
                            <p>{mapping.rationale}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="finding-detail-block"><span>Suggested resolution</span><p>{item.recommendation}</p></div>
                    {item.exampleFix ? <pre><code>{item.exampleFix}</code></pre> : null}
                    {item.manualChecks?.length ? (
                      <div className="finding-manual-checks">
                        <strong>Manual confirmation</strong>
                        {item.manualChecks.map((check) => <p key={check}>{check}</p>)}
                      </div>
                    ) : null}
                    {item.retestNote ? (
                      <div className="finding-manual-checks">
                        <strong>Retest record{item.retestedAt ? ` · ${new Date(item.retestedAt).toLocaleDateString()}` : ""}</strong>
                        <p>{item.retestNote}</p>
                      </div>
                    ) : null}
                    {item.riskAcceptance ? (
                      <div className="finding-manual-checks">
                        <strong>Risk acceptance</strong>
                        <p>{item.riskAcceptance}</p>
                      </div>
                    ) : null}
                  </section>
                ) : null}
                </Fragment>
              ))}
            </>
          ) : (
            <EmptyState
              icon={WarningCircle}
              title={query ? "No matching findings" : "No findings yet"}
              body={
                query
                  ? "Try a broader search."
                  : "Save a contrast result or add issue badges to a capture. Findings will appear here."
              }
            />
          )}
        </section>
      ) : (
        <section className="capture-library">
          {auditId && unassignedCaptureIds.size ? (
            <div className="unassigned-captures-notice" role="status">
              <WarningCircle size={20} />
              <span><strong>Unassigned captures · {unassignedCaptureIds.size}</strong><small>These images are preserved but not linked to a finding. Attach them from a finding editor when they support an issue.</small></span>
            </div>
          ) : null}
          {filteredCaptures.length ? (
            filteredCaptures.map((entry) => (
              <article className="capture-card" key={entry.id} data-unassigned={unassignedCaptureIds.has(entry.id)}>
                <button
                  className="capture-thumb"
                  onClick={() =>
                    openCaptureForAnnotation(entry.id)
                  }
                >
                  {entry.thumbnailUrl || entry.assetUrl ? (
                    <img
                      src={entry.thumbnailUrl || entry.assetUrl}
                      alt={`Preview of ${entry.title}`}
                    />
                  ) : (
                    <Image size={20} />
                  )}
                  {entry.issues ? (
                    <span>
                      {entry.issues} issue{entry.issues === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {auditId && unassignedCaptureIds.has(entry.id) ? <span className="capture-assignment-badge">Unassigned</span> : null}
                </button>
                <div className="capture-meta">
                  <div>
                    <strong>{entry.title}</strong>
                    <span>
                      {entry.width} × {entry.height} ·{" "}
                      {dateLabel(entry.createdAt)}
                    </span>
                  </div>
                  <div>
                    <button
                      aria-label={`Annotate ${entry.title}`}
                      onClick={() =>
                        openCaptureForAnnotation(entry.id)
                      }
                    >
                      <NotePencil size={20} />
                    </button>
                    <button
                      aria-label={`Delete ${entry.title}`}
                      onClick={() => setCaptureToDelete(entry)}
                    >
                      <Trash size={20} />
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              icon={Camera}
              title={query ? "No matching captures" : "No captures yet"}
              body={
                query
                  ? "Try a different title."
                  : "Capture a region of any app, then annotate it in a focused workspace."
              }
              action={
                <Button
                  variant="primary"
                  icon={FrameCorners}
                  onClick={() => void startCapture(false)}
                >
                  Capture a region
                </Button>
              }
            />
          )}
        </section>
      )}
      <ConfirmDialog
        open={Boolean(captureToDelete)}
        title={`Delete ${captureToDelete?.title || "capture"}?`}
        description={auditId ? "This permanently removes the capture and its annotations from the current audit." : "This permanently removes the local capture and its annotations."}
        confirmLabel="Delete capture"
        busy={deleteBusy}
        onCancel={() => setCaptureToDelete(null)}
        onConfirm={() => void confirmCaptureDelete()}
      />
      <FindingEditorDialog
        open={Boolean(auditId) && editingFinding !== undefined}
        finding={editingFinding ?? null}
        captures={captures}
        auditId={auditId}
        onClose={() => setEditingFinding(undefined)}
        onSave={(value) => void saveFinding(value)}
        onTicketUpdate={saveTicketFinding}
      />
    </div>
  );
}
