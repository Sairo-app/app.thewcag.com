import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AuditActivity,
  AuditBrief,
  AuditProject,
  AuditScopeFeature,
  AuditScopeProfile,
  AuditTargetType,
} from "../shared/desktop";
import { desktop, getStored, setStored } from "./api";

const AUDITS_KEY = "audits-v2";
const ACTIVE_AUDIT_KEY = "active-audit-v2";
const TARGET_TYPES = new Set<AuditTargetType>([
  "content-site",
  "web-product",
  "commerce-service",
  "release-regression",
  "desktop-product",
  "mobile-product",
  "document-set",
  "component-library",
]);
const SCOPE_FEATURES = new Set<AuditScopeFeature>([
  "authentication",
  "checkout",
  "forms",
  "media",
  "documents",
  "components",
]);

export type AuditSection =
  | "findings"
  | "checklist"
  | "history"
  | "palette"
  | "sampleItems"
  | "testRuns"
  | "findingViews"
  | "activity"
  | "reports";
export type RecordAuditActivity = (
  activity: Omit<AuditActivity, "id" | "auditId" | "createdAt">,
) => Promise<void>;

const LEGACY_KEYS: Record<
  Exclude<AuditSection, "activity" | "reports" | "sampleItems" | "testRuns" | "findingViews">,
  string
> = {
  findings: "findings",
  checklist: "checklist-default",
  history: "contrast-history-v2",
  palette: "palette-colors",
};

const SECTION_DEFAULTS: Record<AuditSection, unknown> = {
  findings: [],
  checklist: {},
  history: [],
  palette: ["#1F2933", "#FFF9ED", "#D9480F", "#28745D"],
  sampleItems: [],
  testRuns: [],
  findingViews: [],
  activity: [],
  reports: [],
};

export function auditStoreKey(auditId: string, section: AuditSection): string {
  if (!/^aud-[a-z0-9-]{6,36}$/.test(auditId))
    throw new Error("Invalid audit identifier");
  return `${section}-${auditId}`;
}

export function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createAuditProject(name = "Untitled audit"): AuditProject {
  const now = Date.now();
  return {
    id: `aud-${crypto.randomUUID().slice(0, 12)}`,
    project: name.trim().slice(0, 120) || "Untitled audit",
    target: "",
    goal: "",
    scope: "",
    sample: "",
    excludedScope: "",
    environment: "",
    assistiveTechnology: "",
    methodology:
      "Manual WCAG review supported by deterministic tools and assistive technology testing.",
    executiveSummary: "",
    limitations: "",
    conclusion: "in-progress",
    completedAt: "",
    standard: "WCAG 2.2 AA",
    auditor: "",
    startedAt: localDateInputValue(new Date(now)),
    updatedAt: now,
    createdAt: now,
  };
}

function normalizeScopeProfile(value: unknown): AuditScopeProfile | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const profile = value as Partial<AuditScopeProfile>;
  if (
    profile.version !== 1 ||
    !profile.targetType ||
    !TARGET_TYPES.has(profile.targetType) ||
    typeof profile.templateId !== "string" ||
    !profile.templateId.trim() ||
    profile.templateId.length > 120 ||
    !["high", "medium", "low"].includes(profile.confidence ?? "") ||
    !Array.isArray(profile.featureIds) ||
    profile.featureIds.length > SCOPE_FEATURES.size ||
    new Set(profile.featureIds).size !== profile.featureIds.length ||
    profile.featureIds.some((feature) => !SCOPE_FEATURES.has(feature)) ||
    !Array.isArray(profile.reasons) ||
    profile.reasons.length > 12 ||
    profile.reasons.some(
      (reason) =>
        typeof reason !== "string" ||
        !reason.trim() ||
        reason.length > 500,
    ) ||
    typeof profile.confirmedAt !== "number" ||
    !Number.isFinite(profile.confirmedAt)
  ) return undefined;
  return {
    version: 1,
    targetType: profile.targetType,
    featureIds: [...profile.featureIds],
    templateId: profile.templateId.trim(),
    confidence: profile.confidence as AuditScopeProfile["confidence"],
    reasons: [...profile.reasons],
    confirmedAt: profile.confirmedAt,
  };
}

export function normalizeAuditProject(audit: AuditProject): AuditProject {
  const defaults = createAuditProject(audit.project);
  return {
    ...defaults,
    ...audit,
    id: audit.id,
    createdAt: audit.createdAt,
    goal: audit.goal ?? "",
    sample: audit.sample ?? "",
    excludedScope: audit.excludedScope ?? "",
    environment: audit.environment ?? "",
    assistiveTechnology: audit.assistiveTechnology ?? "",
    methodology: audit.methodology ?? defaults.methodology,
    executiveSummary: audit.executiveSummary ?? "",
    limitations: audit.limitations ?? "",
    conclusion: audit.conclusion ?? "in-progress",
    completedAt: audit.completedAt ?? "",
    scopeProfile: normalizeScopeProfile(audit.scopeProfile),
  };
}

