import { describe, expect, it } from "vitest";
import { auditPlanProgress, auditStartReadiness } from "./audit-plan";
import { BUILT_IN_AUDIT_TEMPLATES, createTestRun, AUDIT_TEST_SCRIPTS } from "./audit-templates";
import type { Finding, FindingTicketLink } from "../shared/desktop";
import {
  DEFAULT_TICKET_FIELD_MAPPINGS,
  auditStoreKey,
  createAuditProject,
  localDateInputValue,
  mapFindingToTicketFields,
  normalizeAuditProject,
  resolveTicketConflict,
  reviewTicketSync,
  ticketFieldValuesFromFinding,
} from "./audits";

function ticketFinding(patch: Partial<Finding> = {}): Finding {
  return {
    key: "finding-1",
    title: "Checkout button has no accessible name",
    wcag: "4.1.2",
    severity: "blocker",
    status: "open",
    note: "The control is announced only as button.",
    description: "The checkout control has no accessible name.",
    actualResult: "Screen readers announce only button.",
    expectedResult: "The control exposes its visible label as its accessible name.",
    userImpact: "Screen-reader users cannot identify the checkout action.",
    evidenceLink: "https://app.thewcag.com/s/evidence-1",
    owner: "Checkout team",
    dueDate: "2026-08-15",
    createdAt: 1_800_000_000_000,
    ...patch,
  };
}

describe("audit workspaces", () => {
  it("creates isolated, valid audit identifiers", () => {
    const first = createAuditProject(" Checkout release ");
    const second = createAuditProject("Checkout release");
    expect(first.project).toBe("Checkout release");
    expect(first.id).toMatch(/^aud-[a-z0-9-]{6,36}$/);
    expect(first.id).not.toBe(second.id);
    expect(auditStoreKey(first.id, "findings")).toBe(`findings-${first.id}`);
    expect(auditStoreKey(first.id, "sampleItems")).toBe(`sampleItems-${first.id}`);
  });

  it("rejects unsafe audit identifiers", () => {
    expect(() => auditStoreKey("../workspace", "reports")).toThrow();
  });

  it("normalizes older audits and reports plan readiness", () => {
    const legacy = createAuditProject("Legacy audit");
    const normalized = normalizeAuditProject({
      ...legacy,
      target: "https://example.com",
      goal: undefined,
      sample: undefined,
    } as unknown as typeof legacy);
    expect(normalized.goal).toBe("");
    expect(normalized.methodology).toContain("Manual WCAG review");
    expect(normalized.executiveSummary).toBe("");
    expect(normalized.limitations).toBe("");
    expect(normalized.conclusion).toBe("in-progress");
    expect(normalized.completedAt).toBe("");
    const readiness = auditPlanProgress(normalized);
    expect(readiness.total).toBe(7);
    expect(readiness.missing).toContain("Evaluation goal");
  });

  it("drops malformed locally stored scoper metadata", () => {
    const audit = createAuditProject("Stored audit");
    const normalized = normalizeAuditProject({
      ...audit,
      scopeProfile: {
        version: 1,
        targetType: "web-product",
        featureIds: ["forms", "forms"],
        templateId: "web-product-aa",
        confidence: "high",
        reasons: ["Duplicate feature identifiers are invalid."],
        confirmedAt: Date.now(),
      },
    });
    expect(normalized.scopeProfile).toBeUndefined();
  });

  it("uses the auditor's local calendar date instead of UTC", () => {
    expect(localDateInputValue(new Date(2026, 6, 22, 0, 30))).toBe("2026-07-22");
  });

  it("requires planning rather than completed testing before inspection", () => {
    const template = BUILT_IN_AUDIT_TEMPLATES.find((item) => item.id === "web-product-aa")!;
    const audit = {
      ...createAuditProject("Product audit"),
      target: "https://app.example.com",
      goal: template.goal,
      scope: template.scope,
      sample: template.sample,
      excludedScope: template.excludedScope,
      environment: template.environment,
      assistiveTechnology: template.assistiveTechnology,
      methodology: template.methodology,
      auditor: "Audit team",
    };
    const now = Date.now();
    const sampleItems = template.sampleItems.map((item, index) => ({
      ...item,
      id: `sample-${index}`,
      location: item.location || `https://app.example.com/sample-${index + 1}`,
      status: "planned" as const,
      createdAt: now,
      modifiedAt: now,
    }));
    const testRuns = [createTestRun(AUDIT_TEST_SCRIPTS[0])];
    const readiness = auditStartReadiness(audit, sampleItems, testRuns);
    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(testRuns[0].status).toBe("planned");
    expect(readiness.warnings).toContain(
      "The scope was entered manually and has not been confirmed through the built-in scoper.",
    );
  });

  it("blocks inspection when core context or a representative sample is missing", () => {
    const readiness = auditStartReadiness(createAuditProject(), [], []);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain("Complete target.");
    expect(readiness.blockers).toContain("Add at least one representative sample item.");
  });
});

