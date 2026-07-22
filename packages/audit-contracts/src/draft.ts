import {
  AI_DRAFT_SCHEMA_VERSION,
  type AffectedUser,
  type AiFindingDraftV1,
  type DeterministicCheckV1,
  type EvidencePacketV1,
  type FindingSeverity,
  type WcagMappingV1,
} from "./types";
import { parseAiFindingDraft } from "./validation";
import { WCAG_BY_ID } from "./wcag";

function sentence(value: string, fallback: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return (clean.match(/^.*?[.!?](?:\s|$)/)?.[0] || clean)
    .slice(0, 240)
    .replace(/[.!?]+$/, "");
}

function affectedUsersFor(checks: DeterministicCheckV1[]): AffectedUser[] {
  const users = new Set<AffectedUser>();
  if (checks.some((check) => check.id === "interactive-name" || check.id === "image-alternative")) {
    users.add("screen-reader");
    users.add("voice-control");
  }
  if (checks.some((check) => check.id === "custom-control-keyboard" || check.id === "positive-tabindex")) {
    users.add("keyboard");
    users.add("motor");
  }
  if (checks.some((check) => check.id === "target-size")) {
    users.add("motor");
    users.add("low-vision");
  }
  if (!users.size) users.add("other");
  return [...users];
}

function severityFor(checks: DeterministicCheckV1[]): FindingSeverity {
  if (checks.some((check) => check.impact === "blocker")) return "blocker";
  if (checks.some((check) => check.impact === "major")) return "major";
  return "minor";
}

function mappingsFor(checks: DeterministicCheckV1[]): WcagMappingV1[] {
  const criteria = new Map<string, DeterministicCheckV1>();
  for (const check of checks) {
    for (const criterion of check.wcag) {
      if (WCAG_BY_ID.has(criterion) && !criteria.has(criterion)) criteria.set(criterion, check);
    }
  }
  return [...criteria].map(([criterion, check]) => {
    const official = WCAG_BY_ID.get(criterion)!;
    return {
      criterion,
      level: official.level,
      name: official.name,
      rationale: check.description,
      confidence: check.outcome === "fail" ? "high" : "medium",
    };
  });
}

/**
 * Produces a bounded, explicitly unconfirmed intake draft when AI authoring is
 * unavailable. The output is suitable for a review queue, never delivery.
 */
export function createLocalFindingDraft(
  evidence: EvidencePacketV1,
  generatedAt = Date.now(),
): AiFindingDraftV1 {
  const primary = evidence.checks.find((check) => check.outcome === "fail") ?? evidence.checks[0];
  const role = evidence.target.role || evidence.target.tagName || "element";
  const observed = sentence(evidence.observation, primary?.title || `Review the selected ${role}`);
  const mappings = mappingsFor(evidence.checks);
  return parseAiFindingDraft({
    schemaVersion: AI_DRAFT_SCHEMA_VERSION,
    title: primary?.title || observed,
    description: evidence.observation.trim() || `The selected ${role} requires accessibility review.`,
    actualResult: evidence.observation.trim() || primary?.description || `The selected ${role} does not provide the expected accessible behavior.`,
    expectedResult: primary?.id === "interactive-name"
      ? `The ${role} should expose a concise accessible name that describes its purpose.`
      : `The ${role} should support the expected accessible semantics and interaction without creating a barrier.`,
    userImpact: primary?.id === "interactive-name"
      ? `People using a screen reader or voice control may be unable to identify or operate the ${role}.`
      : `Affected users may be unable to understand or operate this part of the interface reliably.`,
    affectedUsers: affectedUsersFor(evidence.checks),
    severity: severityFor(evidence.checks),
    severityRationale: evidence.taskContext.trim()
      ? `The issue affects the task “${evidence.taskContext.trim()}”. Confirm task criticality and whether a practical workaround exists.`
      : "Confirm task criticality, frequency, reach, and whether a practical workaround exists before finalizing severity.",
    wcag: mappings,
    recommendation: primary?.id === "interactive-name"
      ? "Provide a visible text label or another programmatic name. Prefer native HTML and verify the final name in the browser accessibility tree."
      : "Review the captured semantics and behavior, use native HTML where possible, and verify the change with keyboard and assistive technology.",
    exampleFix: primary?.id === "interactive-name" && role === "button"
      ? '<button type="button">Describe the action</button>'
      : "",
    reproductionSteps: [
      `Open ${evidence.page.title || "the captured page"}.`,
      `Locate the selected ${role}${evidence.target.accessibleName ? ` named “${evidence.target.accessibleName}”` : ""}.`,
      evidence.observation.trim() || "Inspect the element with the relevant assistive technology and confirm the captured behavior.",
    ],
    confidence: primary?.outcome === "fail" ? "medium" : "low",
    fieldConfidence: [
      {
        field: "wcag",
        confidence: !mappings.length
          ? "low"
          : mappings.some((mapping) => mapping.confidence === "high")
            ? "high"
            : "medium",
        reason: mappings.length ? "Based on deterministic selected-element evidence." : "No deterministic WCAG mapping was available.",
      },
      {
        field: "severity",
        confidence: "low",
        reason: "Task importance, frequency, reach, and workaround availability require auditor judgment.",
      },
    ],
    assumptions: evidence.observation.trim() ? [] : ["The issue behavior was inferred from captured element context."],
    manualChecks: [
      "Confirm the reported behavior with the relevant keyboard or assistive-technology workflow.",
      "Confirm the WCAG mapping, severity, and impact before marking this finding reviewed.",
    ],
    provenance: {
      source: "local",
      model: "deterministic-draft",
      modelVersion: "1",
      promptVersion: "local-v1",
      knowledgeVersion: "wcag-2.2",
      generatedAt,
    },
  });
}