async function migrateLegacyAudit(): Promise<{
  audits: AuditProject[];
  activeId: string;
}> {
  const legacy = await getStored<AuditBrief | null>("audit-brief", null);
  const audit = { ...createAuditProject(legacy?.project), ...(legacy ?? {}) };
  await Promise.all(
    (Object.keys(LEGACY_KEYS) as Array<keyof typeof LEGACY_KEYS>).map(
      async (section) => {
        const value = await getStored(
          LEGACY_KEYS[section],
          SECTION_DEFAULTS[section],
        );
        await setStored(auditStoreKey(audit.id, section), value);
      },
    ),
  );
  const activity: AuditActivity[] = [
    {
      id: crypto.randomUUID(),
      auditId: audit.id,
      kind: "created",
      title: legacy ? "Existing workspace migrated" : "Audit created",
      detail:
        "Captures, findings, and review progress now stay isolated in this audit.",
      createdAt: Date.now(),
    },
  ];
  await Promise.all([
    setStored(AUDITS_KEY, [audit]),
    setStored(ACTIVE_AUDIT_KEY, audit.id),
    setStored(auditStoreKey(audit.id, "activity"), activity),
    setStored(auditStoreKey(audit.id, "reports"), []),
    setStored(auditStoreKey(audit.id, "sampleItems"), []),
    setStored(auditStoreKey(audit.id, "testRuns"), []),
    setStored(auditStoreKey(audit.id, "findingViews"), []),
    desktop.invoke("capture:assign-unscoped", { auditId: audit.id }),
  ]);
  return { audits: [audit], activeId: audit.id };
}

async function loadAudits(): Promise<{
  audits: AuditProject[];
  activeId: string;
}> {
  const stored = await getStored<AuditProject[]>(AUDITS_KEY, []);
  const audits = stored
    .filter((audit) => audit && /^aud-[a-z0-9-]{6,36}$/.test(audit.id))
    .map(normalizeAuditProject);
  if (!audits.length) return migrateLegacyAudit();
  const requested = await getStored<string>(ACTIVE_AUDIT_KEY, audits[0].id);
  const activeId = audits.some(
    (audit) => audit.id === requested && !audit.archivedAt,
  )
    ? requested
    : (audits.find((audit) => !audit.archivedAt)?.id ?? audits[0].id);
  await desktop.invoke("audit:activate", { auditId: activeId });
  return { audits, activeId };
}