describe("finding ticket connectors", () => {
  it("maps a finding into the tracker-neutral Jira field model without retyping", () => {
    const mapped = mapFindingToTicketFields(ticketFinding(), DEFAULT_TICKET_FIELD_MAPPINGS.jira);
    expect(mapped).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "title", target: "summary", value: "Checkout button has no accessible name" }),
      expect.objectContaining({ source: "actualResult", target: "description", value: "Screen readers announce only button." }),
      expect.objectContaining({ source: "wcagMapping", target: "labels", value: "4.1.2" }),
      expect.objectContaining({ source: "severity", target: "priority", value: "blocker" }),
      expect.objectContaining({ source: "evidenceLink", target: "description", value: "https://app.thewcag.com/s/evidence-1" }),
      expect.objectContaining({ source: "targetDate", target: "duedate", value: "2026-08-15" }),
    ]));
  });

  it("surfaces external field and status changes without applying them locally", () => {
    const finding = ticketFinding();
    const baseline = { fields: ticketFieldValuesFromFinding(finding), status: "To Do", fetchedAt: 100 };
    const link: FindingTicketLink = {
      connector: "jira",
      externalId: "A11Y-42",
      key: "A11Y-42",
      url: "https://example.atlassian.net/browse/A11Y-42",
      externalStatus: "To Do",
      syncState: "in-sync",
      baseline,
      conflicts: [],
      createdAt: 100,
      lastSyncedAt: 100,
    };
    const reviewed = reviewTicketSync(finding, link, {
      fields: { title: "Externally edited title", owner: "Platform team" },
      status: "Done",
      fetchedAt: 200,
    });
    expect(finding.title).toBe("Checkout button has no accessible name");
    expect(finding.owner).toBe("Checkout team");
    expect(finding.status).toBe("open");
    expect(reviewed.syncState).toBe("review");
    expect(reviewed.conflicts.map((conflict) => conflict.field)).toEqual(["title", "owner", "status"]);
    expect(reviewed.externalStatus).toBe("Done");
  });

  it("marks two-sided edits as conflicts and applies external values only after an explicit decision", () => {
    const original = ticketFinding();
    const baseline = { fields: ticketFieldValuesFromFinding(original), status: "To Do", fetchedAt: 100 };
    const locallyEdited = ticketFinding({ owner: "Local audit owner" });
    const link = reviewTicketSync(locallyEdited, {
      connector: "linear",
      externalId: "issue-id",
      key: "A11Y-9",
      url: "https://linear.app/team/issue/A11Y-9",
      externalStatus: "To Do",
      syncState: "in-sync",
      baseline,
      conflicts: [],
      createdAt: 100,
      lastSyncedAt: 100,
    }, {
      fields: { owner: "External owner" },
      status: "In Progress",
      fetchedAt: 200,
    });
    const pending = { ...locallyEdited, ticketLink: link };
    expect(link.conflicts.find((conflict) => conflict.field === "owner")?.kind).toBe("diverged");
    const applied = resolveTicketConflict(pending, "owner", "use-external");
    expect(applied.owner).toBe("External owner");
    expect(applied.status).toBe("open");
    const kept = resolveTicketConflict(applied, "status", "keep-local");
    expect(kept.status).toBe("open");
    expect(kept.ticketLink?.syncState).toBe("in-sync");
  });
});
