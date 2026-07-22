import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowCounterClockwise,
  ArrowRight,
  CheckCircle,
  ClipboardText,
  DownloadSimple,
  FloppyDisk,
  MagicWand,
  Plus,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  AuditProject,
  AuditSampleItem,
  AuditScopeDiscovery,
  AuditScopeFeature,
  AuditTemplate,
  AuditTargetType,
  AuditTestRun,
  CaptureEntry,
  Finding,
  WorkspaceStage,
} from "../../shared/desktop";
import { desktop, getStored, listCaptures, setStored } from "../api";
import {
  auditPlanProgress,
  auditStartReadiness,
  auditTestRunComplete,
} from "../audit-plan";
import {
  buildAuditCoverage,
  type AuditChecklistEntry,
  type AuditSessionSelection,
} from "../audit-coverage";
import { AuditCoverageMap } from "../AuditCoverageMap";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import { Button, ConfirmDialog, Field, Toast } from "../components";
import { messageFromError, useTransientMessage } from "../hooks";
import {
  AUDIT_TEST_SCRIPTS,
  BUILT_IN_AUDIT_TEMPLATES,
  createTestRun,
} from "../audit-templates";
import {
  AUDIT_SCOPE_FEATURE_OPTIONS,
  AUDIT_TARGET_TYPE_OPTIONS,
  auditPatchInvalidatesScopeProfile,
  incorporateScopeDiscovery,
  recommendAuditScope,
  scopeProfileFromRecommendation,
  type AuditScopeRecommendation,
} from "../audit-scoper";

const PERSONAL_TEMPLATES_KEY = "audit-templates-v1";

const SAMPLE_KIND_LABELS: Record<AuditSampleItem["kind"], string> = {
  page: "Page or screen",
  flow: "User flow",
  component: "Component",
  document: "Document",
  state: "Application state",
};

const SAMPLE_STATUS_LABELS: Record<AuditSampleItem["status"], string> = {
  planned: "Planned",
  "in-progress": "In progress",
  complete: "Tested",
  blocked: "Blocked",
};

