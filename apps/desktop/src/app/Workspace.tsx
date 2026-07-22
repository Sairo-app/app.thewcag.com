import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  Aperture,
  Archive,
  BookOpenText,
  Camera,
  CaretDown,
  Check,
  CheckSquare,
  ClipboardText,
  ClockCounterClockwise,
  Command,
  FileText,
  GearSix,
  MagnifyingGlass,
  Palette,
  Plus,
  SidebarSimple,
  SquaresFour,
  Target,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import type {
  AuditActivity,
  AuditSampleItem,
  AuditTestRun,
  CaptureEntry,
  Finding,
  FindingSavedView,
  PlatformInfo,
  PublishedReport,
  WorkspaceStage,
  WorkspaceTool,
  WorkspaceUtility,
} from "../shared/desktop";
import { desktop, getStored, listCaptures, setStored } from "./api";
import { auditStoreKey, useAuditWorkspace } from "./audits";
import {
  parseAuditPackage,
  serializeAuditPackage,
  type AuditPackagePayload,
} from "./audit-package";
import { normalizeFindingReferences } from "../shared/finding-references";
import { auditPlanProgress } from "./audit-plan";
import { messageFromError } from "./hooks";
import {
  ConfirmDialog,
  IconButton,
  StatusBadge,
  Toast,
} from "./components";
import { InspectView } from "./views/InspectView";
import { PanelResizer } from "./ResizablePanel";
import { usePersistedPanelSize } from "./usePersistedPanelSize";
import { EvidenceView } from "./views/EvidenceView";
import { ReviewView } from "./views/ReviewView";
import { ShareView } from "./views/ShareView";
import { PaletteView } from "./views/PaletteView";
import { VisionView } from "./views/VisionView";
import { SettingsView } from "./views/SettingsView";
import { PlanView } from "./views/PlanView";
import { ScreenshotView } from "./views/ScreenshotView";
import { WCAG_CRITERIA } from "./data/wcag";

type Route = WorkspaceStage | WorkspaceUtility;
const COMPACT_LAYOUT_QUERY = "(max-width: 1040px)";
type IconType = ComponentType<{
  size?: number;
  weight?: "bold" | "regular" | "duotone";
}>;

const STAGES: {
  id: WorkspaceStage;
  label: string;
  number: string;
  icon: IconType;
}[] = [
  { id: "plan", label: "Plan", number: "01", icon: ClipboardText },
  { id: "inspect", label: "Inspect", number: "02", icon: Target },
  { id: "evidence", label: "Evidence", number: "03", icon: SquaresFour },
  { id: "review", label: "Review", number: "04", icon: CheckSquare },
  { id: "share", label: "Deliver", number: "05", icon: FileText },
];

const UTILITIES: { id: WorkspaceUtility; label: string; icon: IconType }[] = [
  { id: "screenshot", label: "Screenshot tool", icon: Camera },
  { id: "vision", label: "Vision lens", icon: Aperture },
  { id: "palette", label: "Palette", icon: Palette },
  { id: "settings", label: "Settings", icon: GearSix },
];

const TITLES: Record<Route, { title: string; description: string }> = {
  plan: {
    title: "Plan the evaluation",
    description:
      "Define scope, methodology, test coverage, and the representative sample.",
  },
  inspect: {
    title: "Inspect contrast",
    description:
      "Sample any interface, verify WCAG, and save defensible findings.",
  },
  evidence: {
    title: "Capture evidence",
    description:
      "Collect, annotate, and organize the proof behind each finding.",
  },
  review: {
    title: "Review the audit",
    description: "Work through WCAG 2.2 and resolve gaps before delivery.",
  },
  share: {
    title: "Deliver the report",
    description:
      "Finalize the audit record, review public evidence, and publish with intent.",
  },
  screenshot: {
    title: "Screenshot tool",
    description:
      "Capture, annotate, export, and share screenshots without using the audit workflow.",
  },
  vision: {
    title: "Vision lens",
    description: "Evaluate color and clarity through live visual simulations.",
  },
  palette: {
    title: "Palette matrix",
    description:
      "Test every text and background combination in a design system.",
  },
  settings: {
    title: "Application settings",
    description:
      "Manage shortcuts, capture permissions, account, and updates.",
  },
};

