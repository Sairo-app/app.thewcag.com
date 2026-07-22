import {
  useCallback,
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
  ArrowLeft,
  ArrowRight,
  Aperture,
  Archive,
  BookOpenText,
  Camera,
  CaretDown,
  Check,
  CheckSquare,
  ChartBarHorizontal,
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
  Trash,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import type {
  AppSettings,
  AuditActivity,
  AuditSampleItem,
  AuditTestRun,
  CaptureEntry,
  Finding,
  FindingSavedView,
  FunnelTelemetryEvent,
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
import { auditPlanProgress, auditStartReadiness } from "./audit-plan";
import type { AuditSessionSelection } from "./audit-coverage";
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
import { ProgramDashboard } from "./views/ProgramDashboard";
import { WCAG_CRITERIA } from "./data/wcag";
import {
  createGuidedSampleAuditPackage,
  GUIDED_SAMPLE_NAME,
} from "./guided-sample-audit";

type Route = WorkspaceStage | WorkspaceUtility;
const COMPACT_LAYOUT_QUERY = "(max-width: 1040px)";
const COACH_MARKS_KEY = "first-run-coach-marks-v1";
type CoachMarkId = "contrast" | "capture" | "vision";
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
  { id: "review", label: "Review", number: "03", icon: CheckSquare },
  { id: "share", label: "Deliver", number: "04", icon: FileText },
];

const CAPTURE_LIBRARY = { id: "evidence" as const, label: "Findings & captures", icon: SquaresFour };

const UTILITIES: { id: WorkspaceUtility; label: string; icon: IconType }[] = [
  { id: "program", label: "Program", icon: ChartBarHorizontal },
  { id: "captures", label: "Standalone captures", icon: Camera },
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
    title: "Findings and capture library",
    description:
      "Review finding-owned evidence and any unassigned local captures. This view is optional, not a required stage.",
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
  program: {
    title: "Program trends",
    description:
      "Review recurrence, retest timing, component hotspots, and regressions across owned local audits.",
  },
  captures: {
    title: "Standalone capture library",
    description: "Capture, annotate, copy, and export local screenshots without adding them to an audit or finding.",
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
  if (tool === "capture") return "captures";
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

function formatShortcut(value: string, platform: PlatformInfo["platform"]): string {
  return value
    .replace("CommandOrControl", platform === "macos" ? "⌘" : "Ctrl")
    .replaceAll("Alt", platform === "macos" ? "⌥" : "Alt")
    .replaceAll("Shift", platform === "macos" ? "⇧" : "Shift")
    .replaceAll("+", " + ");
}

function FirstRunExperience({
  busy,
  message,
  onCreateBlank,
  onImport,
  onOpenCaptureLibrary,
  onStartSample,
}: {
  busy: boolean;
  message: string;
  onCreateBlank: () => void;
  onImport: () => void;
  onOpenCaptureLibrary: () => void;
  onStartSample: () => void;
}) {
  return (
    <div className="first-run-shell">
      <a className="skip-link" href="#first-run-main">Skip to first-run choices</a>
      <main id="first-run-main" className="first-run-main" tabIndex={-1}>
        <section className="first-run-intro" aria-labelledby="first-run-title">
          <img src="./logo.png" alt="TheWCAG" draggable={false} />
          <div>
            <span className="first-run-local">Private, local workstation</span>
            <h1 id="first-run-title">Complete your first audit in four focused stages.</h1>
            <p>
              Start with a small authored demo that is already planned, inspected,
              annotated, reviewed, and ready to deliver. It uses bundled sample data
              and never opens a network connection.
            </p>
          </div>
          <div className="first-run-actions">
            <button
              type="button"
              className="button button-primary first-run-primary"
              disabled={busy}
              onClick={onStartSample}
            >
              <BookOpenText size={18} weight="duotone" />
              {busy ? "Preparing sample" : "Guided sample audit"}
              <ArrowRight size={17} weight="bold" />
            </button>
            <button type="button" className="button button-secondary" disabled={busy} onClick={onCreateBlank}>
              <Plus size={17} weight="bold" /> Create blank audit
            </button>
            <button type="button" className="text-action" disabled={busy} onClick={onImport}>
              Import an audit package
            </button>
            <button type="button" className="text-action" disabled={busy} onClick={onOpenCaptureLibrary}>
              Open screenshot-only capture library
            </button>
          </div>
          {message ? <p className="first-run-message" role="status">{message}</p> : null}
        </section>
        <section className="first-run-route" aria-labelledby="first-run-route-title">
          <div>
            <h2 id="first-run-route-title">What the sample covers</h2>
            <p>About five minutes. Use the real workstation, then delete the demo in one place.</p>
          </div>
          <ol>
            {STAGES.map(({ id, label, icon: Icon }, index) => (
              <li key={id}>
                <span>{index + 1}</span>
                <Icon size={20} weight="duotone" />
                <strong>{label}</strong>
                <small>{[
                  "Read the completed local scope",
                  "Review a saved contrast result",
                  "Trace each decision to finding-owned evidence",
                  "See a complete delivery record",
                ][index]}</small>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

function CoachMark({
  actionLabel,
  children,
  id,
  shortcut,
  title,
  onAction,
  onDismiss,
}: {
  actionLabel: string;
  children: ReactNode;
  id: CoachMarkId;
  shortcut: string;
  title: string;
  onAction: () => void;
  onDismiss: (id: CoachMarkId) => void;
}) {
  const titleId = `coach-${id}-title`;
  return (
    <aside className="coach-mark" aria-labelledby={titleId}>
      <span className="coach-step">Demo tip</span>
      <div>
        <h2 id={titleId}>{title}</h2>
        <p>{children}</p>
        <div className="coach-actions">
          <button type="button" className="text-action" onClick={onAction}>{actionLabel}</button>
          <kbd>{shortcut}</kbd>
        </div>
      </div>
      <button type="button" className="coach-dismiss" aria-label={`Dismiss ${title} tip`} onClick={() => onDismiss(id)}>
        <X size={16} />
      </button>
    </aside>
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
  const [demoDeleteConfirm, setDemoDeleteConfirm] = useState(false);
  const [seedingSample, setSeedingSample] = useState(false);
  const [standaloneCaptureLibrary, setStandaloneCaptureLibrary] = useState(false);
  const [auditDataVersion, setAuditDataVersion] = useState(0);
  const [firstRunMessage, setFirstRunMessage] = useState("");
  const [dismissedCoachMarks, setDismissedCoachMarks] = useState<CoachMarkId[]>([]);
  const [shortcuts, setShortcuts] = useState<AppSettings["shortcuts"]>({
    inspect: "Alt+CommandOrControl+P",
    capture: "Alt+CommandOrControl+S",
    lens: "Alt+CommandOrControl+L",
  });
  const [stats, setStats] = useState({
    captures: 0,
    findings: 0,
    reviewed: 0,
    reports: 0,
  });
  const [planSections, setPlanSections] = useState<{
    auditId: string;
    sampleItems: AuditSampleItem[];
    testRuns: AuditTestRun[];
  }>({ auditId: "", sampleItems: [], testRuns: [] });
  const [guidedSession, setGuidedSession] = useState<
    (AuditSessionSelection & { auditId: string }) | null
  >(null);
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
    error: auditWorkspaceError,
    importAudit,
    ready,
    recordActivity: persistActivity,
    restoreAudit,
    retryLoad,
    selectAudit,
    updateAudit,
  } = auditWorkspace;
  useEffect(() => {
    let active = true;
    void Promise.all([
      desktop.invoke<AppSettings>("settings:get"),
      getStored<CoachMarkId[]>(COACH_MARKS_KEY, []),
    ]).then(([settings, dismissed]) => {
      if (!active) return;
      setShortcuts(settings.shortcuts);
      setDismissedCoachMarks(
        dismissed.filter((id): id is CoachMarkId =>
          id === "contrast" || id === "capture" || id === "vision"),
      );
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (auditWorkspaceError) {
      setNotice({ text: auditWorkspaceError, error: true, title: "Audit storage problem" });
    }
  }, [auditWorkspaceError]);
  const activeAuditIdRef = useRef(activeAudit?.id ?? "");
  useEffect(() => {
    activeAuditIdRef.current = activeAudit?.id ?? "";
  }, [activeAudit?.id]);
  const recordActivity = useCallback(
    async (entry: Omit<AuditActivity, "id" | "auditId" | "createdAt">) => {
      const auditId = activeAudit?.id;
      if (!auditId) return;
      await persistActivity(entry);
      const next = await getStored<AuditActivity[]>(
        auditStoreKey(auditId, "activity"),
        [],
      );
      if (activeAuditIdRef.current === auditId) setActivity(next);
    },
    [activeAudit?.id, persistActivity],
  );
  const title = TITLES[active];
  const activePlanSections = planSections.auditId === activeAudit?.id
    ? planSections
    : { auditId: activeAudit?.id ?? "", sampleItems: [], testRuns: [] };
  const startReadiness = activeAudit
    ? auditStartReadiness(activeAudit, activePlanSections.sampleItems, activePlanSections.testRuns)
    : null;
  const emitFunnelTelemetry = useCallback((event: FunnelTelemetryEvent) => {
    return desktop.invoke("telemetry:emit", { event }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (startReadiness?.ready) void emitFunnelTelemetry("download_to_first_plan");
  }, [active, emitFunnelTelemetry, startReadiness?.ready]);
  const updatePlanSections = useCallback(
    (sampleItems: AuditSampleItem[], testRuns: AuditTestRun[]) => {
      setPlanSections({ auditId: activeAudit?.id ?? "", sampleItems, testRuns });
    },
    [activeAudit?.id],
  );

  const dismissCoachMark = useCallback((id: CoachMarkId) => {
    setDismissedCoachMarks((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      void setStored(COACH_MARKS_KEY, next);
      return next;
    });
  }, []);

  const dismissAllCoachMarks = useCallback(() => {
    const next: CoachMarkId[] = ["contrast", "capture", "vision"];
    setDismissedCoachMarks(next);
    void setStored(COACH_MARKS_KEY, next);
  }, []);

  const commands = useMemo(
    () =>
      [...STAGES, CAPTURE_LIBRARY, ...UTILITIES].filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  useEffect(
    () =>
      desktop.on<WorkspaceTool>("navigation:tool", (tool) =>
        navigate(normalizeRoute(tool)),
      ),
    [startReadiness?.ready, startReadiness?.blockers[0]],
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
      if ((event.metaKey || event.ctrlKey) && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        navigate(STAGES[Number(event.key) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startReadiness?.ready, startReadiness?.blockers[0]]);
  useEffect(() => {
    if (!activeAudit) return;
    let cancelled = false;
    void Promise.all([
      listCaptures(activeAudit.id),
      getStored<Finding[]>(auditStoreKey(activeAudit.id, "findings"), []),
      getStored<Record<string, { result?: string }>>(
        auditStoreKey(activeAudit.id, "checklist"),
        {},
      ),
      getStored<unknown[]>(auditStoreKey(activeAudit.id, "reports"), []),
      getStored<AuditActivity[]>(auditStoreKey(activeAudit.id, "activity"), []),
      getStored<AuditSampleItem[]>(auditStoreKey(activeAudit.id, "sampleItems"), []),
      getStored<AuditTestRun[]>(auditStoreKey(activeAudit.id, "testRuns"), []),
    ]).then(([captures, findings, checklist, reports, nextActivity, sampleItems, testRuns]) => {
      if (cancelled) return;
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
      setPlanSections({ auditId: activeAudit.id, sampleItems, testRuns });
    }).catch((error) => {
      if (!cancelled) {
        setNotice({ text: messageFromError(error), error: true, title: "Audit data could not be loaded" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active, activeId, activityOpen, activeAudit?.standard, auditDataVersion]);
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
    if (!activeAudit && (route === "evidence" || route === "captures")) {
      setStandaloneCaptureLibrary(true);
      setCommandOpen(false);
      setQuery("");
      return;
    }
    if (
      route !== "plan" &&
      STAGES.some((stage) => stage.id === route) &&
      startReadiness &&
      !startReadiness.ready
    ) {
      setActive("plan");
      setNotice({
        text: startReadiness.blockers[0] || "Complete the audit setup before starting inspection.",
        error: true,
        title: "Finish audit setup",
      });
      return;
    }
    if (route === "share" && startReadiness?.ready) {
      void emitFunnelTelemetry("download_to_first_plan").then(() =>
        emitFunnelTelemetry("first_plan_to_first_deliver"),
      );
    }
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
        sampleItemId: capture.sampleItemId,
        testRunId: capture.testRunId,
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

  async function installAuditPackage(
    payload: AuditPackagePayload,
    source: "import" | "demo",
  ) {
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
      "vpatResponses",
    ] as const;
    try {
      const captureMap = new Map<string, string>();
      for (const capture of payload.captures) {
        const entry = await desktop.invoke<CaptureEntry>("capture:create", {
          pngDataUrl: capture.rawPngDataUrl,
          title: capture.title,
          auditId: imported.id,
          sampleItemId: capture.sampleItemId,
          testRunId: capture.testRunId,
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
          evidenceCaptureIds: finding.evidenceCaptureIds
            ?.map((captureId) => remapCapture(captureId))
            .filter((captureId): captureId is string => Boolean(captureId)),
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
          title: source === "demo" ? "Guided sample created" : "Audit package imported",
          detail: source === "demo"
            ? "Bundled local training data. No network content was opened."
            : `Integrity verified. Exported ${payload.exportedAt}.`,
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
        setStored(auditStoreKey(imported.id, "vpatResponses"), {}),
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
      setAuditDataVersion((value) => value + 1);
      return imported;
    } catch (error) {
      await Promise.all([
        ...createdCaptureIds.map((id) => desktop.invoke("capture:delete", { id })),
        ...sections.map((section) =>
          desktop.invoke("store:remove", { key: auditStoreKey(imported.id, section) }),
        ),
      ]).catch(() => undefined);
      await discardAudit(imported.id);
      throw error;
    }
  }

  async function importAuditPackage() {
    const text = await desktop.invoke<string | null>("dialog:open-text", {
      extension: "json",
    });
    if (!text) return;
    const payload = await parseAuditPackage(text);
    const imported = await installAuditPackage(payload, "import");
    setActive("plan");
    setNotice({
      text: `${imported.project} imported with verified integrity`,
      error: false,
    });
  }

  async function startGuidedSample() {
    if (seedingSample) return;
    setSeedingSample(true);
    setFirstRunMessage("");
    try {
      const sample = createGuidedSampleAuditPackage();
      const imported = await installAuditPackage(sample, "demo");
      setActive("plan");
      setNotice({
        text: `${imported.project} is ready. Start at Plan, then use Next to move through all four stages. Evidence is attached inside each finding.`,
        error: false,
      });
      window.setTimeout(() => document.getElementById("audit-workspace-main")?.focus(), 0);
    } catch (error) {
      setFirstRunMessage(messageFromError(error, "The guided sample could not be prepared."));
    } finally {
      setSeedingSample(false);
    }
  }

  function createBlankAudit() {
    const audit = createAudit("Untitled audit");
    setActive("plan");
    setFirstRunMessage("");
    setNotice({ text: `${audit.project} created`, error: false });
  }

  async function deleteDemoAudit() {
    if (!activeAudit?.demo) return;
    const name = activeAudit.project;
    const removed = await discardAudit(activeAudit.id);
    setDemoDeleteConfirm(false);
    if (!removed) {
      setNotice({ text: "The demo could not be removed cleanly.", error: true });
      return;
    }
    setActive("plan");
    setFirstRunMessage(`${name} and all of its local sample data were removed.`);
    setNotice({ text: `${name} removed`, error: false });
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

  if (!ready)
    return (
      <div className="workspace-loading">
        <img src="./logo.png" alt="" />
        <span>Preparing your audits</span>
      </div>
    );

  if (!activeAudit && auditWorkspaceError)
    return (
      <div className="workspace-loading">
        <img src="./logo.png" alt="" />
        <strong>The audit workspace could not be opened</strong>
        <span>{auditWorkspaceError}</span>
        <button className="button button-primary" onClick={retryLoad}>Try again</button>
      </div>
    );

  if (!activeAudit && standaloneCaptureLibrary)
    return (
      <div className="standalone-capture-shell">
        <a className="skip-link" href="#standalone-capture-main">Skip to capture library</a>
        <header>
          <button type="button" className="button button-secondary" onClick={() => setStandaloneCaptureLibrary(false)}>
            <ArrowLeft size={17} /> Back
          </button>
          <div><span className="section-label">No audit required</span><strong>Screenshot and annotation workspace</strong></div>
          <span className="local-only-badge">Stored locally</span>
        </header>
        <main id="standalone-capture-main" tabIndex={-1}>
          <EvidenceView />
        </main>
      </div>
    );

  if (!activeAudit)
    return (
      <FirstRunExperience
        busy={seedingSample}
        message={firstRunMessage}
        onCreateBlank={createBlankAudit}
        onImport={() => {
          void importAuditPackage().catch((error) =>
            setFirstRunMessage(messageFromError(error, "The audit package could not be imported.")),
          );
        }}
        onOpenCaptureLibrary={() => setStandaloneCaptureLibrary(true)}
        onStartSample={() => void startGuidedSample()}
      />
    );

  const plan = auditPlanProgress(activeAudit);

  const body =
    active === "plan" ? (
      <PlanView
        key={`${activeAudit.id}-${auditDataVersion}`}
        audit={activeAudit}
        onAuditChange={updateAudit}
        recordActivity={recordActivity}
        onNavigate={navigate}
        onExportPackage={exportAuditPackage}
        onImportPackage={importAuditPackage}
        onPlanSectionsChange={updatePlanSections}
        onOpenFindings={openFindings}
        onStartGuidedSession={(selection) => {
          setGuidedSession({ ...selection, auditId: activeAudit.id });
          navigate("inspect");
        }}
      />
    ) : active === "inspect" ? (
      <InspectView
        key={`${activeAudit.id}-${auditDataVersion}`}
        auditId={activeAudit.id}
        initialSession={guidedSession?.auditId === activeAudit.id ? guidedSession : null}
        onNavigate={navigate}
        recordActivity={recordActivity}
      />
    ) : active === "evidence" ? (
      <EvidenceView
        key={`${activeAudit.id}-${auditDataVersion}`}
        auditId={activeAudit.id}
        initialTab={evidenceTab}
        onNavigate={navigate}
        recordActivity={recordActivity}
      />
    ) : active === "review" ? (
      <ReviewView
        key={`${activeAudit.id}-${auditDataVersion}`}
        audit={activeAudit}
        recordActivity={recordActivity}
        onOpenFindings={openFindings}
      />
    ) : active === "share" ? (
      <ShareView
        key={`${activeAudit.id}-${auditDataVersion}`}
        audit={activeAudit}
        onAuditChange={updateAudit}
        recordActivity={recordActivity}
        onNavigate={navigate}
      />
    ) : active === "program" ? (
      <ProgramDashboard audits={audits} />
    ) : active === "captures" ? (
      <EvidenceView />
    ) : active === "palette" ? (
      <PaletteView key={`${activeAudit.id}-${auditDataVersion}`} auditId={activeAudit.id} />
    ) : active === "vision" ? (
      <VisionView />
    ) : (
      <SettingsView platform={platform} />
    );

  const coachId: CoachMarkId | null = activeAudit.demo
    ? active === "inspect"
      ? "contrast"
      : active === "evidence"
        ? "capture"
        : active === "review" || active === "vision"
          ? "vision"
          : null
    : null;
  const visibleCoachId = coachId && !dismissedCoachMarks.includes(coachId)
    ? coachId
    : null;
  const focusControl = (id: string) => {
    window.setTimeout(() => document.getElementById(id)?.focus(), 0);
  };
  const coachMark = visibleCoachId === "contrast" ? (
    <CoachMark
      id="contrast"
      title="Pick a contrast pair without leaving your task"
      shortcut={formatShortcut(shortcuts.inspect, platform.platform)}
      actionLabel="Focus contrast picker"
      onAction={() => focusControl("contrast-picker-action")}
      onDismiss={dismissCoachMark}
    >
      The sample already contains a saved result. Use Pick from screen when you
      want to inspect any visible interface, then save the result as evidence.
    </CoachMark>
  ) : visibleCoachId === "capture" ? (
    <CoachMark
      id="capture"
      title="Capture first, then annotate the evidence"
      shortcut={formatShortcut(shortcuts.capture, platform.platform)}
      actionLabel="Focus capture action"
      onAction={() => focusControl("capture-annotate-action")}
      onDismiss={dismissCoachMark}
    >
      The demo capture is bundled locally. For real work, capture a region and
      open its thumbnail to add issue badges, notes, measurements, or redactions.
    </CoachMark>
  ) : visibleCoachId === "vision" ? (
    <CoachMark
      id="vision"
      title="Keep the vision lens one shortcut away"
      shortcut={formatShortcut(shortcuts.lens, platform.platform)}
      actionLabel={active === "vision" ? "Focus lens action" : "Open vision lens utility"}
      onAction={() => {
        if (active !== "vision") navigate("vision");
        focusControl("vision-lens-action");
      }}
      onDismiss={dismissCoachMark}
    >
      Toggle the protected lens over any application to inspect color and clarity.
      Escape closes the lens without interrupting the audit record.
    </CoachMark>
  ) : null;

  const stageIndex = STAGES.findIndex((stage) => stage.id === active);
  const stageStats = [
    `${plan.complete}/${plan.total} ready`,
    startReadiness?.ready ? "Ready" : "Setup needed",
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
      <a className="skip-link" href="#audit-workspace-main">Skip to audit workspace</a>
      {coachMark ? (
        <a
          className="skip-link skip-coaching"
          href="#guided-stage-content"
          onClick={dismissAllCoachMarks}
        >
          Skip demo tips
        </a>
      ) : null}
      <Toast message={notice} onClose={() => setNotice(null)} />
      <aside className="stage-rail" aria-label="Audit workflow">
        <button
          className="rail-brand"
          aria-label="Go to Plan"
          onClick={() => navigate("plan")}
        >
          <img src="./logo.png" alt="TheWCAG" draggable={false} />
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
          <button
            className="stage-link optional-records-link"
            data-active={active === CAPTURE_LIBRARY.id}
            aria-current={active === CAPTURE_LIBRARY.id ? "page" : undefined}
            title="Optional findings and capture library"
            onClick={() => navigate(CAPTURE_LIBRARY.id)}
          >
            <span className="stage-number">—</span>
            <SquaresFour size={19} weight={active === CAPTURE_LIBRARY.id ? "duotone" : "regular"} />
            <span>{CAPTURE_LIBRARY.label}</span>
            <small>{stats.findings} findings · {stats.captures} captures</small>
          </button>
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

      <div className="workspace-column">
        <header className="command-bar">
          <div className="drag-space" aria-hidden />
          <button
            className="project-switcher"
            onClick={() => setSwitcherOpen(true)}
            aria-haspopup="dialog"
          >
            <span className="project-glyph">
              <BookOpenText size={17} weight="duotone" />
            </span>
            <span className="project-name">{activeAudit.project}</span>
            {activeAudit.demo ? <span className="demo-badge">Demo</span> : null}
            <CaretDown size={14} />
          </button>
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
            {activeAudit.demo ? (
              <button
                type="button"
                className="demo-delete-action"
                onClick={() => setDemoDeleteConfirm(true)}
              >
                <Trash size={16} /> Delete demo
              </button>
            ) : null}
            <IconButton
              label="Open first audit guide"
              onClick={() => void desktop.invoke("shell:open-external", { url: "https://app.thewcag.com/getting-started" })}
            >
              <BookOpenText size={18} />
            </IconButton>
            <IconButton
              label={inspector ? "Hide audit panel" : "Show audit panel"}
              className="inspector-toggle"
              ariaExpanded={inspector}
              ariaControls="audit-context-panel"
              onClick={() => setInspector((value) => !value)}
            >
              <SidebarSimple size={18} weight="bold" />
            </IconButton>
            <IconButton
              label="Account and settings"
              onClick={() => navigate("settings")}
            >
              <UserCircle size={19} />
            </IconButton>
          </div>
        </header>

        <main id="audit-workspace-main" tabIndex={-1} className={`workstage ${inspector ? "with-inspector" : ""}`}>
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
                  disabled={stageIndex === 0 && !startReadiness?.ready}
                  onClick={() => navigate(STAGES[stageIndex + 1].id)}
                >
                  Next: {STAGES[stageIndex + 1].label}
                </button>
              ) : null}
            </div>
            <div ref={taskContentRef} className="task-content">
              {coachMark}
              <div id="guided-stage-content" tabIndex={-1}>{body}</div>
            </div>
          </section>
          {compact && inspector ? (
            <button
              type="button"
              className="inspector-scrim"
              aria-label="Close audit status panel"
              onClick={() => setInspector(false)}
            />
          ) : null}
          {inspector ? (
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
          {inspector ? (
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
                  <strong>{activeAudit.project}{activeAudit.demo ? " (Demo)" : ""}</strong>
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
                  {startReadiness?.blockers.length
                    ? startReadiness.blockers[0]
                    : `Ready to start with ${activePlanSections.sampleItems.length} sample items and ${activePlanSections.testRuns.length} guided test runs.`}
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
          {audits.some((audit) => audit.archivedAt) ? (
            <div className="audit-list-section-label">Archived audits</div>
          ) : null}
          {audits
            .filter((audit) => audit.archivedAt)
            .map((audit) => (
              <button
                key={audit.id}
                data-archived="true"
                title={`Restore ${audit.project}`}
                onClick={() => {
                  restoreAudit(audit.id);
                  setSwitcherOpen(false);
                  setNotice({ text: `${audit.project} restored`, error: false });
                }}
              >
                <span className="project-avatar">
                  {audit.project.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{audit.project}</strong>
                  <small>Archived · select to restore</small>
                </span>
                <Archive size={17} />
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
        open={demoDeleteConfirm}
        title={`Delete ${GUIDED_SAMPLE_NAME}?`}
        description="This permanently removes the demo audit, its bundled capture, annotations, findings, review decisions, and activity from this computer. Your other audits are not affected."
        confirmLabel="Delete demo and sample data"
        onCancel={() => setDemoDeleteConfirm(false)}
        onConfirm={() => void deleteDemoAudit()}
      />
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