export function PlanView({
  audit,
  onAuditChange,
  recordActivity,
  onNavigate,
  onExportPackage,
  onImportPackage,
  onPlanSectionsChange,
  onOpenFindings,
  onStartGuidedSession,
}: {
  audit: AuditProject;
  onAuditChange: (patch: Partial<AuditProject>) => void;
  recordActivity: RecordAuditActivity;
  onNavigate: (stage: WorkspaceStage) => void;
  onExportPackage: () => Promise<void>;
  onImportPackage: () => Promise<void>;
  onPlanSectionsChange: (items: AuditSampleItem[], runs: AuditTestRun[]) => void;
  onOpenFindings: () => void;
  onStartGuidedSession: (selection: AuditSessionSelection) => void;
}) {
  const [items, setItems] = useState<AuditSampleItem[]>([]);
  const [testRuns, setTestRuns] = useState<AuditTestRun[]>([]);
  const [coverageRecords, setCoverageRecords] = useState<{
    captures: CaptureEntry[];
    findings: Finding[];
    checklist: Record<string, AuditChecklistEntry>;
  }>({ captures: [], findings: [], checklist: {} });
  const [loadedAuditId, setLoadedAuditId] = useState("");
  const [personalTemplates, setPersonalTemplates] = useState<AuditTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(BUILT_IN_AUDIT_TEMPLATES[0].id);
  const [templateName, setTemplateName] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState(AUDIT_TEST_SCRIPTS[0].id);
  const [scoperTargetType, setScoperTargetType] = useState<AuditTargetType | "auto">("auto");
  const [scoperFeatures, setScoperFeatures] = useState<AuditScopeFeature[] | null>(null);
  const [discovery, setDiscovery] = useState<AuditScopeDiscovery | null>(null);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [pendingRecommendation, setPendingRecommendation] = useState<AuditScopeRecommendation | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<AuditTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<AuditTemplate | null>(null);
  const [testRunToDelete, setTestRunToDelete] = useState<AuditTestRun | null>(null);
  const [packageBusy, setPackageBusy] = useState<"import" | "export" | null>(null);
  const [kind, setKind] = useState<AuditSampleItem["kind"]>("page");
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [itemToDelete, setItemToDelete] = useState<AuditSampleItem | null>(null);
  const [message, show] = useTransientMessage();
  const sampleWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const testWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const sampleKey = auditStoreKey(audit.id, "sampleItems");
  const testRunsKey = auditStoreKey(audit.id, "testRuns");
  const plan = auditPlanProgress(audit);
  const recommendation = useMemo(() => {
    const detectedType = scoperTargetType === "auto" && discovery
      ? discovery.targetType
      : scoperTargetType;
    const detectedFeatures = scoperFeatures ?? discovery?.featureIds;
    const base = recommendAuditScope({
      target: audit.target,
      project: audit.project,
      goal: audit.goal,
      targetType: detectedType,
      featureIds: detectedFeatures,
      targetTypeOrigin: scoperTargetType === "auto" && discovery ? "discovery" : undefined,
      featureOrigin: scoperFeatures === null && discovery ? "discovery" : undefined,
    });
    return discovery ? incorporateScopeDiscovery(base, discovery) : base;
  }, [audit.goal, audit.project, audit.target, discovery, scoperFeatures, scoperTargetType]);
  const readiness = auditStartReadiness(audit, items, testRuns);
  const coverage = useMemo(
    () => buildAuditCoverage({
      sampleItems: items,
      testRuns,
      captures: coverageRecords.captures,
      findings: coverageRecords.findings,
      checklist: coverageRecords.checklist,
    }),
    [coverageRecords, items, testRuns],
  );

  function persistSample(next: AuditSampleItem[]) {
    const key = sampleKey;
    const request = sampleWriteQueue.current.then(() => setStored(key, next));
    sampleWriteQueue.current = request.catch(() => undefined);
    return request;
  }

  function persistTestRuns(next: AuditTestRun[]) {
    const key = testRunsKey;
    const request = testWriteQueue.current.then(() => setStored(key, next));
    testWriteQueue.current = request.catch(() => undefined);
    return request;
  }

  useEffect(() => {
    let cancelled = false;
    setLoadedAuditId("");
    setItems([]);
    setTestRuns([]);
    setCoverageRecords({ captures: [], findings: [], checklist: {} });
    void Promise.all([
      getStored<AuditSampleItem[]>(sampleKey, []),
      getStored<AuditTestRun[]>(testRunsKey, []),
      getStored<AuditTemplate[]>(PERSONAL_TEMPLATES_KEY, []),
      listCaptures(audit.id),
      getStored<Finding[]>(auditStoreKey(audit.id, "findings"), []),
      getStored<Record<string, AuditChecklistEntry>>(
        auditStoreKey(audit.id, "checklist"),
        {},
      ),
    ])
      .then(([nextItems, nextTestRuns, nextTemplates, captures, findings, checklist]) => {
        if (cancelled) return;
        setItems(nextItems);
        setTestRuns(nextTestRuns);
        setPersonalTemplates(
          nextTemplates.filter((template) => template.source === "personal"),
        );
        setCoverageRecords({ captures, findings, checklist });
        setLoadedAuditId(audit.id);
      })
      .catch((error) => {
        if (!cancelled) show(messageFromError(error), true);
      });
    return () => {
      cancelled = true;
    };
  }, [audit.id, sampleKey, testRunsKey]);

  useEffect(() => {
    setScoperTargetType("auto");
    setScoperFeatures(null);
    setDiscovery(null);
  }, [audit.id]);

  useEffect(() => {
    if (loadedAuditId === audit.id) onPlanSectionsChange(items, testRuns);
  }, [audit.id, items, loadedAuditId, testRuns, onPlanSectionsChange]);

  const sample = useMemo(() => {
    const complete = items.filter((item) => item.status === "complete").length;
    const blocked = items.filter((item) => item.status === "blocked").length;
    return {
      complete,
      blocked,
      remaining: items.length - complete,
      percent: items.length ? Math.round((complete / items.length) * 100) : 0,
    };
  }, [items]);

  const nextAction = readiness.blockers[0]
    ? readiness.blockers[0].replace(/\.$/, "")
    : "Ready to start inspection";

  function patchAudit(patch: Partial<AuditProject>) {
    onAuditChange(
      audit.scopeProfile && auditPatchInvalidatesScopeProfile(patch)
        ? { ...patch, scopeProfile: undefined }
        : patch,
    );
  }

  async function addSample(event: FormEvent) {
    event.preventDefault();
    if (!label.trim()) {
      show("Add a clear page, flow, component, document, or state name.", true);
      return;
    }
    const now = Date.now();
    const item: AuditSampleItem = {
      id: crypto.randomUUID(),
      kind,
      label: label.trim(),
      location: location.trim(),
      status: "planned",
      notes: "",
      createdAt: now,
      modifiedAt: now,
    };
    const next = [...items, item];
    setItems(next);
    try {
      await Promise.all([
        persistSample(next),
        recordActivity({
          kind: "updated",
          title: "Sample item added",
          detail: `${SAMPLE_KIND_LABELS[item.kind]}: ${item.label}`,
        }),
      ]);
      setLabel("");
      setLocation("");
      show("Representative sample updated");
    } catch (error) {
      setItems(items);
      show(messageFromError(error), true);
    }
  }

  function patchItem(id: string, patch: Partial<AuditSampleItem>) {
    setItems((current) => {
      const next = current.map((item) =>
        item.id === id ? { ...item, ...patch, modifiedAt: Date.now() } : item,
      );
      void persistSample(next).catch((error) =>
        show(messageFromError(error), true),
      );
      return next;
    });
  }

  async function confirmDelete() {
    if (!itemToDelete) return;
    const next = items.filter((item) => item.id !== itemToDelete.id);
    try {
      await Promise.all([
        persistSample(next),
        recordActivity({
          kind: "updated",
          title: "Sample item removed",
          detail: itemToDelete.label,
        }),
      ]);
      setItems(next);
      setItemToDelete(null);
      show("Sample item removed");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  const templates = [...BUILT_IN_AUDIT_TEMPLATES, ...personalTemplates];

  async function applyScopePlan(options: {
    template: AuditTemplate;
    sampleItems: AuditTemplate["sampleItems"];
    testScriptIds: string[];
    auditPatch?: Partial<AuditProject>;
    activityTitle: string;
    activityDetail: string;
  }): Promise<boolean> {
    const now = Date.now();
    const nextItems: AuditSampleItem[] = options.sampleItems.map(
      (item) => ({
        ...item,
        id: crypto.randomUUID(),
        status: "planned",
        createdAt: now,
        modifiedAt: now,
      }),
    );
    const nextRuns = options.testScriptIds
      .map((id) => AUDIT_TEST_SCRIPTS.find((script) => script.id === id))
      .filter((script): script is NonNullable<typeof script> => Boolean(script))
      .map(createTestRun);
    const writes = await Promise.allSettled([
      persistSample(nextItems),
      persistTestRuns(nextRuns),
    ]);
    if (writes.some((result) => result.status === "rejected")) {
      await Promise.allSettled([
        persistSample(items),
        persistTestRuns(testRuns),
      ]);
      const rejected = writes.find((result) => result.status === "rejected");
      show(
        messageFromError(
          rejected?.status === "rejected"
            ? rejected.reason
            : new Error("The audit plan could not be saved."),
        ),
        true,
      );
      return false;
    }

    onAuditChange({
      goal: options.template.goal,
      scope: options.template.scope,
      sample: options.template.sample,
      excludedScope: options.template.excludedScope,
      environment: options.template.environment,
      assistiveTechnology: options.template.assistiveTechnology,
      methodology: options.template.methodology,
      standard: options.template.standard,
      ...options.auditPatch,
      conclusion: "in-progress",
      completedAt: "",
    });
    setItems(nextItems);
    setTestRuns(nextRuns);
    try {
      await recordActivity({
        kind: "updated",
        title: options.activityTitle,
        detail: options.activityDetail,
      });
    } catch (error) {
      show(`${options.template.name} was applied, but the activity entry could not be saved: ${messageFromError(error)}`, true);
      return true;
    }
    show(`${options.template.name} applied`);
    return true;
  }

  async function applyTemplate() {
    if (!pendingTemplate) return;
    const scopeProfile = pendingTemplate.targetType
      ? {
          version: 1 as const,
          targetType: pendingTemplate.targetType,
          featureIds: [...(pendingTemplate.featureIds ?? [])],
          templateId: pendingTemplate.id,
          confidence: "high" as const,
          reasons: [`${pendingTemplate.name} was selected by the auditor.`],
          confirmedAt: Date.now(),
        }
      : undefined;
    const applied = await applyScopePlan({
      template: pendingTemplate,
      sampleItems: pendingTemplate.sampleItems,
      testScriptIds: pendingTemplate.testScriptIds,
      auditPatch: { scopeProfile },
      activityTitle: "Audit template applied",
      activityDetail: pendingTemplate.name,
    });
    if (applied) setPendingTemplate(null);
  }

  async function applyRecommendation() {
    if (!pendingRecommendation) return;
    const featureLabels = pendingRecommendation.featureIds.map(
      (id) => AUDIT_SCOPE_FEATURE_OPTIONS.find((feature) => feature.id === id)?.label,
    ).filter(Boolean);
    const applied = await applyScopePlan({
      template: pendingRecommendation.template,
      sampleItems: pendingRecommendation.sampleItems,
      testScriptIds: pendingRecommendation.testScriptIds,
      auditPatch: {
        scope: `${pendingRecommendation.template.scope}\n\nPlanned feature coverage: ${featureLabels.join(", ") || "general WCAG review"}.`,
        sample: `${pendingRecommendation.template.sample} Refine every generated location before its test begins.`,
        scopeProfile: scopeProfileFromRecommendation(pendingRecommendation),
      },
      activityTitle: "Built-in scoper applied",
      activityDetail: `${pendingRecommendation.template.name} (${pendingRecommendation.confidence} confidence)`,
    });
    if (applied) {
      setSelectedTemplateId(pendingRecommendation.template.id);
      setPendingRecommendation(null);
    }
  }

  async function savePersonalTemplate(event: FormEvent) {
    event.preventDefault();
    const name = templateName.trim();
    if (!name) return;
    const template: AuditTemplate = {
      id: `personal-${crypto.randomUUID()}`,
      name: name.slice(0, 80),
      description: `Saved from ${audit.project}`,
      source: "personal",
      goal: audit.goal,
      scope: audit.scope,
      sample: audit.sample,
      excludedScope: audit.excludedScope,
      environment: audit.environment,
      assistiveTechnology: audit.assistiveTechnology,
      methodology: audit.methodology,
      standard: audit.standard,
      sampleItems: items.map(({ kind, label, location, notes }) => ({
        kind,
        label,
        location,
        notes,
      })),
      testScriptIds: [...new Set(testRuns.map((run) => run.scriptId))],
      targetType: audit.scopeProfile?.targetType,
      featureIds: audit.scopeProfile ? [...audit.scopeProfile.featureIds] : undefined,
      createdAt: Date.now(),
    };
    const next = [...personalTemplates, template];
    try {
      await setStored(PERSONAL_TEMPLATES_KEY, next);
      setPersonalTemplates(next);
      setSelectedTemplateId(template.id);
      setTemplateName("");
      show("Personal audit template saved");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function deletePersonalTemplate() {
    if (!templateToDelete) return;
    const next = personalTemplates.filter(
      (template) => template.id !== templateToDelete.id,
    );
    try {
      await setStored(PERSONAL_TEMPLATES_KEY, next);
      setPersonalTemplates(next);
      setSelectedTemplateId(BUILT_IN_AUDIT_TEMPLATES[0].id);
      setTemplateToDelete(null);
      show("Personal template deleted");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function addTestScript() {
    const script = AUDIT_TEST_SCRIPTS.find(
      (item) => item.id === selectedScriptId,
    );
    if (!script) return;
    const run = createTestRun(script);
    const next = [...testRuns, run];
    try {
      await persistTestRuns(next);
      setTestRuns(next);
      await recordActivity({
        kind: "updated",
        title: "Test script added",
        detail: script.title,
      });
      show("Guided test added to the plan");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  function patchTestRun(id: string, patch: Partial<AuditTestRun>) {
    const currentRun = testRuns.find((run) => run.id === id);
    if (
      patch.status === "complete" &&
      currentRun &&
      !currentRun.steps.every((step) => step.complete && step.observation.trim())
    ) {
      show("Complete every step and add its observation before closing this run.", true);
      return;
    }
    setTestRuns((current) => {
      const next = current.map((run) => {
        if (run.id !== id) return run;
        const updated = { ...run, ...patch, modifiedAt: Date.now() };
        if (patch.steps && updated.status !== "blocked") {
          const complete = patch.steps.every(
            (step) => step.complete && step.observation.trim(),
          );
          const started = patch.steps.some(
            (step) => step.complete || step.observation.trim(),
          );
          updated.status = complete
            ? "complete"
            : started
              ? "in-progress"
              : "planned";
        }
        return updated;
      });
      void persistTestRuns(next).catch((error) =>
        show(messageFromError(error), true),
      );
      return next;
    });
  }

  async function deleteTestRun() {
    if (!testRunToDelete) return;
    const next = testRuns.filter((run) => run.id !== testRunToDelete.id);
    try {
      await persistTestRuns(next);
      setTestRuns(next);
      setTestRunToDelete(null);
      show("Test run removed");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function runPackageAction(action: "import" | "export") {
    setPackageBusy(action);
    try {
      await (action === "import" ? onImportPackage() : onExportPackage());
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setPackageBusy(null);
    }
  }

  function toggleScopeFeature(feature: AuditScopeFeature) {
    const current = scoperFeatures ?? recommendation.featureIds;
    setScoperFeatures(
      current.includes(feature)
        ? current.filter((item) => item !== feature)
        : [...current, feature],
    );
  }

  async function inspectWebsite() {
    setDiscoveryBusy(true);
    try {
      const result = await desktop.invoke<AuditScopeDiscovery>("scope:discover", {
        target: audit.target,
      });
      setDiscovery(result);
      setScoperFeatures(null);
      show(`Inspected ${result.pages.length} public pages across ${result.templateCount} detected templates`);
    } catch (error) {
      setDiscovery(null);
      show(messageFromError(error), true);
    } finally {
      setDiscoveryBusy(false);
    }
  }

  return (
    <div className="audit-plan-view">
      <Toast message={message} />
      <section className="audit-scoper" aria-labelledby="audit-scoper-title">
        <div className="audit-scoper-heading">
          <div className="audit-scoper-icon"><MagicWand size={22} weight="duotone" /></div>
          <div>
            <span className="section-label">Built-in scoper</span>
            <h2 id="audit-scoper-title">Build an audit-ready scope</h2>
            <p>
              Inspect a bounded set of public same-origin pages, detect representative
              templates and feature signals, then confirm the resulting audit plan.
              Discovery never makes a conformance decision.
            </p>
          </div>
        </div>
        <div className="audit-scoper-body">
          <div className="audit-scoper-inputs">
            <Field
              label="Target URL or application"
              hint="Add a URL, application name, document collection, or release description."
            >
              <input
                value={audit.target}
                onChange={(event) => {
                  patchAudit({ target: event.target.value });
                  setDiscovery(null);
                }}
                placeholder="https://example.com, Checkout release, or Desktop app"
              />
            </Field>
            <Field label="Product type">
              <select
                value={scoperTargetType}
                onChange={(event) => {
                  setScoperTargetType(event.target.value as AuditTargetType | "auto");
                  setScoperFeatures(null);
                }}
              >
                <option value="auto">Detect from audit context</option>
                {AUDIT_TARGET_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </Field>
            <div className="audit-discovery-action">
              <Button
                icon={MagicWand}
                disabled={audit.demo || discoveryBusy || !audit.target.trim() || loadedAuditId !== audit.id}
                onClick={() => void inspectWebsite()}
              >
                {audit.demo ? "Bundled sample" : discoveryBusy ? "Inspecting public pages…" : discovery ? "Inspect website again" : "Inspect website"}
              </Button>
              <small>
                {audit.demo
                  ? "The guided sample uses bundled evidence and never requests a website."
                  : "Reads at most 9 public HTML pages (1 MB each), stays on the final origin, and does not sign in or submit forms."}
              </small>
            </div>
          </div>
          {discovery ? (
            <div className="audit-discovery-result" role="status">
              <div>
                <strong>{discovery.title}</strong>
                <span>{discovery.pages.length} inspected · {discovery.discoveredUrlCount} URLs found · {discovery.templateCount} template groups</span>
              </div>
              <details>
                <summary>Review detected pages and limitations</summary>
                <ul className="audit-discovery-pages">
                  {discovery.pages.map((page) => (
                    <li key={page.url}>
                      <strong>{page.title}</strong>
                      <code>{page.url}</code>
                      <span>{page.signals.length ? page.signals.join(", ") : "No feature signal detected"} · {page.templateKey}</span>
                    </li>
                  ))}
                </ul>
                <ul className="audit-discovery-warnings">
                  {discovery.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </details>
            </div>
          ) : null}
          <fieldset className="audit-scoper-features">
            <legend>Content and task coverage</legend>
            <p>Select everything materially present in the target. Public-page detection is only a starting recommendation.</p>
            <div className="audit-scoper-feature-grid">
              {AUDIT_SCOPE_FEATURE_OPTIONS.map((feature) => (
                <label key={feature.id}>
                  <input
                    type="checkbox"
                    checked={recommendation.featureIds.includes(feature.id)}
                    onChange={() => toggleScopeFeature(feature.id)}
                  />
                  <span>
                    <strong>{feature.label}</strong>
                    <small>{feature.description}</small>
                  </span>
                </label>
              ))}
            </div>
            {scoperFeatures !== null ? (
              <button
                type="button"
                className="text-action audit-scoper-reset"
                onClick={() => setScoperFeatures(null)}
              >
                <ArrowCounterClockwise size={14} /> Reset feature detection
              </button>
            ) : null}
          </fieldset>
          <div className="audit-scope-recommendation" data-confidence={recommendation.confidence}>
            <div className="audit-scope-recommendation-heading">
              <div>
                <span>{recommendation.confidence} confidence recommendation</span>
                <h3>{recommendation.template.name}</h3>
              </div>
              <span className="audit-scope-confidence">{recommendation.confidence}</span>
            </div>
            <p>{recommendation.template.description}</p>
            <ul>
              {recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            <div className="audit-scope-output" aria-label="Recommended plan contents">
              <span><strong>{recommendation.sampleItems.length}</strong> sample items</span>
              <span><strong>{recommendation.testScriptIds.length}</strong> guided test runs</span>
              <span><strong>{recommendation.featureIds.length}</strong> feature areas</span>
            </div>
            <Button
              variant="primary"
              icon={MagicWand}
              disabled={!audit.target.trim() || loadedAuditId !== audit.id}
              onClick={() => setPendingRecommendation(recommendation)}
            >
              Use recommended scope
            </Button>
          </div>
        </div>
      </section>
      <section className="planning-library" aria-labelledby="planning-library-title">
        <div className="planning-library-heading">
          <div>
            <h2 id="planning-library-title">Repeatable audit setup</h2>
            <p>
              Start from a tested matrix, save the current plan for reuse, or
              move a complete local audit between computers.
            </p>
          </div>
          <div className="audit-package-actions">
            <Button
              icon={UploadSimple}
              disabled={Boolean(packageBusy)}
              onClick={() => void runPackageAction("import")}
            >
              {packageBusy === "import" ? "Importing" : "Import package"}
            </Button>
            <Button
              icon={DownloadSimple}
              disabled={Boolean(packageBusy)}
              onClick={() => void runPackageAction("export")}
            >
              {packageBusy === "export" ? "Exporting" : "Export package"}
            </Button>
          </div>
        </div>
        <div className="template-controls">
          <Field label="Audit template">
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
            >
              <optgroup label="Built in">
                {BUILT_IN_AUDIT_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
              {personalTemplates.length ? (
                <optgroup label="Personal">
                  {personalTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </Field>
          <div className="template-selected-copy">
            <strong>
              {templates.find((template) => template.id === selectedTemplateId)?.name}
            </strong>
            <span>
              {templates.find((template) => template.id === selectedTemplateId)?.description}
            </span>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              const template = templates.find(
                (item) => item.id === selectedTemplateId,
              );
              if (template) setPendingTemplate(template);
            }}
          >
            Apply template
          </Button>
          {selectedTemplateId.startsWith("personal-") ? (
            <button
              className="row-action"
              aria-label="Delete selected personal template"
              onClick={() => {
                const template = personalTemplates.find(
                  (item) => item.id === selectedTemplateId,
                );
                if (template) setTemplateToDelete(template);
              }}
            >
              <Trash size={16} />
            </button>
          ) : null}
        </div>
        <form className="template-save" onSubmit={(event) => void savePersonalTemplate(event)}>
          <Field label="Save current setup as a personal template">
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Product release audit"
              maxLength={80}
            />
          </Field>
          <Button type="submit" icon={FloppyDisk} disabled={!templateName.trim()}>
            Save setup
          </Button>
        </form>
      </section>
      <section className="plan-status" aria-labelledby="plan-status-title">
        <div className="plan-status-icon">
          {readiness.ready ? (
            <CheckCircle size={24} weight="fill" />
          ) : (
            <ClipboardText size={24} weight="duotone" />
          )}
        </div>
        <div className="plan-status-copy">
          <span className="section-label">Next required action</span>
          <h2 id="plan-status-title">{nextAction}</h2>
          <p>
            {readiness.ready
              ? `${plan.complete} planning fields, ${items.length} sample items, and ${testRuns.length} guided test runs are prepared.`
              : `${plan.complete} of ${plan.total} planning fields are complete. ${items.length} representative sample items are defined.`}
          </p>
          {readiness.ready && readiness.warnings.length ? (
            <small className="plan-status-warning">Before each test: {readiness.warnings[0]}</small>
          ) : null}
        </div>
        <div className="plan-status-progress" aria-label="Audit plan readiness">
          <div>
            <span>Evaluation context</span>
            <strong>{plan.percent}%</strong>
          </div>
          <progress value={plan.complete} max={plan.total}>{plan.percent}%</progress>
          <div>
            <span>Sample locations</span>
            <strong>{readiness.sampleDefinitionPercent}%</strong>
          </div>
          <progress value={readiness.definedSampleItems} max={Math.max(1, items.length)}>{readiness.sampleDefinitionPercent}%</progress>
        </div>
        <Button
          icon={ArrowRight}
          disabled={!readiness.ready}
          onClick={() => onNavigate("inspect")}
        >
          Start inspection
        </Button>
      </section>

      <section className="settings-section plan-fields-section">
        <div className="settings-intro">
          <h2>Evaluation context</h2>
          <p>
            Define what the audit covers, how it will be tested, and which
            limitations report readers must understand.
          </p>
          <div
            className="plan-readiness"
            aria-label={`${plan.complete} of ${plan.total} audit plan fields complete`}
          >
            <div>
              <strong>{plan.complete} of {plan.total} ready</strong>
              <span>{plan.percent}%</span>
            </div>
            <progress value={plan.complete} max={plan.total}>{plan.percent}%</progress>
            {plan.missing.length ? (
              <small>Still needed: {plan.missing.join(", ")}</small>
            ) : (
              <small>Core evaluation context is complete.</small>
            )}
          </div>
        </div>
        <div className="settings-form audit-plan-form">
          <Field label="Project name">
            <input
              value={audit.project}
              onChange={(event) => patchAudit({ project: event.target.value })}
            />
          </Field>
          <Field label="Target URL or application">
            <input
              value={audit.target}
              onChange={(event) => patchAudit({ target: event.target.value })}
              placeholder="https://example.com or Product app"
            />
          </Field>
          <Field label="Evaluation start date">
            <input
              type="date"
              value={audit.startedAt}
              onChange={(event) => patchAudit({ startedAt: event.target.value })}
            />
          </Field>
          <Field
            label="Evaluation goal"
            hint="Why this audit is being performed and what decision it supports."
          >
            <textarea
              value={audit.goal}
              onChange={(event) => patchAudit({ goal: event.target.value })}
              placeholder="Verify the checkout release before production and identify remediation priorities."
            />
          </Field>
          <div className="field-stack">
            <Field label="Conformance target">
              <select
                value={audit.standard}
                onChange={(event) =>
                  patchAudit({
                    standard: event.target.value as AuditProject["standard"],
                  })
                }
              >
                <option>WCAG 2.2 A</option>
                <option>WCAG 2.2 AA</option>
              </select>
            </Field>
            <Field label="Auditor">
              <input
                value={audit.auditor}
                onChange={(event) => patchAudit({ auditor: event.target.value })}
                placeholder="Name or team"
              />
            </Field>
          </div>
          <Field
            label="Included scope"
            hint="Pages, states, components, and user journeys included in the evaluation."
          >
            <textarea
              value={audit.scope}
              onChange={(event) => patchAudit({ scope: event.target.value })}
              placeholder="Account creation, sign in, product search, cart, and checkout through order confirmation."
            />
          </Field>
          <Field
            label="Sampling rationale"
            hint="Explain why the structured sample below represents the evaluated product."
          >
            <textarea
              value={audit.sample}
              onChange={(event) => patchAudit({ sample: event.target.value })}
              placeholder="The sample covers every shared template, critical task, error state, and repeated component."
            />
          </Field>
          <Field
            label="Excluded scope"
            hint="Record known exclusions so report readers do not assume they were tested."
          >
            <textarea
              value={audit.excludedScope}
              onChange={(event) => patchAudit({ excludedScope: event.target.value })}
              placeholder="Third-party payment iframe and archived marketing pages."
            />
          </Field>
          <Field label="Browser, device, and operating-system matrix">
            <textarea
              value={audit.environment}
              onChange={(event) => patchAudit({ environment: event.target.value })}
              placeholder="Chrome / Windows 11; Safari / macOS; iOS Safari at 320 px and 200% zoom."
            />
          </Field>
          <Field label="Assistive-technology coverage">
            <textarea
              value={audit.assistiveTechnology}
              onChange={(event) => patchAudit({ assistiveTechnology: event.target.value })}
              placeholder="NVDA with Chrome, VoiceOver with Safari, keyboard-only, Windows High Contrast."
            />
          </Field>
          <Field
            label="Evaluation methodology"
            hint="Document the approach, tooling, limitations, and whether users with disabilities participated."
          >
            <textarea
              value={audit.methodology}
              onChange={(event) => patchAudit({ methodology: event.target.value })}
              placeholder="Manual WCAG review supported by automated checks, keyboard testing, and screen-reader verification."
            />
          </Field>
        </div>
      </section>

      <section className="sample-section" aria-labelledby="sample-title">
        <div className="sample-heading">
          <div>
            <h2 id="sample-title">Representative sample</h2>
            <p>
              Track the exact pages, flows, components, documents, and states
              selected for evaluation.
            </p>
          </div>
          <div className="sample-totals" aria-label="Sample status">
            <span><strong>{sample.complete}</strong> tested</span>
            <span><strong>{sample.remaining}</strong> remaining</span>
            {sample.blocked ? <span className="sample-blocked"><strong>{sample.blocked}</strong> blocked</span> : null}
          </div>
        </div>

        <form className="sample-add" onSubmit={(event) => void addSample(event)}>
          <Field label="Type">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as AuditSampleItem["kind"])}
            >
              {(Object.keys(SAMPLE_KIND_LABELS) as AuditSampleItem["kind"][]).map((value) => (
                <option key={value} value={value}>{SAMPLE_KIND_LABELS[value]}</option>
              ))}
            </select>
          </Field>
          <Field label="Sample item">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Checkout payment error"
            />
          </Field>
          <Field label="URL or location">
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="/checkout or Payment dialog"
            />
          </Field>
          <Button type="submit" variant="primary" icon={Plus} disabled={!label.trim()}>
            Add to sample
          </Button>
        </form>

        {items.length ? (
          <div className="sample-list" role="list" aria-label="Representative sample items">
            {items.map((item) => (
              <article className="sample-row" role="listitem" key={item.id}>
                <div className="sample-kind">
                  <span>{SAMPLE_KIND_LABELS[item.kind]}</span>
                </div>
                <div className="sample-identity">
                  <strong>{item.label}</strong>
                  <input
                    value={item.location}
                    onChange={(event) => patchItem(item.id, { location: event.target.value })}
                    aria-label={`Location for ${item.label}`}
                    placeholder="Add URL or location"
                  />
                </div>
                <select
                  value={item.status}
                  onChange={(event) =>
                    patchItem(item.id, {
                      status: event.target.value as AuditSampleItem["status"],
                    })
                  }
                  aria-label={`Status for ${item.label}`}
                >
                  {(Object.keys(SAMPLE_STATUS_LABELS) as AuditSampleItem["status"][]).map((value) => (
                    <option key={value} value={value}>{SAMPLE_STATUS_LABELS[value]}</option>
                  ))}
                </select>
                <input
                  className="sample-notes"
                  value={item.notes}
                  onChange={(event) => patchItem(item.id, { notes: event.target.value })}
                  aria-label={`Notes for ${item.label}`}
                  placeholder="Coverage note or blocker"
                />
                <button
                  className="row-action"
                  aria-label={`Remove ${item.label} from the sample`}
                  onClick={() => setItemToDelete(item)}
                >
                  <Trash size={16} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="sample-empty">
            <WarningCircle size={21} weight="duotone" />
            <div>
              <strong>No structured sample yet</strong>
              <p>Add the critical tasks and representative interface types that will be tested.</p>
            </div>
          </div>
        )}
      </section>

      <AuditCoverageMap
        coverage={coverage}
        onOpenSession={onStartGuidedSession}
        onNavigate={onNavigate}
        onOpenFindings={onOpenFindings}
      />

      <section className="test-script-section" aria-labelledby="test-script-title">
        <div className="sample-heading">
          <div>
            <h2 id="test-script-title">Guided test runs</h2>
            <p>
              Reuse consistent task scripts and keep an observation beside
              every completed step.
            </p>
          </div>
          <div className="sample-totals" aria-label="Test run status">
            <span><strong>{testRuns.filter(auditTestRunComplete).length}</strong> complete</span>
            <span><strong>{testRuns.filter((run) => !auditTestRunComplete(run)).length}</strong> remaining</span>
          </div>
        </div>
        <div className="test-script-add">
          <Field label="Reusable test script">
            <select
              value={selectedScriptId}
              onChange={(event) => setSelectedScriptId(event.target.value)}
            >
              {AUDIT_TEST_SCRIPTS.map((script) => (
                <option key={script.id} value={script.id}>
                  {script.title}
                </option>
              ))}
            </select>
          </Field>
          <p>
            {AUDIT_TEST_SCRIPTS.find((script) => script.id === selectedScriptId)?.description}
          </p>
          <Button icon={Plus} onClick={() => void addTestScript()}>
            Add test run
          </Button>
        </div>
        {testRuns.length ? (
          <div className="test-run-list">
            {testRuns.map((run) => {
              const completedSteps = run.steps.filter(
                (step) => step.complete && step.observation.trim(),
              ).length;
              return (
                <details className="test-run" key={run.id}>
                  <summary>
                    <span>
                      <strong>{run.title}</strong>
                      <small>{completedSteps} of {run.steps.length} steps recorded</small>
                    </span>
                    <span className={`test-run-status test-run-${run.status}`}>
                      {run.status.replaceAll("-", " ")}
                    </span>
                  </summary>
                  <div className="test-run-body">
                    <div className="test-run-controls">
                      <Field label={`Status for ${run.title}`}>
                        <select
                          value={run.status}
                          onChange={(event) =>
                            patchTestRun(run.id, {
                              status: event.target.value as AuditTestRun["status"],
                            })
                          }
                        >
                          <option value="planned">Planned</option>
                          <option value="in-progress">In progress</option>
                          <option value="complete">Complete</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </Field>
                      <button
                        className="text-action danger-action"
                        onClick={() => setTestRunToDelete(run)}
                      >
                        Remove test run
                      </button>
                    </div>
                    <ol className="test-step-list">
                      {run.steps.map((step) => (
                        <li key={step.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={step.complete}
                              onChange={(event) =>
                                patchTestRun(run.id, {
                                  steps: run.steps.map((item) =>
                                    item.id === step.id
                                      ? { ...item, complete: event.target.checked }
                                      : item,
                                  ),
                                })
                              }
                            />
                            <span>{step.label}</span>
                          </label>
                          <input
                            value={step.observation}
                            onChange={(event) =>
                              patchTestRun(run.id, {
                                steps: run.steps.map((item) =>
                                  item.id === step.id
                                    ? { ...item, observation: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            aria-label={`Observation for ${step.label}`}
                            placeholder="Observation, environment, or evidence reference"
                          />
                        </li>
                      ))}
                    </ol>
                    <Field label="Test run notes">
                      <textarea
                        rows={3}
                        value={run.notes}
                        onChange={(event) =>
                          patchTestRun(run.id, { notes: event.target.value })
                        }
                        placeholder="Record blockers, deviations, or coverage limitations."
                      />
                    </Field>
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div className="sample-empty">
            <ClipboardText size={21} weight="duotone" />
            <div>
              <strong>No guided test runs yet</strong>
              <p>Add the scripts that match the tasks and content in this audit.</p>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title={`Remove ${itemToDelete?.label || "sample item"}?`}
        description="This removes the item from the evaluation sample. It does not delete captures or findings."
        confirmLabel="Remove item"
        onCancel={() => setItemToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
      <ConfirmDialog
        open={Boolean(pendingTemplate)}
        title={`Apply ${pendingTemplate?.name || "audit template"}?`}
        description="This replaces the current evaluation context, representative sample, and guided test runs, and resets any final conclusion to in progress. The project name, target, captures, findings, and checklist decisions stay unchanged."
        confirmLabel="Apply template"
        onCancel={() => setPendingTemplate(null)}
        onConfirm={() => void applyTemplate()}
      />
      <ConfirmDialog
        open={Boolean(pendingRecommendation)}
        title={`Use ${pendingRecommendation?.template.name || "the recommended scope"}?`}
        description={`This replaces the current evaluation context, representative sample, and guided test runs with the scoper's ${pendingRecommendation?.sampleItems.length ?? 0}-item sample and ${pendingRecommendation?.testScriptIds.length ?? 0}-run test matrix, and resets any final conclusion to in progress. The project name, target, auditor, captures, findings, and checklist decisions stay unchanged.`}
        confirmLabel="Use recommended scope"
        onCancel={() => setPendingRecommendation(null)}
        onConfirm={() => void applyRecommendation()}
      />
      <ConfirmDialog
        open={Boolean(templateToDelete)}
        title={`Delete ${templateToDelete?.name || "personal template"}?`}
        description="Existing audits created from this template are not changed."
        confirmLabel="Delete template"
        onCancel={() => setTemplateToDelete(null)}
        onConfirm={() => void deletePersonalTemplate()}
      />
      <ConfirmDialog
        open={Boolean(testRunToDelete)}
        title={`Remove ${testRunToDelete?.title || "test run"}?`}
        description="This removes the recorded steps and observations from this audit."
        confirmLabel="Remove test run"
        onCancel={() => setTestRunToDelete(null)}
        onConfirm={() => void deleteTestRun()}
      />
    </div>
  );
}
