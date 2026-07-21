import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CaretDown,
  FileArrowDown,
  FrameCorners,
  Image,
  MagnifyingGlass,
  NotePencil,
  Plus,
  ShareNetwork,
  Sparkle,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  parseEvidencePacket,
  type EvidencePacketV1,
} from "@accessibility-build/audit-contracts";
import type {
  CaptureEntry,
  Finding,
  OverlayResult,
  WorkspaceStage,
} from "../../shared/desktop";
import { desktop, getStored, listCaptures, setStored } from "../api";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Segmented,
  StatusBadge,
  Toast,
} from "../components";
import { messageFromError, useTransientMessage } from "../hooks";

type Tab = "captures" | "findings";

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
  onNavigate,
  recordActivity,
}: {
  auditId: string;
  onNavigate: (stage: WorkspaceStage) => void;
  recordActivity: RecordAuditActivity;
}) {
  const [tab, setTab] = useState<Tab>("captures");
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [captureToDelete, setCaptureToDelete] =
    useState<CaptureEntry | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [findingEvidence, setFindingEvidence] = useState<
    Record<string, EvidencePacketV1 | null>
  >({});
  const [message, show] = useTransientMessage(5000);
  const deletedRef = useRef<{ item: Finding; index: number } | null>(null);
  const findingsKey = auditStoreKey(auditId, "findings");

  async function refresh() {
    const [nextCaptures, nextFindings] = await Promise.all([
      listCaptures(auditId),
      getStored<Finding[]>(findingsKey, []),
    ]);
    setCaptures(nextCaptures);
    setFindings(nextFindings);
  }

  useEffect(() => {
    void refresh().catch((error) => show(messageFromError(error), true));
    return desktop.on("capture:saved", () => void refresh());
  }, [auditId]);
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
      if (full) await desktop.invoke("capture:fullscreen", { auditId });
      else await desktop.invoke("capture:begin", { mode: "capture", auditId });
      await refresh();
      if (full)
        await recordActivity({
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
    const next = findings.map((item) =>
      item.key === key ? { ...item, ...patch } : item,
    );
    setFindings(next);
    await setStored(findingsKey, next);
  }

  async function removeFinding(key: string) {
    const index = findings.findIndex((item) => item.key === key);
    if (index < 0) return;
    deletedRef.current = { item: findings[index], index };
    const next = findings.filter((item) => item.key !== key);
    setFindings(next);
    await setStored(findingsKey, next);
    show("Finding removed. Use Undo below to restore it.");
  }

  async function undoFinding() {
    const deleted = deletedRef.current;
    if (!deleted) return;
    const next = [...findings];
    next.splice(deleted.index, 0, deleted.item);
    deletedRef.current = null;
    setFindings(next);
    await setStored(findingsKey, next);
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

  async function exportMarkdown() {
    const findingSections = findings.map((item, index) => {
      const section = [
        `## ${index + 1}. ${item.title}`,
        "",
        `- WCAG: ${item.wcag}`,
        `- Severity: ${item.severity}`,
        `- Status: ${item.status}`,
        item.note ? `- Note: ${item.note}` : "",
      ];
      const addSection = (heading: string, value?: string) => {
        if (!value) return;
        section.push("", `### ${heading}`, "", value);
      };
      addSection("Actual result", item.actualResult);
      addSection("Expected result", item.expectedResult);
      addSection("User impact", item.userImpact);
      addSection("Suggested resolution", item.recommendation);
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
      await recordActivity({
        kind: "exported",
        title: "Findings exported",
        detail: `${findings.length} findings in Markdown`,
      });
      show("Findings exported");
    }
  }

  const filteredCaptures = useMemo(
    () =>
      captures.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [captures, query],
  );
  const filteredFindings = useMemo(
    () =>
      findings.filter((item) =>
        `${item.title} ${item.wcag} ${item.note} ${item.actualResult ?? ""} ${item.userImpact ?? ""} ${item.recommendation ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [findings, query],
  );
  const openCount = findings.filter((item) => item.status === "open").length;

  return (
    <div className="evidence-view">
      <Toast message={message} />
      <section className="capture-banner">
        <div className="capture-illustration">
          <FrameCorners size={34} weight="duotone" />
          <span>
            <Camera size={17} weight="fill" />
          </span>
        </div>
        <div>
          <span className="section-label">Native high-DPI capture</span>
          <h2>Turn the screen into evidence</h2>
          <p>
            Select only the affected region or capture the current display. Each
            image opens in the annotation workspace.
          </p>
        </div>
        <div className="capture-actions">
          <Button
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
        <Segmented
          value={tab}
          onChange={setTab}
          label="Evidence type"
          options={[
            { value: "captures", label: `Captures ${captures.length}` },
            { value: "findings", label: `Findings ${findings.length}` },
          ]}
        />
        <label className="search-field">
          <MagnifyingGlass size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
            <Button icon={FileArrowDown} onClick={() => void exportMarkdown()}>
              Export
            </Button>
            <Button
              variant="primary"
              icon={ShareNetwork}
              disabled={!findings.length || !captures.length}
              onClick={() => onNavigate("share")}
            >
              Review report
            </Button>
          </>
        )}
      </div>

      {deletedRef.current && tab === "findings" ? (
        <div className="undo-strip" role="status">
          <span>A finding was removed.</span>
          <button onClick={() => void undoFinding()}>Undo</button>
        </div>
      ) : null}

      {tab === "findings" ? (
        <section className="finding-table" aria-label="Audit findings">
          {filteredFindings.length ? (
            <>
              <div className="finding-summary">
                <div>
                  <strong>{openCount}</strong>
                  <span>open</span>
                </div>
                <div>
                  <strong>
                    {
                      findings.filter((item) => item.severity === "blocker")
                        .length
                    }
                  </strong>
                  <span>blockers</span>
                </div>
                <div>
                  <strong>
                    {findings.filter((item) => item.status === "fixed").length}
                  </strong>
                  <span>fixed</span>
                </div>
              </div>
              <div className="table-head">
                <span>Finding</span>
                <span>Criterion</span>
                <span>Severity</span>
                <span>Status</span>
                <span />
              </div>
              {filteredFindings.map((item) => (
                <Fragment key={item.key}>
                <article className={`finding-row ${expandedFinding === item.key ? "finding-row-expanded" : ""}`}>
                  <div>
                    <span
                      className={`severity-marker severity-${item.severity}`}
                    />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.note || "No implementation note"}</small>
                      {item.schemaVersion === 2 ? (
                        <button
                          className="finding-toggle"
                          aria-expanded={expandedFinding === item.key}
                          aria-controls={`finding-detail-${item.key}`}
                          onClick={() => void toggleFinding(item)}
                        >
                          <Sparkle size={13} weight="fill" />
                          {item.source === "ai" ? "AI-assisted evidence" : "Browser evidence"}
                          <CaretDown size={13} className={expandedFinding === item.key ? "rotated" : ""} />
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
                    <option value="fixed">Fixed</option>
                    <option value="accepted">Accepted</option>
                  </select>
                  <button
                    className="row-action"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => void removeFinding(item.key)}
                  >
                    <Trash size={16} />
                  </button>
                </article>
                {item.schemaVersion === 2 && expandedFinding === item.key ? (
                  <section className="finding-detail" id={`finding-detail-${item.key}`} aria-label={`Details for ${item.title}`}>
                    <div className="finding-detail-meta">
                      <span>{item.source === "ai" ? "AI-assisted draft, auditor confirmed" : "Structured browser evidence"}</span>
                      {item.confidence ? <span className={`finding-confidence finding-confidence-${item.confidence}`}>{item.confidence} confidence</span> : null}
                    </div>
                    {findingEvidence[item.key]?.image ? (
                      <figure className="finding-evidence-preview">
                        <img
                          src={findingEvidence[item.key]?.image?.dataUrl}
                          alt={`Marked browser evidence for ${item.title}`}
                        />
                        <figcaption>
                          <strong>Exact selected region</strong>
                          <span>
                            {findingEvidence[item.key]?.target.selector ||
                              "Selected visual region"}
                          </span>
                        </figcaption>
                      </figure>
                    ) : null}
                    <div className="finding-detail-grid">
                      <div><span>Actual result</span><p>{item.actualResult}</p></div>
                      <div><span>Expected result</span><p>{item.expectedResult}</p></div>
                    </div>
                    <div className="finding-detail-block"><span>User impact</span><p>{item.userImpact}</p></div>
                    {item.affectedUsers?.length ? (
                      <div className="finding-user-tags" aria-label="Affected users">
                        {item.affectedUsers.map((user) => <span key={user}>{user.replaceAll("-", " ")}</span>)}
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
          {filteredCaptures.length ? (
            filteredCaptures.map((entry) => (
              <article className="capture-card" key={entry.id}>
                <button
                  className="capture-thumb"
                  onClick={() =>
                    void desktop.invoke("capture:open", { id: entry.id })
                  }
                >
                  {entry.thumbnailUrl || entry.assetUrl ? (
                    <img
                      src={entry.thumbnailUrl || entry.assetUrl}
                      alt={`Preview of ${entry.title}`}
                    />
                  ) : (
                    <Image size={30} />
                  )}
                  {entry.issues ? (
                    <span>
                      {entry.issues} issue{entry.issues === 1 ? "" : "s"}
                    </span>
                  ) : null}
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
                        void desktop.invoke("capture:open", { id: entry.id })
                      }
                    >
                      <NotePencil size={17} />
                    </button>
                    <button
                      aria-label={`Delete ${entry.title}`}
                      onClick={() => setCaptureToDelete(entry)}
                    >
                      <Trash size={17} />
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
        description="This permanently removes the capture and its annotations from the current audit."
        confirmLabel="Delete capture"
        busy={deleteBusy}
        onCancel={() => setCaptureToDelete(null)}
        onConfirm={() => void confirmCaptureDelete()}
      />
    </div>
  );
}