export function useAuditWorkspace() {
  const [audits, setAudits] = useState<AuditProject[]>([]);
  const [activeId, setActiveId] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const auditsWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const activityWriteQueue = useRef<Promise<void>>(Promise.resolve());

  const reportError = useCallback((value: unknown) => {
    const message = value instanceof Error ? value.message : String(value ?? "");
    setError(message.trim() || "The audit workspace could not be saved.");
  }, []);

  const persistAudits = useCallback((next: AuditProject[]) => {
    const request = auditsWriteQueue.current.then(() =>
      setStored(AUDITS_KEY, next),
    );
    auditsWriteQueue.current = request.catch(() => undefined);
    void request.catch(reportError);
    return request;
  }, [reportError]);

  useEffect(() => {
    let mounted = true;
    setReady(false);
    setError("");
    void loadAudits()
      .then((value) => {
        if (!mounted) return;
        setAudits(value.audits);
        setActiveId(value.activeId);
      })
      .catch((loadError) => {
        if (mounted) reportError(loadError);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [loadVersion, reportError]);

  const activeAudit = useMemo(
    () => audits.find((audit) => audit.id === activeId) ?? audits[0] ?? null,
    [activeId, audits],
  );

  const selectAudit = useCallback(
    (id: string) => {
      if (!audits.some((audit) => audit.id === id && !audit.archivedAt)) return;
      setActiveId(id);
      void Promise.all([
        setStored(ACTIVE_AUDIT_KEY, id),
        desktop.invoke("audit:activate", { auditId: id }),
      ]).catch(reportError);
    },
    [audits, reportError],
  );

  const createAudit = useCallback((name?: string) => {
    const audit = createAuditProject(name);
    setAudits((current) => {
      const next = [audit, ...current];
      void persistAudits(next);
      return next;
    });
    setActiveId(audit.id);
    void Promise.all([
      setStored(ACTIVE_AUDIT_KEY, audit.id),
      setStored(auditStoreKey(audit.id, "activity"), [
        {
          id: crypto.randomUUID(),
          auditId: audit.id,
          kind: "created",
          title: "Audit created",
          createdAt: Date.now(),
        } satisfies AuditActivity,
      ]),
      desktop.invoke("audit:activate", { auditId: audit.id }),
    ]).catch(reportError);
    return audit;
  }, [persistAudits, reportError]);

  const importAudit = useCallback((source: AuditProject) => {
    const created = createAuditProject(source.project);
    const audit: AuditProject = normalizeAuditProject({
      ...created,
      project: source.project.trim().slice(0, 120) || "Imported audit",
      target: source.target,
      goal: source.goal,
      scope: source.scope,
      sample: source.sample,
      excludedScope: source.excludedScope,
      environment: source.environment,
      assistiveTechnology: source.assistiveTechnology,
      methodology: source.methodology,
      executiveSummary: source.executiveSummary,
      limitations: source.limitations,
      conclusion: source.conclusion,
      completedAt: source.completedAt,
      standard: source.standard,
      auditor: source.auditor,
      startedAt: source.startedAt,
      scopeProfile: source.scopeProfile,
    });
    setAudits((current) => {
      const next = [audit, ...current];
      void persistAudits(next);
      return next;
    });
    setActiveId(audit.id);
    void Promise.all([
      setStored(ACTIVE_AUDIT_KEY, audit.id),
      desktop.invoke("audit:activate", { auditId: audit.id }),
    ]).catch(reportError);
    return audit;
  }, [persistAudits, reportError]);

  const updateAudit = useCallback(
    (patch: Partial<AuditProject>) => {
      if (!activeAudit) return;
      setAudits((current) => {
        const next = current.map((audit) =>
          audit.id === activeAudit.id
            ? { ...audit, ...patch, id: audit.id, updatedAt: Date.now() }
            : audit,
        );
        void persistAudits(next);
        return next;
      });
    },
    [activeAudit, persistAudits],
  );

  const archiveAudit = useCallback(
    (id: string) => {
      const available = audits.filter(
        (audit) => audit.id !== id && !audit.archivedAt,
      );
      if (!available.length) return false;
      const next = audits.map((audit) =>
        audit.id === id
          ? { ...audit, archivedAt: Date.now(), updatedAt: Date.now() }
          : audit,
      );
      setAudits(next);
      void persistAudits(next);
      if (activeId === id) selectAudit(available[0].id);
      return true;
    },
    [activeId, audits, persistAudits, selectAudit],
  );

  const restoreAudit = useCallback(
    (id: string) => {
      if (!audits.some((audit) => audit.id === id && audit.archivedAt)) return false;
      const next = audits.map((audit) =>
        audit.id === id
          ? { ...audit, archivedAt: undefined, updatedAt: Date.now() }
          : audit,
      );
      setAudits(next);
      setActiveId(id);
      void Promise.all([
        persistAudits(next),
        setStored(ACTIVE_AUDIT_KEY, id),
        desktop.invoke("audit:activate", { auditId: id }),
      ]).catch(reportError);
      return true;
    },
    [audits, persistAudits, reportError],
  );

  const discardAudit = useCallback(
    (id: string) => {
      const fallback = audits.find(
        (audit) => audit.id !== id && !audit.archivedAt,
      );
      if (!fallback) return false;
      const next = audits.filter((audit) => audit.id !== id);
      setAudits(next);
      void persistAudits(next);
      if (activeId === id) selectAudit(fallback.id);
      return true;
    },
    [activeId, audits, persistAudits, selectAudit],
  );

  const recordActivity = useCallback(
    async (activity: Omit<AuditActivity, "id" | "auditId" | "createdAt">) => {
      if (!activeAudit) return;
      const key = auditStoreKey(activeAudit.id, "activity");
      const request = activityWriteQueue.current.then(async () => {
        const current = await getStored<AuditActivity[]>(key, []);
        const next: AuditActivity[] = [
          {
            ...activity,
            id: crypto.randomUUID(),
            auditId: activeAudit.id,
            createdAt: Date.now(),
          },
          ...current,
        ].slice(0, 120);
        await setStored(key, next);
      });
      activityWriteQueue.current = request.catch(() => undefined);
      await request;
    },
    [activeAudit],
  );

  return {
    activeAudit,
    activeId,
    archiveAudit,
    audits,
    error,
    createAudit,
    discardAudit,
    importAudit,
    ready,
    recordActivity,
    restoreAudit,
    retryLoad: () => setLoadVersion((value) => value + 1),
    selectAudit,
    updateAudit,
  };
}