function normalizeRoute(tool: WorkspaceTool): Route {
  if (tool === "capture") return "evidence";
  if (tool === "checklist") return "review";
  return tool;
}

function Modal({
  open,
  onClose,
  label,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal-dialog ${className}`}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}

export function Workspace({ platform }: { platform: PlatformInfo }) {
  const [active, setActive] = useState<Route>("plan");
  const [evidenceTab, setEvidenceTab] = useState<"captures" | "findings">("captures");
  const [compact, setCompact] = useState(() =>
    window.matchMedia(COMPACT_LAYOUT_QUERY).matches,
  );
  const [inspector, setInspector] = useState(
    () => !window.matchMedia(COMPACT_LAYOUT_QUERY).matches,
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error: boolean;
    title?: string;
  } | null>(null);
  const [activity, setActivity] = useState<AuditActivity[]>([]);
  const taskContentRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [newAuditName, setNewAuditName] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [screenshotShareId, setScreenshotShareId] = useState("");
  const [stats, setStats] = useState({
    captures: 0,
    findings: 0,
    reviewed: 0,
    reports: 0,
  });
  const auditWorkspace = useAuditWorkspace();
  const navigationSize = usePersistedPanelSize(
    "layout-navigation-width-v1",
    176,
    152,
    240,
  );
  const inspectorSize = usePersistedPanelSize(
    "layout-audit-inspector-width-v1",
    252,
    220,
    420,
  );
  const {
    activeAudit,
    activeId,
    archiveAudit,
    audits,
    createAudit,
    discardAudit,
    importAudit,
    ready,
    recordActivity,
    selectAudit,
    updateAudit,
  } = auditWorkspace;
  const title = TITLES[active];
  const standalone = active === "screenshot";
  const showInspector = inspector && !standalone;

  const commands = useMemo(
    () =>
      [...STAGES, ...UTILITIES].filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  useEffect(
    () =>
      desktop.on<WorkspaceTool>("navigation:tool", (tool) =>
        setActive(normalizeRoute(tool)),
      ),
    [],
  );
  useEffect(
    () =>
      desktop.on<{ captureId: string }>("screenshot:share", (value) =>
        setScreenshotShareId(value.captureId),
      ),
    [],
  );
  useEffect(
    () =>
      desktop.on<{ text: string; error?: boolean }>("notification", (value) => {
        const error = Boolean(value.error);
        setNotice({
          text: error ? messageFromError(new Error(value.text)) : value.text,
          error,
          title: error ? "Action not completed" : undefined,
        });
        window.setTimeout(() => setNotice(null), 5000);
      }),
    [],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if ((event.metaKey || event.ctrlKey) && /^[1-5]$/.test(event.key)) {
        event.preventDefault();
        setActive(STAGES[Number(event.key) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!activeAudit) return;
    void Promise.all([
      listCaptures(activeAudit.id),
      getStored<Finding[]>(auditStoreKey(activeAudit.id, "findings"), []),
      getStored<Record<string, { result?: string }>>(
        auditStoreKey(activeAudit.id, "checklist"),
        {},
      ),
      getStored<unknown[]>(auditStoreKey(activeAudit.id, "reports"), []),
      getStored<AuditActivity[]>(auditStoreKey(activeAudit.id, "activity"), []),
    ]).then(([captures, findings, checklist, reports, nextActivity]) => {
      const applicableCriteria = WCAG_CRITERIA.filter(
        (criterion) => activeAudit.standard === "WCAG 2.2 AA" || criterion.level === "A",
      );
      setStats({
        captures: captures.length,
        findings: findings.length,
        reviewed: applicableCriteria.filter((criterion) => {
          const entry = checklist[criterion.sc];
          return entry?.result && entry.result !== "untested";
        }).length,
        reports: reports.length,
      });
      setActivity(nextActivity);
    });
  }, [active, activeId, activityOpen, activeAudit]);
  useEffect(() => {
    const media = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const onChange = () => {
      setCompact(media.matches);
      if (media.matches) setInspector(false);
    };
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    if (!compact || !inspector) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setInspector(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact, inspector]);
  useEffect(() => {
    setCommandIndex(0);
  }, [query]);
  useEffect(() => {
    taskContentRef.current?.scrollTo({ top: 0 });
  }, [active, activeId]);
  useEffect(() => {
    setCommandIndex((index) => Math.min(index, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  function navigate(route: Route) {
    if (route === "evidence") setEvidenceTab("captures");
    setActive(route);
    setCommandOpen(false);
    setQuery("");
  }

  function openFindings() {
    setEvidenceTab("findings");
    setActive("evidence");
    setCommandOpen(false);
    setQuery("");
  }

  function createNamedAudit() {
    const audit = createAudit(newAuditName);
    setNewAuditName("");
    setSwitcherOpen(false);
    setActive("plan");
    setNotice({ text: `${audit.project} created`, error: false });
  }

  async function exportAuditPackage() {
    if (!activeAudit) return;
    const [
      captures,
      sampleItems,
      testRuns,
      findings,
      findingViews,
      checklist,
      history,
      palette,
      savedActivity,
      reports,
    ] = await Promise.all([
      listCaptures(activeAudit.id),
      getStored<AuditSampleItem[]>(auditStoreKey(activeAudit.id, "sampleItems"), []),
      getStored<AuditTestRun[]>(auditStoreKey(activeAudit.id, "testRuns"), []),
      getStored<Finding[]>(auditStoreKey(activeAudit.id, "findings"), []),
      getStored<FindingSavedView[]>(auditStoreKey(activeAudit.id, "findingViews"), []),
      getStored<Record<string, unknown>>(auditStoreKey(activeAudit.id, "checklist"), {}),
      getStored<unknown[]>(auditStoreKey(activeAudit.id, "history"), []),
      getStored<string[]>(auditStoreKey(activeAudit.id, "palette"), []),
      getStored<AuditActivity[]>(auditStoreKey(activeAudit.id, "activity"), []),
      getStored<PublishedReport[]>(auditStoreKey(activeAudit.id, "reports"), []),
    ]);
    const packagedCaptures: AuditPackagePayload["captures"] = [];
    for (const capture of captures) {
      const [rawPngDataUrl, thumbnailPngDataUrl, document] = await Promise.all([
        desktop.invoke<string | null>("capture:read-data", { id: capture.id, kind: "raw" }),
        desktop.invoke<string | null>("capture:read-data", { id: capture.id, kind: "thumbnail" }),
        desktop.invoke<string | null>("capture:read-document", { id: capture.id }),
      ]);
      if (!rawPngDataUrl) throw new Error(`The source image for ${capture.title} could not be read.`);
      packagedCaptures.push({
        id: capture.id,
        title: capture.title,
        rawPngDataUrl,
        thumbnailPngDataUrl: thumbnailPngDataUrl || undefined,
        document: document || undefined,
      });
    }
    const text = await serializeAuditPackage({
      exportedAt: new Date().toISOString(),
      audit: activeAudit,
      sections: {
        sampleItems,
        testRuns,
        findings: normalizeFindingReferences(findings).findings,
        findingViews,
        checklist,
        history,
        palette,
        activity: savedActivity,
        reports,
      },
      captures: packagedCaptures,
    });
    const slug = activeAudit.project.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "audit";
    const path = await desktop.invoke<string | null>("dialog:save-text", {
      name: `${slug}.thewcag-audit.json`,
      text,
    });
    if (!path) return;
    await recordActivity({
      kind: "exported",
      title: "Complete audit package exported",
      detail: `${captures.length} captures and ${findings.length} findings`,
    });
    setNotice({ text: "Integrity-checked audit package exported", error: false });
  }

  async function importAuditPackage() {
    const text = await desktop.invoke<string | null>("dialog:open-text", {
      extension: "json",
    });
    if (!text) return;
    const payload = await parseAuditPackage(text);
    const imported = importAudit(payload.audit);
    const createdCaptureIds: string[] = [];
    const sections = [
      "findings",
      "checklist",
      "history",
      "palette",
      "sampleItems",
      "testRuns",
      "findingViews",
      "activity",
      "reports",
    ] as const;
    try {
      const captureMap = new Map<string, string>();
      for (const capture of payload.captures) {
        const entry = await desktop.invoke<CaptureEntry>("capture:create", {
          pngDataUrl: capture.rawPngDataUrl,
          title: capture.title,
          auditId: imported.id,
          silent: true,
        });
        createdCaptureIds.push(entry.id);
        captureMap.set(capture.id, entry.id);
        if (capture.document) {
          await desktop.invoke("capture:save-document", {
            id: entry.id,
            json: capture.document,
          });
        }
        if (capture.thumbnailPngDataUrl) {
          await desktop.invoke("capture:save-thumbnail", {
            id: entry.id,
            pngDataUrl: capture.thumbnailPngDataUrl,
          });
        }
      }
      const remapCapture = (id: string | undefined) =>
        id ? captureMap.get(id) : undefined;
      const findings = normalizeFindingReferences(payload.sections.findings).findings.map(
        (finding) => ({
          ...finding,
          captureId: remapCapture(finding.captureId),
          beforeCaptureId: remapCapture(finding.beforeCaptureId),
          afterCaptureId: remapCapture(finding.afterCaptureId),
          occurrences: finding.occurrences?.map((occurrence) => ({
            ...occurrence,
            captureId: remapCapture(occurrence.captureId),
          })),
        }),
      );
      const importedActivity: AuditActivity[] = [
        {
          id: crypto.randomUUID(),
          auditId: imported.id,
          kind: "created" as const,
          title: "Audit package imported",
          detail: `Integrity verified. Exported ${payload.exportedAt}.`,
          createdAt: Date.now(),
        },
        ...payload.sections.activity.map((entry) => ({
          ...entry,
          id: crypto.randomUUID(),
          auditId: imported.id,
        })),
      ].slice(0, 120);
      await Promise.all([
        setStored(auditStoreKey(imported.id, "sampleItems"), payload.sections.sampleItems),
        setStored(auditStoreKey(imported.id, "testRuns"), payload.sections.testRuns),
        setStored(auditStoreKey(imported.id, "findings"), findings),
        setStored(auditStoreKey(imported.id, "findingViews"), payload.sections.findingViews),
        setStored(auditStoreKey(imported.id, "checklist"), payload.sections.checklist),
        setStored(auditStoreKey(imported.id, "history"), payload.sections.history),
        setStored(auditStoreKey(imported.id, "palette"), payload.sections.palette),
        setStored(auditStoreKey(imported.id, "activity"), importedActivity),
        setStored(
          auditStoreKey(imported.id, "reports"),
          payload.sections.reports.map((report) => ({
            ...report,
            id: crypto.randomUUID(),
            auditId: imported.id,
            captureId: remapCapture(report.captureId) || "",
          })),
        ),
      ]);
      setActive("plan");
      setNotice({
        text: `${imported.project} imported with verified integrity`,
        error: false,
      });
    } catch (error) {
      await Promise.all([
        ...createdCaptureIds.map((id) => desktop.invoke("capture:delete", { id })),
        ...sections.map((section) =>
          desktop.invoke("store:remove", { key: auditStoreKey(imported.id, section) }),
        ),
      ]).catch(() => undefined);
      discardAudit(imported.id);
      throw error;
    }
  }

  function onCommandKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCommandIndex((index) => Math.min(commands.length - 1, index + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCommandIndex((index) => Math.max(0, index - 1));
    }
    if (event.key === "Home" && commands.length) {
      event.preventDefault();
      setCommandIndex(0);
    }
    if (event.key === "End" && commands.length) {
      event.preventDefault();
      setCommandIndex(commands.length - 1);
    }
    if (event.key === "Enter" && commands[commandIndex]) {
      event.preventDefault();
      navigate(commands[commandIndex].id);
    }
  }

  if (!ready || !activeAudit)
    return (
      <div className="workspace-loading">
        <img src="/logo.png" alt="" />
        <span>Preparing your audits</span>
      </div>
    );

  const plan = auditPlanProgress(activeAudit);

  const body =
    active === "plan" ? (
      <PlanView
        audit={activeAudit}
        onAuditChange={updateAudit}
        recordActivity={recordActivity}
        onNavigate={navigate}
        onExportPackage={exportAuditPackage}
        onImportPackage={importAuditPackage}
      />
    ) : active === "inspect" ? (
      <InspectView
        auditId={activeAudit.id}
        onNavigate={navigate}
        recordActivity={recordActivity}
      />
    ) : active === "evidence" ? (
      <EvidenceView
        auditId={activeAudit.id}
        initialTab={evidenceTab}
        onNavigate={navigate}
        recordActivity={recordActivity}
      />
    ) : active === "review" ? (
      <ReviewView
        audit={activeAudit}
        recordActivity={recordActivity}
        onOpenFindings={openFindings}
      />
    ) : active === "share" ? (
      <ShareView
        audit={activeAudit}
        onAuditChange={updateAudit}
        recordActivity={recordActivity}
        onNavigate={navigate}
      />
    ) : active === "screenshot" ? (
      <ScreenshotView
        shareCaptureId={screenshotShareId}
        onShareHandled={() => setScreenshotShareId("")}
      />
    ) : active === "palette" ? (
      <PaletteView auditId={activeAudit.id} />
    ) : active === "vision" ? (
      <VisionView />
    ) : (
      <SettingsView platform={platform} />
    );

  const stageIndex = STAGES.findIndex((stage) => stage.id === active);
  const stageStats = [
    `${plan.complete}/${plan.total} ready`,
    "Ready",
    `${stats.captures} captures`,
    `${stats.reviewed} reviewed`,
    `${stats.reports} published`,
  ];

  return (
    <div
      className="workspace-shell"
      style={
        {
          "--stage-rail-width": `${navigationSize.size}px`,
          "--context-inspector-width": `${inspectorSize.size}px`,
        } as CSSProperties
      }
    >
      <Toast message={notice} onClose={() => setNotice(null)} />
      <aside className="stage-rail" aria-label="Audit workflow">
        <button
          className="rail-brand"
          aria-label="Go to Plan"
          onClick={() => navigate("plan")}
        >
          <img src="/logo.png" alt="TheWCAG" draggable={false} />
        </button>
        <div className="rail-audit-label">Audit workflow</div>
        <nav>
          {STAGES.map(({ id, label, number, icon: Icon }) => (
            <button
              key={id}
              className="stage-link"
              data-active={active === id}
              aria-current={active === id ? "page" : undefined}
              title={`${label}, ${stageStats[Number(number) - 1]}`}
              onClick={() => navigate(id)}
            >
              <span className="stage-number">{number}</span>
              <Icon size={19} weight={active === id ? "duotone" : "regular"} />
              <span>{label}</span>
              <small>{stageStats[Number(number) - 1]}</small>
            </button>
          ))}
        </nav>
        <div className="rail-utilities">
          <span>Utilities</span>
          {UTILITIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className="utility-link"
              data-active={active === id}
              aria-current={active === id ? "page" : undefined}
              title={label}
              onClick={() => navigate(id)}
            >
              <Icon size={18} weight={active === id ? "duotone" : "regular"} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </aside>
      <PanelResizer
        className="navigation-resizer"
        label="Resize audit navigation"
        side="right"
        size={navigationSize.size}
        min={152}
        max={240}
        initial={176}
        onSize={navigationSize.setSize}
        onCommit={navigationSize.commit}
      />

      <div className="workspace-column" data-standalone={standalone}>
        <header className="command-bar">
          <div className="drag-space" aria-hidden />
          {standalone ? (
            <div className="project-switcher standalone-tool-indicator">
              <span className="project-glyph">
                <Camera size={17} weight="duotone" />
              </span>
              <span className="project-name">Independent workspace</span>
            </div>
          ) : (
            <button
              className="project-switcher"
              onClick={() => setSwitcherOpen(true)}
              aria-haspopup="dialog"
            >
              <span className="project-glyph">
                <BookOpenText size={17} weight="duotone" />
              </span>
              <span className="project-name">{activeAudit.project}</span>
              <CaretDown size={14} />
            </button>
          )}
          <button
            className="command-trigger"
            aria-label="Search tools and commands"
            title="Search tools and commands"
            onClick={() => setCommandOpen(true)}
          >
            <MagnifyingGlass size={17} />
            <span>Search tools and commands</span>
            <kbd>{platform.platform === "macos" ? "⌘" : "Ctrl"} K</kbd>
          </button>
          <div className="command-actions">
            <StatusBadge tone="success">Stored locally</StatusBadge>
            {!standalone ? (
              <IconButton
                label={inspector ? "Hide audit panel" : "Show audit panel"}
                className="inspector-toggle"
                ariaExpanded={inspector}
                ariaControls="audit-context-panel"
                onClick={() => setInspector((value) => !value)}
              >
                <SidebarSimple size={18} weight="bold" />
              </IconButton>
            ) : null}
            <IconButton
              label="Account and settings"
              onClick={() => navigate("settings")}
            >
              <UserCircle size={19} />
            </IconButton>
          </div>
        </header>

        <main className={`workstage ${showInspector ? "with-inspector" : ""}`}>
          <section className="task-column">
            <div className="task-heading">
              <div>
                {stageIndex >= 0 ? (
                  <span className="stage-indicator">
                    Stage {stageIndex + 1} of {STAGES.length}
                  </span>
                ) : (
                  <span className="stage-indicator">Utility</span>
                )}
                <h1>{title.title}</h1>
                <p>{title.description}</p>
              </div>
              {stageIndex >= 0 && stageIndex < STAGES.length - 1 ? (
                <button
                  className="next-stage"
                  onClick={() => navigate(STAGES[stageIndex + 1].id)}
                >
                  Next: {STAGES[stageIndex + 1].label}
                </button>
              ) : null}
            </div>
            <div ref={taskContentRef} className="task-content">{body}</div>
          </section>
          {compact && showInspector ? (
            <button
              type="button"
              className="inspector-scrim"
              aria-label="Close audit status panel"
              onClick={() => setInspector(false)}
            />
          ) : null}
          {showInspector ? (
            <PanelResizer
              className="context-resizer"
              label="Resize audit status panel"
              side="left"
              size={inspectorSize.size}
              min={220}
              max={420}
              initial={252}
              onSize={inspectorSize.setSize}
              onCommit={inspectorSize.commit}
            />
          ) : null}
          {showInspector ? (
            <aside
              id="audit-context-panel"
              className="context-inspector"
              aria-label="Current audit context"
              data-compact={compact}
            >
              <div className="inspector-heading">
                <span>Audit status</span>
                <IconButton
                  label="Close audit panel"
                  onClick={() => setInspector(false)}
                >
                  <SidebarSimple size={16} />
                </IconButton>
              </div>
              <div className="inspector-project">
                <span className="project-avatar">
                  {activeAudit.project.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{activeAudit.project}</strong>
                  <p>{activeAudit.target || "No target added"}</p>
                </div>
              </div>
              <div className="audit-metrics">
                <div>
                  <strong>{stats.findings}</strong>
                  <span>Findings</span>
                </div>
                <div>
                  <strong>{stats.captures}</strong>
                  <span>Captures</span>
                </div>
                <div>
                  <strong>{stats.reviewed}</strong>
                  <span>Reviewed</span>
                </div>
                <div>
                  <strong>{stats.reports}</strong>
                  <span>Reports</span>
                </div>
              </div>
              <div className="inspector-section">
                <span className="inspector-label">Conformance</span>
                <div className="context-value">
                  <CheckSquare size={18} weight="duotone" />
                  <span>{activeAudit.standard}</span>
                </div>
              </div>
              <div className="inspector-section">
                <span className="inspector-label">Scope</span>
                <p className="inspector-copy">
                  {activeAudit.scope ||
                    "Add scope notes so exported evidence remains understandable."}
                </p>
                <button
                  className="text-action"
                  onClick={() => navigate("plan")}
                >
                  Edit audit context
                </button>
              </div>
              <div className="inspector-section inspector-plan">
                <div className="inspector-plan-heading">
                  <span className="inspector-label">Evaluation plan</span>
                  <strong>{plan.complete}/{plan.total}</strong>
                </div>
                <progress value={plan.complete} max={plan.total}>{plan.percent}%</progress>
                <p className="inspector-copy">
                  {plan.missing.length
                    ? `Still needed: ${plan.missing.slice(0, 3).join(", ")}${plan.missing.length > 3 ? ` and ${plan.missing.length - 3} more` : ""}.`
                    : "Scope, sample, environment, and ownership are documented."}
                </p>
              </div>
              <div className="inspector-callout">
                <Check size={18} weight="bold" />
                <div>
                  <strong>Private until published</strong>
                  <p>
                    Captures and working files stay on this computer until you
                    review and publish a report.
                  </p>
                </div>
              </div>
            </aside>
          ) : null}
        </main>

        <footer className="activity-shelf">
          <button
            onClick={() => setActivityOpen((value) => !value)}
            aria-expanded={activityOpen}
          >
            <span className="activity-glyph">
              <ClockCounterClockwise size={15} />
            </span>
            <span>Activity</span>
            <span className="activity-copy">
              {activity[0]?.title || "Audit ready"}
            </span>
            <CaretDown className={activityOpen ? "turned" : ""} size={14} />
          </button>
          {activityOpen ? (
            <div className="activity-panel">
              {activity.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    item.url &&
                    void desktop.invoke("shell:open-external", {
                      url: item.url,
                    })
                  }
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.detail || new Date(item.createdAt).toLocaleString()}
                    </small>
                  </span>
                  <time>
                    {new Intl.RelativeTimeFormat(undefined, {
                      numeric: "auto",
                    }).format(
                      Math.round((item.createdAt - Date.now()) / 86_400_000),
                      "day",
                    )}
                  </time>
                </button>
              ))}
              {!activity.length ? <p>No audit activity yet.</p> : null}
              <StatusBadge tone="neutral">v{platform.version}</StatusBadge>
            </div>
          ) : null}
        </footer>
      </div>

      <Modal
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        label="Command palette"
        className="command-palette"
      >
        <div className="command-input">
          <MagnifyingGlass size={19} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onCommandKey}
            placeholder="Jump to a stage or utility"
            aria-label="Search commands"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={
              commands[commandIndex]
                ? `command-${commands[commandIndex].id}`
                : undefined
            }
          />
          <button
            aria-label="Close command palette"
            onClick={() => setCommandOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
        <p className="command-group-label">
          {commands.length ? "Destinations" : "No matching commands"}
        </p>
        <div id="command-results" className="command-results" role="listbox">
          {commands.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              id={`command-${id}`}
              role="option"
              aria-selected={index === commandIndex}
              data-selected={index === commandIndex}
              onMouseEnter={() => setCommandIndex(index)}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              <span className="command-hint">Open</span>
            </button>
          ))}
        </div>
        <div className="command-footer">
          <span>
            <Command size={15} /> Arrow keys to move
          </span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </Modal>

      <Modal
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        label="Switch audit"
        className="audit-switcher-dialog"
      >
        <div className="dialog-heading">
          <div>
            <span>Audits</span>
            <h2>Switch workspace</h2>
          </div>
          <button
            aria-label="Close audit switcher"
            onClick={() => setSwitcherOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="audit-list">
          {audits
            .filter((audit) => !audit.archivedAt)
            .map((audit) => (
              <button
                key={audit.id}
                data-active={audit.id === activeId}
                onClick={() => {
                  selectAudit(audit.id);
                  setSwitcherOpen(false);
                }}
              >
                <span className="project-avatar">
                  {audit.project.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{audit.project}</strong>
                  <small>{audit.target || audit.standard}</small>
                </span>
                {audit.id === activeId ? (
                  <Check size={18} weight="bold" />
                ) : null}
              </button>
            ))}
        </div>
        <form
          className="new-audit-form"
          onSubmit={(event) => {
            event.preventDefault();
            createNamedAudit();
          }}
        >
          <label>
            <span>New audit</span>
            <input
              value={newAuditName}
              onChange={(event) => setNewAuditName(event.target.value)}
              placeholder="Project or release name"
            />
          </label>
          <button className="button button-primary" type="submit">
            <Plus size={17} weight="bold" />
            Create
          </button>
        </form>
        <div className="dialog-footer">
          <span>
            {audits.filter((audit) => !audit.archivedAt).length} active audits
          </span>
          <button
            disabled={audits.filter((audit) => !audit.archivedAt).length < 2}
            onClick={() => {
              setSwitcherOpen(false);
              setArchiveConfirm(true);
            }}
          >
            <Archive size={16} />
            Archive current
          </button>
        </div>
      </Modal>
      <ConfirmDialog
        open={archiveConfirm}
        title={`Archive ${activeAudit.project}?`}
        description="The audit will leave the active workspace list. Its local evidence and findings are preserved."
        confirmLabel="Archive audit"
        onCancel={() => setArchiveConfirm(false)}
        onConfirm={() => {
          archiveAudit(activeAudit.id);
          setArchiveConfirm(false);
        }}
      />
    </div>
  );
}
