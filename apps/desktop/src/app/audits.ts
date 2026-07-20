import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuditActivity,
  AuditBrief,
  AuditProject,
} from "../shared/desktop";
import { desktop, getStored, setStored } from "./api";

const AUDITS_KEY = "audits-v2";
const ACTIVE_AUDIT_KEY = "active-audit-v2";

export type AuditSection =
  | "findings"
  | "checklist"
  | "history"
  | "palette"
  | "activity"
  | "reports";
export type RecordAuditActivity = (
  activity: Omit<AuditActivity, "id" | "auditId" | "createdAt">,
) => Promise<void>;

const LEGACY_KEYS: Record<
  Exclude<AuditSection, "activity" | "reports">,
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
  activity: [],
  reports: [],
};

export function auditStoreKey(auditId: string, section: AuditSection): string {
  if (!/^aud-[a-z0-9-]{6,36}$/.test(auditId))
    throw new Error("Invalid audit identifier");
  return `${section}-${auditId}`;
}

export function createAuditProject(name = "Untitled audit"): AuditProject {
  const now = Date.now();
  return {
    id: `aud-${crypto.randomUUID().slice(0, 12)}`,
    project: name.trim().slice(0, 120) || "Untitled audit",
    target: "",
    scope: "",
    standard: "WCAG 2.2 AA",
    auditor: "",
    startedAt: new Date(now).toISOString().slice(0, 10),
    updatedAt: now,
    createdAt: now,
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
    desktop.invoke("capture:assign-unscoped", { auditId: audit.id }),
  ]);
  return { audits: [audit], activeId: audit.id };
}

async function loadAudits(): Promise<{
  audits: AuditProject[];
  activeId: string;
}> {
  const stored = await getStored<AuditProject[]>(AUDITS_KEY, []);
  const audits = stored.filter(
    (audit) => audit && /^aud-[a-z0-9-]{6,36}$/.test(audit.id),
  );
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

  useEffect(() => {
    let mounted = true;
    void loadAudits()
      .then((value) => {
        if (!mounted) return;
        setAudits(value.audits);
        setActiveId(value.activeId);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
      ]);
    },
    [audits],
  );

  const createAudit = useCallback((name?: string) => {
    const audit = createAuditProject(name);
    setAudits((current) => {
      const next = [audit, ...current];
      void setStored(AUDITS_KEY, next);
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
    ]);
    return audit;
  }, []);

  const updateAudit = useCallback(
    (patch: Partial<AuditProject>) => {
      if (!activeAudit) return;
      setAudits((current) => {
        const next = current.map((audit) =>
          audit.id === activeAudit.id
            ? { ...audit, ...patch, id: audit.id, updatedAt: Date.now() }
            : audit,
        );
        void setStored(AUDITS_KEY, next);
        return next;
      });
    },
    [activeAudit],
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
      void setStored(AUDITS_KEY, next);
      if (activeId === id) selectAudit(available[0].id);
      return true;
    },
    [activeId, audits, selectAudit],
  );

  const recordActivity = useCallback(
    async (activity: Omit<AuditActivity, "id" | "auditId" | "createdAt">) => {
      if (!activeAudit) return;
      const key = auditStoreKey(activeAudit.id, "activity");
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
    },
    [activeAudit],
  );

  return {
    activeAudit,
    activeId,
    archiveAudit,
    audits,
    createAudit,
    ready,
    recordActivity,
    selectAudit,
    updateAudit,
  };
}
