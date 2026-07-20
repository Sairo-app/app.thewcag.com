import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  FileArrowDown,
  FrameCorners,
  Image,
  MagnifyingGlass,
  NotePencil,
  Plus,
  ShareNetwork,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
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
  EmptyState,
  Segmented,
  StatusBadge,
  Toast,
} from "../components";
import { useTransientMessage } from "../hooks";

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
    void refresh().catch((error) => show(String(error), true));
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
      show(String(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function removeCapture(entry: CaptureEntry) {
    if (!confirm(`Delete “${entry.title}” and its annotations?`)) return;
    try {
      await desktop.invoke("capture:delete", { id: entry.id });
      await refresh();
      show("Capture deleted");
    } catch (error) {
      show(String(error), true);
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

  async function exportMarkdown() {
    const lines = [
      "# Accessibility findings",
      "",
      `Exported ${new Date().toLocaleDateString()}`,
      "",
      ...findings.map((item, index) =>
        [
          `## ${index + 1}. ${item.title}`,
          "",
          `- WCAG: ${item.wcag}`,
          `- Severity: ${item.severity}`,
          `- Status: ${item.status}`,
          item.note ? `- Note: ${item.note}` : "",
          "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
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
        `${item.title} ${item.wcag} ${item.note}`
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
                <article key={item.key} className="finding-row">
                  <div>
                    <span
                      className={`severity-marker severity-${item.severity}`}
                    />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.note || "No implementation note"}</small>
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
                      onClick={() => void removeCapture(entry)}
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
    </div>
  );
}
