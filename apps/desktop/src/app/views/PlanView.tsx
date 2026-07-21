import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  DownloadSimple,
  FloppyDisk,
  Plus,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  AuditProject,
  AuditSampleItem,
  AuditTemplate,
  AuditTestRun,
  WorkspaceStage,
} from "../../shared/desktop";
import { getStored, setStored } from "../api";
import { auditPlanProgress } from "../audit-plan";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import { Button, ConfirmDialog, Field, Toast } from "../components";
import { messageFromError, useTransientMessage } from "../hooks";
import {
  AUDIT_TEST_SCRIPTS,
  BUILT_IN_AUDIT_TEMPLATES,
  createTestRun,
} from "../audit-templates";

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
}: {
  audit: AuditProject;
  onAuditChange: (patch: Partial<AuditProject>) => void;
  recordActivity: RecordAuditActivity;
  onNavigate: (stage: WorkspaceStage) => void;
  onExportPackage: () => Promise<void>;
  onImportPackage: () => Promise<void>;
}) {
  const [items, setItems] = useState<AuditSampleItem[]>([]);
  const [testRuns, setTestRuns] = useState<AuditTestRun[]>([]);
  const [personalTemplates, setPersonalTemplates] = useState<AuditTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(BUILT_IN_AUDIT_TEMPLATES[0].id);
  const [templateName, setTemplateName] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState(AUDIT_TEST_SCRIPTS[0].id);
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
    void Promise.all([
      getStored<AuditSampleItem[]>(sampleKey, []),
      getStored<AuditTestRun[]>(testRunsKey, []),
      getStored<AuditTemplate[]>(PERSONAL_TEMPLATES_KEY, []),
    ])
      .then(([nextItems, nextTestRuns, nextTemplates]) => {
        setItems(nextItems);
        setTestRuns(nextTestRuns);
        setPersonalTemplates(
          nextTemplates.filter((template) => template.source === "personal"),
        );
      })
      .catch((error) => show(messageFromError(error), true));
  }, [sampleKey, testRunsKey]);

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

  const nextAction = plan.missing.length
    ? `Complete ${plan.missing[0].toLowerCase()}`
    : !items.length
      ? "Add the first sample item"
      : sample.remaining
        ? `Test ${sample.remaining} remaining sample ${sample.remaining === 1 ? "item" : "items"}`
        : testRuns.some((run) => run.status !== "complete")
          ? `Complete ${testRuns.filter((run) => run.status !== "complete").length} guided test ${testRuns.filter((run) => run.status !== "complete").length === 1 ? "run" : "runs"}`
          : "Begin criterion review";

  function patchAudit(patch: Partial<AuditProject>) {
    onAuditChange(patch);
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

  async function applyTemplate() {
    if (!pendingTemplate) return;
    const now = Date.now();
    const nextItems: AuditSampleItem[] = pendingTemplate.sampleItems.map(
      (item) => ({
        ...item,
        id: crypto.randomUUID(),
        status: "planned",
        createdAt: now,
        modifiedAt: now,
      }),
    );
    const nextRuns = pendingTemplate.testScriptIds
      .map((id) => AUDIT_TEST_SCRIPTS.find((script) => script.id === id))
      .filter((script): script is NonNullable<typeof script> => Boolean(script))
      .map(createTestRun);
    try {
      onAuditChange({
        goal: pendingTemplate.goal,
        scope: pendingTemplate.scope,
        sample: pendingTemplate.sample,
        excludedScope: pendingTemplate.excludedScope,
        environment: pendingTemplate.environment,
        assistiveTechnology: pendingTemplate.assistiveTechnology,
        methodology: pendingTemplate.methodology,
        standard: pendingTemplate.standard,
      });
      await Promise.all([
        persistSample(nextItems),
        persistTestRuns(nextRuns),
        recordActivity({
          kind: "updated",
          title: "Audit template applied",
          detail: pendingTemplate.name,
        }),
      ]);
      setItems(nextItems);
      setTestRuns(nextRuns);
      setPendingTemplate(null);
      show(`${pendingTemplate.name} applied`);
    } catch (error) {
      show(messageFromError(error), true);
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
    setTestRuns((current) => {
      const next = current.map((run) => {
        if (run.id !== id) return run;
        const updated = { ...run, ...patch, modifiedAt: Date.now() };
        if (patch.steps && updated.status !== "blocked") {
          const complete = patch.steps.every((step) => step.complete);
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

  return (
    <div className="audit-plan-view">
      <Toast message={message} />
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
          {plan.complete === plan.total && items.length && !sample.remaining ? (
            <CheckCircle size={24} weight="fill" />
          ) : (
            <ClipboardText size={24} weight="duotone" />
          )}
        </div>
        <div className="plan-status-copy">
          <span className="section-label">Next required action</span>
          <h2 id="plan-status-title">{nextAction}</h2>
          <p>
            {plan.complete} of {plan.total} planning fields are complete. {sample.complete} of {items.length} representative sample items are tested.
          </p>
        </div>
        <div className="plan-status-progress" aria-label="Audit plan readiness">
          <div>
            <span>Evaluation context</span>
            <strong>{plan.percent}%</strong>
          </div>
          <progress value={plan.complete} max={plan.total}>{plan.percent}%</progress>
          <div>
            <span>Sample coverage</span>
            <strong>{sample.percent}%</strong>
          </div>
          <progress value={sample.complete} max={Math.max(1, items.length)}>{sample.percent}%</progress>
        </div>
        <Button icon={ArrowRight} onClick={() => onNavigate("inspect")}>
          Continue to inspection
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
            <span><strong>{testRuns.filter((run) => run.status === "complete").length}</strong> complete</span>
            <span><strong>{testRuns.filter((run) => run.status !== "complete").length}</strong> remaining</span>
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
              const completedSteps = run.steps.filter((step) => step.complete).length;
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
        description="This replaces the current evaluation context, representative sample, and guided test runs. The project name, target, captures, findings, and checklist decisions stay unchanged."
        confirmLabel="Apply template"
        onCancel={() => setPendingTemplate(null)}
        onConfirm={() => void applyTemplate()}
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
