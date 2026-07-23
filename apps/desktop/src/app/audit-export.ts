import type {
  AuditProject,
  AuditSampleItem,
  AuditTestRun,
  CaptureEntry,
  Finding,
} from "../shared/desktop";
import { contrastRatio, hexToRgb } from "@accessibility-build/a11y-core";
import { auditPlanProgress, auditTestRunComplete } from "./audit-plan";
import { WCAG_CRITERIA } from "./data/wcag";
import {
  findingEvidenceCaptureIds,
  findingHasEvidence,
  referencedEvidenceCaptureIds,
} from "../shared/finding-evidence";
import { findingReferenceWithId } from "../shared/finding-references";

export interface ChecklistExportEntry {
  result: "untested" | "pass" | "fail" | "na";
  note: string;
  findingKey?: string;
}

export type VpatConformanceResponse =
  | ""
  | "supports"
  | "partially-supports"
  | "does-not-support"
  | "not-applicable";

export interface VpatCriterionEntry {
  response: VpatConformanceResponse;
  remarks: string;
  source: "auditor";
  updatedAt: number;
}

export type VpatResponseMap = Partial<Record<string, VpatCriterionEntry>>;

export interface ReportSectionOptions {
  executiveSummary: boolean;
  limitations: boolean;
  prioritizedActionPlan: boolean;
}

export type ReportAudience = "complete" | "executive" | "delivery";

export const REPORT_AUDIENCE_PRESETS: Record<ReportAudience, ReportSectionOptions> = {
  complete: { executiveSummary: true, limitations: true, prioritizedActionPlan: true },
  executive: { executiveSummary: true, limitations: true, prioritizedActionPlan: false },
  delivery: { executiveSummary: false, limitations: false, prioritizedActionPlan: true },
};

export const DEFAULT_REPORT_SECTIONS: ReportSectionOptions = REPORT_AUDIENCE_PRESETS.complete;

export interface AuditExportInput {
  audit: AuditProject;
  findings: Finding[];
  checklist: Record<string, ChecklistExportEntry>;
  captures: CaptureEntry[];
  sampleItems: AuditSampleItem[];
  testRuns: AuditTestRun[];
  vpatResponses?: VpatResponseMap;
  sections?: ReportSectionOptions;
  generatedAt?: Date;
}

const REPORT_COLORS = {
  ink: "#1f2933",
  body: "#4f5c68",
  link: "#a9380b",
  paper: "#fffdf8",
  failText: "#7d3028",
  failBackground: "#f4dcda",
  warningText: "#744b13",
  warningBackground: "#f6e8c7",
  infoText: "#315c88",
  infoBackground: "#dce8f2",
  successText: "#205d49",
  successBackground: "#dcece5",
} as const;

function colorContrast(foreground: string, background: string): number {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) throw new Error("Invalid report color");
  return contrastRatio(fg, bg);
}

export const REPORT_CONTRAST_RATIOS = {
  body: colorContrast(REPORT_COLORS.body, REPORT_COLORS.paper),
  link: colorContrast(REPORT_COLORS.link, REPORT_COLORS.paper),
  fail: colorContrast(REPORT_COLORS.failText, REPORT_COLORS.failBackground),
  warning: colorContrast(REPORT_COLORS.warningText, REPORT_COLORS.warningBackground),
  info: colorContrast(REPORT_COLORS.infoText, REPORT_COLORS.infoBackground),
  success: colorContrast(REPORT_COLORS.successText, REPORT_COLORS.successBackground),
};

if (Object.values(REPORT_CONTRAST_RATIOS).some((ratio) => ratio < 4.5)) {
  throw new Error("The report color palette does not meet WCAG 2.2 AA text contrast");
}

function value(input: string | undefined, fallback = "Not documented"): string {
  return input?.trim() || fallback;
}

function cell(input: string): string {
  return input.replaceAll("|", "\\|").replaceAll("\n", " ").trim();
}

function heading(input: string): string {
  return input.replace(/[\r\n#]+/g, " ").trim();
}

const VPAT_RESPONSE_LABELS: Record<Exclude<VpatConformanceResponse, "">, string> = {
  supports: "Supports",
  "partially-supports": "Partially supports",
  "does-not-support": "Does not support",
  "not-applicable": "Not applicable",
};

type CompletedVpatEntry = VpatCriterionEntry & {
  response: Exclude<VpatConformanceResponse, "">;
};

function auditorVpatEntry(entry: VpatCriterionEntry | undefined): CompletedVpatEntry | null {
  if (!entry || entry.source !== "auditor" || !entry.response || !VPAT_RESPONSE_LABELS[entry.response]) {
    return null;
  }
  return entry as CompletedVpatEntry;
}

function vpatResponseLabel(response: Exclude<VpatConformanceResponse, "">): string {
  return VPAT_RESPONSE_LABELS[response];
}

function prioritizedFindings(findings: Finding[]): Finding[] {
  const severityOrder: Record<Finding["severity"], number> = { blocker: 0, major: 1, minor: 2 };
  return findings
    .filter((finding) => finding.status === "open" || finding.status === "retest")
    .sort((a, b) => {
      const severity = severityOrder[a.severity] - severityOrder[b.severity];
      if (severity) return severity;
      const dueDate = (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
      return dueDate || (a.reference || a.title).localeCompare(b.reference || b.title);
    });
}

export function buildAuditMarkdown(input: AuditExportInput): string {
  const { audit, captures, checklist, findings, sampleItems, testRuns } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const sections = input.sections ?? DEFAULT_REPORT_SECTIONS;
  const vpatResponses = input.vpatResponses ?? {};
  const plan = auditPlanProgress(audit);
  const availableCaptureIds = new Set(captures.map((capture) => capture.id));
  const assignedCaptureIds = referencedEvidenceCaptureIds(findings);
  const findingsWithEvidence = findings.filter((finding) =>
    findingHasEvidence(finding, availableCaptureIds),
  ).length;
  const findingsWithoutEvidence = findings.filter(
    (finding) => !findingHasEvidence(finding, availableCaptureIds),
  ).length;
  const findingsPendingReview = findings.filter(
    (finding) => finding.reviewState === "pending",
  ).length;
  const unassignedCaptureCount = captures.filter((capture) => !assignedCaptureIds.has(capture.id)).length;
  const applicableCriteria = WCAG_CRITERIA.filter(
    (criterion) => audit.standard === "WCAG 2.2 AA" || criterion.level === "A",
  );
  const counts = applicableCriteria.reduce(
    (output, criterion) => {
      output[checklist[criterion.sc]?.result || "untested"]++;
      return output;
    },
    { pass: 0, fail: 0, na: 0, untested: 0 },
  );
  const undocumentedNA = applicableCriteria.filter((criterion) => {
    const entry = checklist[criterion.sc];
    return entry?.result === "na" && !entry.note.trim();
  }).length;
  const statuses = findings.reduce(
    (output, finding) => {
      output[finding.status]++;
      return output;
    },
    { open: 0, retest: 0, fixed: 0, accepted: 0 },
  );
  const lines = [
    `# ${heading(audit.project)} accessibility audit`,
    "",
    `Generated: ${generatedAt.toISOString()}`,
    `Auditor: ${value(audit.auditor)}`,
    `Evaluation started: ${value(audit.startedAt)}`,
    `Conformance target: ${audit.standard}`,
    "",
    "## Audit status",
    "",
    `- Evaluation plan: ${plan.complete} of ${plan.total} core fields complete`,
    `- Representative sample: ${sampleItems.filter((item) => item.status === "complete").length} of ${sampleItems.length} items tested`,
    `- Guided test runs: ${testRuns.filter(auditTestRunComplete).length} of ${testRuns.length} complete`,
    `- WCAG review: ${applicableCriteria.length - counts.untested} of ${applicableCriteria.length} applicable criteria recorded`,
    `- Findings: ${findings.length} total, ${statuses.open} open, ${statuses.retest} ready for retest, ${statuses.fixed} verified fixed, ${statuses.accepted} risk accepted`,
    `- Finding evidence: ${findingsWithEvidence} of ${findings.length} findings linked`,
    `- Evidence captures: ${captures.length} total, ${unassignedCaptureCount} unassigned`,
  ];
  if (plan.missing.length) lines.push(`- Missing plan context: ${plan.missing.join(", ")}`);
  if (undocumentedNA) lines.push(`- Not-applicable decisions missing rationale: ${undocumentedNA}`);

  lines.push(
    "",
    "## Evaluation plan",
    "",
    "### Target",
    "",
    value(audit.target),
    "",
    "### Evaluation goal",
    "",
    value(audit.goal),
    "",
    "### Included scope",
    "",
    value(audit.scope),
    "",
    "### Sampling rationale",
    "",
    value(audit.sample),
    "",
    "### Excluded scope",
    "",
    value(audit.excludedScope, "No exclusions documented"),
    "",
    "### Browser, device, and operating-system matrix",
    "",
    value(audit.environment),
    "",
    "### Assistive-technology coverage",
    "",
    value(audit.assistiveTechnology),
    "",
    "### Methodology",
    "",
    value(audit.methodology),
    "",
    "### Structured representative sample",
    "",
  );
  if (sampleItems.length) {
    lines.push(
      "| Type | Sample item | Location | Status | Notes |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const item of sampleItems) {
      lines.push(
        `| ${item.kind} | ${cell(item.label)} | ${cell(item.location)} | ${item.status} | ${cell(item.notes)} |`,
      );
    }
  } else {
    lines.push("No structured sample items have been recorded.");
  }

  lines.push("", "## Guided test runs", "");
  if (testRuns.length) {
    for (const run of testRuns) {
      lines.push(
        `### ${heading(run.title)}`,
        "",
        `- Category: ${run.category}`,
        `- Status: ${run.status}`,
        `- Steps recorded: ${run.steps.filter((step) => step.complete && step.observation.trim()).length} of ${run.steps.length}`,
        "",
      );
      run.steps.forEach((step) => {
        lines.push(
          `- [${step.complete && step.observation.trim() ? "x" : " "}] ${step.label}${step.observation ? `: ${step.observation}` : ""}`,
        );
      });
      if (run.notes.trim()) lines.push("", run.notes.trim());
      lines.push("");
    }
  } else {
    lines.push("No guided test runs have been recorded.");
  }

  const conclusionLabel =
    audit.conclusion === "meets-target"
      ? `Meets ${audit.standard}${
          plan.complete !== plan.total ||
          !sampleItems.length ||
          sampleItems.some((item) => item.status !== "complete") ||
          testRuns.some((run) => !auditTestRunComplete(run)) ||
          counts.fail ||
          counts.untested ||
          undocumentedNA ||
          statuses.open ||
          statuses.retest ||
          findingsWithoutEvidence ||
          findingsPendingReview ||
          !audit.executiveSummary.trim() ||
          !audit.limitations.trim() ||
          !audit.completedAt
            ? " (readiness requirements are not currently satisfied)"
            : ""
        }`
      : audit.conclusion === "does-not-meet-target"
        ? `Does not meet ${audit.standard}`
        : audit.conclusion === "in-progress"
          ? "Evaluation in progress"
          : "Not set";
  lines.push(
    "",
    "## Audit conclusion",
    "",
    `- Outcome: ${conclusionLabel}`,
    `- Completion date: ${value(audit.completedAt, "Not completed")}`,
    "",
  );
  if (sections.executiveSummary) {
    lines.push("### Executive summary", "", value(audit.executiveSummary), "");
  }
  if (sections.limitations) {
    lines.push("### Limitations", "", value(audit.limitations), "");
  }
  lines.push("## Findings", "");

  if (!findings.length) {
    lines.push("No findings have been recorded.", "");
  } else {
    findings.forEach((finding, index) => {
      lines.push(
        `### ${findingReferenceWithId(finding, String(index + 1))}. ${heading(finding.title)}`,
        "",
        `- Finding ID: ${finding.id}`,
        `- Criterion: ${value(finding.wcag, "Needs mapping")}`,
        `- Severity: ${finding.severity}`,
        `- Status: ${finding.status}`,
        `- Auditor review: ${finding.reviewState === "pending" ? "Required" : "Complete"}`,
        `- Location: ${value(finding.location)}`,
        `- Evidence captures: ${findingEvidenceCaptureIds(finding)
          .map((captureId) => captures.find((capture) => capture.id === captureId)?.title)
          .filter((title): title is string => Boolean(title))
          .join(", ") || "Not linked"}`,
        `- Remediation owner: ${value(finding.owner, "Unassigned")}`,
        `- Ticket or reference: ${value(finding.ticket, "Not linked")}`,
        `- Target remediation date: ${value(finding.dueDate, "Not scheduled")}`,
        `- Duplicated from: ${value(finding.duplicateOf, "Not duplicated")}`,
        `- Confirmed occurrences: ${finding.occurrences?.length ?? 0}`,
        `- Before evidence: ${value(captures.find((capture) => capture.id === finding.beforeCaptureId)?.title, "Not linked")}`,
        `- After evidence: ${value(captures.find((capture) => capture.id === finding.afterCaptureId)?.title, "Not linked")}`,
        `- Affected users: ${finding.affectedUsers?.length ? finding.affectedUsers.join(", ") : "Not documented"}`,
        "",
      );
      const sections: Array<[string, string | undefined]> = [
        ["Description", finding.description || finding.note],
        ["Actual result", finding.actualResult],
        ["Expected result", finding.expectedResult],
        ["User impact", finding.userImpact],
        ["Severity rationale", finding.severityRationale],
        ["Suggested resolution", finding.recommendation],
        ["Before and after comparison", finding.comparisonNote],
      ];
      for (const [label, content] of sections) {
        if (!content?.trim()) continue;
        lines.push(`#### ${label}`, "", content.trim(), "");
      }
      if (finding.reproductionSteps?.length) {
        lines.push("#### Reproduction steps", "");
        finding.reproductionSteps.forEach((step, stepIndex) => {
          lines.push(`${stepIndex + 1}. ${step}`);
        });
        lines.push("");
      }
      if (finding.occurrences?.length) {
        lines.push("#### Confirmed occurrences", "");
        finding.occurrences.forEach((occurrence, occurrenceIndex) => {
          lines.push(
            `${occurrenceIndex + 1}. ${occurrence.location || "Location not documented"}${occurrence.note ? `: ${occurrence.note}` : ""}`,
          );
        });
        lines.push("");
      }
      if (finding.retestNote?.trim()) {
        lines.push(
          "#### Retest record",
          "",
          finding.retestNote.trim(),
          finding.retestedAt ? `Retested: ${new Date(finding.retestedAt).toISOString()}` : "",
          "",
        );
      }
      if (finding.riskAcceptance?.trim()) {
        lines.push(
          "#### Risk acceptance",
          "",
          finding.riskAcceptance.trim(),
          "",
        );
      }
    });
  }

  if (sections.prioritizedActionPlan) {
    const actionFindings = prioritizedFindings(findings);
    lines.push("## Prioritized action plan", "");
    if (actionFindings.length) {
      lines.push(
        "| Priority | Finding | Recommended action | Owner | Target date |",
        "| --- | --- | --- | --- | --- |",
      );
      actionFindings.forEach((finding) => {
        lines.push(
          `| ${finding.severity} | ${cell(findingReferenceWithId(finding, finding.title))} | ${cell(finding.recommendation || finding.expectedResult || "Review and remediate the documented barrier.")} | ${cell(value(finding.owner, "Unassigned"))} | ${cell(value(finding.dueDate, "Not scheduled"))} |`,
        );
      });
    } else {
      lines.push("No unresolved findings are available for prioritization.");
    }
    lines.push("");
  }

  lines.push("## Evidence inventory", "");
  if (captures.length) {
    lines.push("| Capture | Finding references | Dimensions | Issues | Created |", "| --- | --- | ---: | ---: | --- |");
    for (const capture of captures) {
      const references = findings
        .filter((finding) => findingEvidenceCaptureIds(finding).includes(capture.id))
        .map((finding) => findingReferenceWithId(finding, finding.title))
        .join(", ");
      lines.push(`| ${cell(capture.title)} | ${cell(references || "Unassigned capture")} | ${capture.width} × ${capture.height} | ${capture.issues} | ${new Date(capture.createdAt).toISOString()} |`);
    }
  } else {
    lines.push("No native captures have been recorded.");
  }

  lines.push(
    "",
    "## Accessibility Conformance Report authoring scaffold",
    "",
    "Conformance responses in this section are entered by an auditor. Checklist results and automated signals never populate them.",
    "",
    "| Criterion | Level | Name | Auditor conformance response | Remarks and explanations |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const criterion of applicableCriteria) {
    const entry = auditorVpatEntry(vpatResponses[criterion.sc]);
    lines.push(
      `| ${criterion.sc} | ${criterion.level} | ${cell(criterion.name)} | ${entry ? vpatResponseLabel(entry.response) : "Auditor response required"} | ${cell(entry?.remarks ?? "")} |`,
    );
  }

  lines.push(
    "",
    "## WCAG 2.2 checklist",
    "",
    "| Criterion | Level | Name | Result | Finding linked | Audit note |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const criterion of applicableCriteria) {
    const entry = checklist[criterion.sc] || { result: "untested", note: "" };
    lines.push(
      `| ${criterion.sc} | ${criterion.level} | ${cell(criterion.name)} | ${entry.result} | ${entry.findingKey ? "Yes" : "No"} | ${cell(entry.note)} |`,
    );
  }
  lines.push(
    "",
    "---",
    "",
    "This export records the auditor’s working evidence and decisions. Automated and deterministic checks are partial signals and do not establish WCAG conformance without expert review.",
  );
  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
}

function escapeHtml(input: string | undefined, fallback = "Not documented"): string {
  const next = input?.trim() || fallback;
  return next
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraphs(input: string | undefined, fallback = "Not documented"): string {
  return escapeHtml(input, fallback)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function safeReportUrl(input: string | undefined): string | null {
  if (!input?.trim()) return null;
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function reportLink(input: string | undefined, label: string, fallback = "Not linked"): string {
  const url = safeReportUrl(input);
  return url
    ? `<a href="${escapeHtml(url, "")}">${escapeHtml(label, "")}</a>`
    : escapeHtml(input, fallback);
}

function wcagUnderstandingUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://www.w3.org/WAI/WCAG22/Understanding/${slug}.html`;
}

export function buildAuditHtml(input: AuditExportInput): string {
  const { audit, captures, checklist, findings, sampleItems, testRuns } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const sections = input.sections ?? DEFAULT_REPORT_SECTIONS;
  const vpatResponses = input.vpatResponses ?? {};
  const plan = auditPlanProgress(audit);
  const applicable = WCAG_CRITERIA.filter(
    (criterion) => audit.standard === "WCAG 2.2 AA" || criterion.level === "A",
  );
  const reviewed = applicable.filter((criterion) => {
    const result = checklist[criterion.sc]?.result;
    return result && result !== "untested";
  }).length;
  const activeFindings = findings.filter(
    (finding) => finding.status === "open" || finding.status === "retest",
  );
  const availableCaptureIds = new Set(captures.map((capture) => capture.id));
  const assignedCaptureIds = referencedEvidenceCaptureIds(findings);
  const findingsWithoutEvidence = findings.filter(
    (finding) => !findingHasEvidence(finding, availableCaptureIds),
  ).length;
  const findingsPendingReview = findings.filter(
    (finding) => finding.reviewState === "pending",
  ).length;
  const undocumentedNA = applicable.some((criterion) => {
    const entry = checklist[criterion.sc];
    return entry?.result === "na" && !entry.note.trim();
  });
  const conclusion =
    audit.conclusion === "meets-target"
      ? `Meets ${audit.standard}${
          reviewed !== applicable.length ||
          plan.complete !== plan.total ||
          sampleItems.length === 0 ||
          sampleItems.some((item) => item.status !== "complete") ||
          testRuns.some((run) => !auditTestRunComplete(run)) ||
          applicable.some((criterion) => checklist[criterion.sc]?.result === "fail") ||
          undocumentedNA ||
          activeFindings.length ||
          findingsWithoutEvidence ||
          findingsPendingReview ||
          !audit.executiveSummary.trim() ||
          !audit.limitations.trim() ||
          !audit.completedAt
            ? " (readiness requirements are not currently satisfied)"
            : ""
        }`
      : audit.conclusion === "does-not-meet-target"
        ? `Does not meet ${audit.standard}`
        : audit.conclusion === "in-progress"
          ? "Evaluation in progress"
          : "Not set";
  const statusLabel: Record<Finding["status"], string> = {
    open: "Open",
    retest: "Ready for retest",
    fixed: "Verified fixed",
    accepted: "Risk accepted",
  };
  const sampleRows = sampleItems.length
    ? sampleItems
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.kind, "")}</td>
            <th scope="row">${escapeHtml(item.label, "")}</th>
            <td>${escapeHtml(item.location)}</td>
            <td><span class="tag">${escapeHtml(item.status, "")}</span></td>
            <td>${escapeHtml(item.notes)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="5">No structured sample items have been recorded.</td></tr>`;
  const findingSections = findings.length
    ? findings
        .map((finding, index) => {
          const evidenceTitles = findingEvidenceCaptureIds(finding)
            .map((captureId) => captures.find((item) => item.id === captureId)?.title)
            .filter((title): title is string => Boolean(title))
            .join(", ");
          const criterion = WCAG_CRITERIA.find((item) => item.sc === finding.wcag);
          const findingLabel = findingReferenceWithId(
            finding,
            `Finding ${index + 1}`,
          );
          const steps = finding.reproductionSteps?.length
            ? `<section><h4>Reproduction steps</h4><ol>${finding.reproductionSteps
                .map((step) => `<li>${escapeHtml(step, "")}</li>`)
                .join("")}</ol></section>`
            : "";
          const retest = finding.retestNote?.trim()
            ? `<section><h4>Retest record</h4>${paragraphs(finding.retestNote)}${
                finding.retestedAt
                  ? `<p class="meta">Retested ${escapeHtml(new Date(finding.retestedAt).toLocaleDateString())}</p>`
                  : ""
              }</section>`
            : "";
          const risk = finding.riskAcceptance?.trim()
            ? `<section><h4>Risk acceptance</h4>${paragraphs(finding.riskAcceptance)}</section>`
            : "";
          const comparison = finding.beforeCaptureId || finding.afterCaptureId || finding.comparisonNote?.trim()
            ? `<section><h4>Remediation comparison</h4>${paragraphs(finding.comparisonNote, "No comparison note documented.")}</section>`
            : "";
          const occurrences = finding.occurrences?.length
            ? `<section><h4>Confirmed occurrences</h4><ol>${finding.occurrences
                .map((occurrence) => `<li><strong>${escapeHtml(occurrence.location, "Location not documented")}</strong>${occurrence.note ? `: ${escapeHtml(occurrence.note, "")}` : ""}</li>`)
                .join("")}</ol></section>`
            : "";
          return `<article class="finding" id="finding-${index + 1}">
            <header>
              <span class="finding-number">Finding ${escapeHtml(findingLabel, String(index + 1).padStart(2, "0"))}</span>
              <code class="finding-id">${escapeHtml(finding.id, "Identity unavailable")}</code>
              <h3>${escapeHtml(finding.title, "Untitled finding")}</h3>
              <div class="finding-tags">
                <span class="tag severity-${finding.severity}">${escapeHtml(finding.severity, "")}</span>
                <span class="tag">${escapeHtml(statusLabel[finding.status], "")}</span>
                ${finding.reviewState === "pending" ? '<span class="tag">Needs auditor review</span>' : ""}
                <span class="tag">${criterion
                  ? `<a href="${wcagUnderstandingUrl(criterion.name)}">WCAG ${escapeHtml(criterion.sc, "")}: ${escapeHtml(criterion.name, "")}</a>`
                  : `WCAG ${escapeHtml(finding.wcag, "Needs mapping")}`}</span>
              </div>
            </header>
            <dl>
              <div><dt>Location</dt><dd>${escapeHtml(finding.location)}</dd></div>
              <div><dt>Evidence</dt><dd>${reportLink(finding.evidenceLink, `Open evidence for ${findingLabel}`, evidenceTitles || "Not linked")}</dd></div>
              <div><dt>Owner</dt><dd>${escapeHtml(finding.owner, "Unassigned")}</dd></div>
              <div><dt>Reference</dt><dd>${reportLink(finding.ticketLink?.url, `Open ticket ${finding.ticketLink?.key || finding.ticket || findingLabel}`, finding.ticketLink?.key || finding.ticket || "Not linked")}</dd></div>
              <div><dt>Target date</dt><dd>${escapeHtml(finding.dueDate, "Not scheduled")}</dd></div>
              <div><dt>Affected users</dt><dd>${finding.affectedUsers?.length ? escapeHtml(finding.affectedUsers.join(", "), "") : "Not documented"}</dd></div>
              <div><dt>Occurrences</dt><dd>${finding.occurrences?.length ?? 0}</dd></div>
              <div><dt>Before evidence</dt><dd>${escapeHtml(captures.find((capture) => capture.id === finding.beforeCaptureId)?.title, "Not linked")}</dd></div>
              <div><dt>After evidence</dt><dd>${escapeHtml(captures.find((capture) => capture.id === finding.afterCaptureId)?.title, "Not linked")}</dd></div>
            </dl>
            <div class="finding-body">
              <section><h4>Description</h4>${paragraphs(finding.description || finding.note)}</section>
              <section><h4>Actual result</h4>${paragraphs(finding.actualResult)}</section>
              <section><h4>Expected result</h4>${paragraphs(finding.expectedResult)}</section>
              <section><h4>User impact</h4>${paragraphs(finding.userImpact)}</section>
              <section><h4>Severity rationale</h4>${paragraphs(finding.severityRationale)}</section>
              <section><h4>Suggested resolution</h4>${paragraphs(finding.recommendation)}</section>
              ${steps}${occurrences}${comparison}${retest}${risk}
            </div>
          </article>`;
        })
        .join("")
    : `<p class="empty-copy">No findings have been recorded.</p>`;
  const captureRows = captures.length
    ? captures.map((capture) => {
        const references = findings
          .filter((finding) => findingEvidenceCaptureIds(finding).includes(capture.id))
          .map((finding) => findingReferenceWithId(finding, finding.title))
          .join(", ");
        return `<tr><th scope="row">${escapeHtml(capture.title, "Untitled capture")}</th><td>${escapeHtml(references, "Unassigned capture")}</td><td>${capture.width} × ${capture.height}</td><td>${capture.issues}</td></tr>`;
      }).join("")
    : `<tr><td colspan="4">No native captures have been recorded.</td></tr>`;
  const testRunSections = testRuns.length
    ? testRuns
        .map(
          (run) => `<article class="finding test-run-report">
            <header>
              <span class="finding-number">${escapeHtml(run.category, "")}</span>
              <h3>${escapeHtml(run.title, "")}</h3>
              <div class="finding-tags"><span class="tag">${escapeHtml(run.status, "")}</span><span class="tag">${run.steps.filter((step) => step.complete && step.observation.trim()).length}/${run.steps.length} steps</span></div>
            </header>
            <div class="finding-body"><section><h4>Recorded steps</h4><ol>${run.steps
              .map((step) => `<li>${step.complete && step.observation.trim() ? "Completed" : "Not completed"}: ${escapeHtml(step.label, "")}${step.observation ? `<br><span class="meta">${escapeHtml(step.observation, "")}</span>` : ""}</li>`)
              .join("")}</ol></section><section><h4>Run notes</h4>${paragraphs(run.notes)}</section></div>
          </article>`,
        )
        .join("")
    : `<p class="empty-copy">No guided test runs have been recorded.</p>`;
  const checklistRows = applicable
    .map((criterion) => {
      const entry = checklist[criterion.sc] || { result: "untested", note: "" };
      return `<tr>
        <th scope="row">${escapeHtml(criterion.sc, "")}</th>
        <td>${escapeHtml(criterion.level, "")}</td>
        <td>${escapeHtml(criterion.name, "")}</td>
        <td><span class="tag result-${entry.result}">${escapeHtml(entry.result, "")}</span></td>
        <td>${entry.findingKey ? "Yes" : "No"}</td>
        <td>${escapeHtml(entry.note, "")}</td>
      </tr>`;
    })
    .join("");
  const actionPlanRows = prioritizedFindings(findings)
    .map((finding, index) => {
      const findingLabel = findingReferenceWithId(
        finding,
        `Finding ${index + 1}`,
      );
      const ticket = finding.ticketLink
        ? reportLink(finding.ticketLink.url, `Open ticket ${finding.ticketLink.key}`, finding.ticketLink.key)
        : escapeHtml(finding.ticket, "Not linked");
      return `<tr>
        <td><span class="tag severity-${finding.severity}">${escapeHtml(finding.severity, "")}</span></td>
        <th scope="row"><a href="#finding-${findings.indexOf(finding) + 1}">${escapeHtml(findingLabel, "")}: ${escapeHtml(finding.title, "")}</a></th>
        <td>${escapeHtml(finding.recommendation || finding.expectedResult, "Review and remediate the documented barrier.")}</td>
        <td>${escapeHtml(finding.owner, "Unassigned")}</td>
        <td>${escapeHtml(finding.dueDate, "Not scheduled")}</td>
        <td>${ticket}</td>
      </tr>`;
    })
    .join("");
  const vpatRows = applicable
    .map((criterion) => {
      const entry = auditorVpatEntry(vpatResponses[criterion.sc]);
      return `<tr>
        <th scope="row"><a href="${wcagUnderstandingUrl(criterion.name)}">${escapeHtml(criterion.sc, "")}: ${escapeHtml(criterion.name, "")}</a></th>
        <td>${escapeHtml(criterion.level, "")}</td>
        <td>${entry ? escapeHtml(vpatResponseLabel(entry.response), "") : '<span class="response-required">Auditor response required</span>'}</td>
        <td>${escapeHtml(entry?.remarks, "")}</td>
      </tr>`;
    })
    .join("");
  const vpatCompleted = applicable.filter((criterion) => auditorVpatEntry(vpatResponses[criterion.sc])).length;
  const overviewSections = [
    sections.executiveSummary
      ? `<section class="wide"><h3>Executive summary</h3>${paragraphs(audit.executiveSummary)}</section>`
      : "",
    sections.limitations
      ? `<section><h3>Limitations</h3>${paragraphs(audit.limitations)}</section>`
      : "",
    `<section><h3>Completion</h3><p>${escapeHtml(audit.completedAt, "Not completed")}</p></section>`,
  ].filter(Boolean).join("");
  const actionPlanSection = sections.prioritizedActionPlan
    ? `<section aria-labelledby="action-plan-title">
        <h2 id="action-plan-title">Prioritized action plan</h2>
        <p>Unresolved findings are ordered by auditor-assigned severity, then target date.</p>
        <div class="table-wrap"><table>
          <caption>${prioritizedFindings(findings).length} unresolved findings prioritized for remediation</caption>
          <colgroup><col style="width:10%"><col style="width:23%"><col style="width:32%"><col style="width:13%"><col style="width:12%"><col style="width:10%"></colgroup>
          <thead><tr><th scope="col">Priority</th><th scope="col">Finding</th><th scope="col">Recommended action</th><th scope="col">Owner</th><th scope="col">Target date</th><th scope="col">Ticket</th></tr></thead>
          <tbody>${actionPlanRows || '<tr><td colspan="6">No unresolved findings are available for prioritization.</td></tr>'}</tbody>
        </table></div>
      </section>`
    : "";
  const targetLink = safeReportUrl(audit.target)
    ? reportLink(audit.target, `Open evaluated target for ${audit.project}`, audit.target)
    : escapeHtml(audit.target);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
  <meta name="description" content="WCAG 2.2 accessibility audit report for ${escapeHtml(audit.project, "the evaluated product")}">
  <meta name="author" content="${escapeHtml(audit.auditor, "Auditor not documented")}">
  <meta name="generator" content="TheWCAG Desktop">
  <meta name="dcterms.created" content="${escapeHtml(generatedAt.toISOString(), "")}">
  <title>Accessibility audit report - ${escapeHtml(audit.project, "Untitled audit")}</title>
  <style>
    :root { color-scheme: light; --ink:#1f2933; --body:#4f5c68; --line:#d8d0c3; --paper:#fffdf8; --canvas:#f5eddd; --orange:#a9380b; --green:#28745d; --red:#ad342e; --yellow:#8b5b18; --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px; --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --control-height-standard:44px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    * { box-sizing:border-box; }
    html { background:var(--canvas); color:var(--ink); }
    body { max-width:1100px; margin:0 auto; padding:var(--space-10) var(--space-8) calc(var(--space-12) + var(--space-4)); background:var(--paper); font-size:15px; line-height:1.55; }
    .skip { position:absolute; left:-999px; top:8px; min-height:var(--control-height-standard); padding:var(--space-2) var(--space-3); background:var(--ink); color:white; }
    .skip:focus { left:8px; }
    h1,h2,h3,h4 { line-height:1.2; text-wrap:balance; }
    h1 { max-width:18ch; margin:var(--space-3) 0 var(--space-2); font-size:38px; }
    h2 { margin:var(--space-10) 0 var(--space-3); padding-bottom:var(--space-2); border-bottom:2px solid var(--ink); font-size:24px; }
    h3 { margin:0; font-size:20px; }
    h4 { margin:0 0 var(--space-1); font-size:14px; }
    p { max-width:75ch; margin:var(--space-2) 0; color:var(--body); }
    a { color:var(--orange); text-decoration:underline; text-decoration-thickness:.08em; text-underline-offset:.16em; }
    a:focus-visible { outline:3px solid var(--orange); outline-offset:3px; }
    .report-header { padding-bottom:var(--space-6); border-bottom:1px solid var(--line); }
    .brand { color:var(--orange); font-weight:800; }
    .report-meta,.summary { display:flex; flex-wrap:wrap; gap:var(--space-2) var(--space-4); color:var(--body); }
    .outcome { display:inline-block; margin-top:var(--space-4); padding:var(--space-2); border:1px solid var(--line); border-radius:7px; background:var(--canvas); font-weight:700; }
    .summary { margin-top:var(--space-5); padding:var(--space-4) 0; border-top:1px solid var(--line); }
    .summary div { min-width:140px; }
    .summary strong { display:block; font-size:22px; color:var(--ink); }
    .summary span { color:var(--body); font-size:13px; }
    .prose-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--space-5) var(--space-8); }
    .prose-grid section { min-width:0; }
    .prose-grid .wide { grid-column:1/-1; }
    .table-wrap { width:100%; overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    caption { padding:var(--space-2) var(--space-3); text-align:left; font-weight:700; }
    th,td { padding:var(--space-2); border-top:1px solid var(--line); text-align:left; vertical-align:top; }
    thead th { background:var(--canvas); border-top:0; }
    tbody th { white-space:nowrap; }
    .tag { display:inline-block; padding:var(--space-1); border-radius:5px; background:#ece7dd; color:var(--ink); font-size:12px; font-weight:700; text-transform:capitalize; }
    .severity-blocker,.result-fail { color:#7d3028; background:#f4dcda; }
    .severity-major { color:#744b13; background:#f6e8c7; }
    .severity-minor,.result-na { color:#315c88; background:#dce8f2; }
    .result-pass { color:#205d49; background:#dcece5; }
    .response-required { color:#744b13; font-weight:700; }
    .finding { margin:0 0 var(--space-4); border:1px solid var(--line); border-radius:10px; break-inside:avoid; }
    .finding > header { padding:var(--space-4); border-bottom:1px solid var(--line); }
    .finding-number { color:var(--orange); font-size:12px; font-weight:800; text-transform:uppercase; }
    .finding-id { display:block; margin:var(--space-1) 0 var(--space-2); color:var(--body); font-size:10px; overflow-wrap:anywhere; }
    .finding-tags { display:flex; flex-wrap:wrap; gap:var(--space-1); margin-top:var(--space-2); }
    dl { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin:0; background:#faf6ee; }
    dl div { padding:var(--space-2) var(--space-3); border-bottom:1px solid var(--line); }
    dt { color:var(--body); font-size:12px; font-weight:700; }
    dd { margin:var(--space-1) 0 0; overflow-wrap:anywhere; }
    .finding-body { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--space-4) var(--space-6); padding:var(--space-4); }
    .finding-body section { min-width:0; }
    .empty-copy { padding:var(--space-4); border:1px solid var(--line); border-radius:8px; }
    footer { margin-top:var(--space-10); padding-top:var(--space-4); border-top:1px solid var(--line); color:var(--body); font-size:12px; }
    @media (max-width:700px) { body { padding:var(--space-6) var(--space-4) var(--space-10); } .prose-grid,.finding-body,dl { grid-template-columns:1fr; } .prose-grid .wide { grid-column:auto; } h1 { font-size:30px; } }
    @page { size:A4; margin:16mm 14mm 18mm; }
    @media print { html { background:white; } body { max-width:none; padding:0; print-color-adjust:exact; -webkit-print-color-adjust:exact; } h2,h3,h4 { break-after:avoid-page; } .finding { break-inside:avoid; } .table-wrap { overflow:visible; } tbody th { white-space:normal; } th,td { overflow-wrap:break-word; } thead { display:table-header-group; } tr { break-inside:avoid; } a { color:inherit; } .skip { display:none; } }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to report content</a>
  <header class="report-header">
    <div class="brand">TheWCAG</div>
    <h1>${escapeHtml(audit.project, "Accessibility audit")}</h1>
    <div class="report-meta">
      <span>Target: ${targetLink}</span>
      <span>Auditor: ${escapeHtml(audit.auditor)}</span>
      <span>Standard: ${escapeHtml(audit.standard, "")}</span>
      <span>Generated: ${escapeHtml(generatedAt.toLocaleDateString(), "")}</span>
    </div>
    <div class="outcome">Auditor-recorded outcome: ${escapeHtml(conclusion, "")}</div>
    <div class="summary" aria-label="Audit summary">
      <div><strong>${reviewed}/${applicable.length}</strong><span>criteria reviewed</span></div>
      <div><strong>${findings.length}</strong><span>findings</span></div>
      <div><strong>${activeFindings.length}</strong><span>unresolved</span></div>
      <div><strong>${captures.length - captures.filter((capture) => !assignedCaptureIds.has(capture.id)).length}</strong><span>finding-linked captures</span></div>
      <div><strong>${sampleItems.filter((item) => item.status === "complete").length}/${sampleItems.length}</strong><span>sample tested</span></div>
      <div><strong>${testRuns.filter(auditTestRunComplete).length}/${testRuns.length}</strong><span>test runs complete</span></div>
    </div>
  </header>
  <main id="main" tabindex="-1">
    <h2>Report overview</h2>
    <div class="prose-grid">
      ${overviewSections}
    </div>

    <h2>Evaluation plan</h2>
    <div class="prose-grid">
      <section><h3>Goal</h3>${paragraphs(audit.goal)}</section>
      <section><h3>Included scope</h3>${paragraphs(audit.scope)}</section>
      <section><h3>Sampling rationale</h3>${paragraphs(audit.sample)}</section>
      <section><h3>Excluded scope</h3>${paragraphs(audit.excludedScope, "No exclusions documented")}</section>
      <section><h3>Test environments</h3>${paragraphs(audit.environment)}</section>
      <section><h3>Assistive technology</h3>${paragraphs(audit.assistiveTechnology)}</section>
      <section class="wide"><h3>Methodology</h3>${paragraphs(audit.methodology)}</section>
    </div>

    <h2>Representative sample</h2>
    <div class="table-wrap"><table>
      <caption>${sampleItems.length} sample items</caption>
      <thead><tr><th scope="col">Type</th><th scope="col">Sample item</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Notes</th></tr></thead>
      <tbody>${sampleRows}</tbody>
    </table></div>

    <h2>Guided test runs</h2>
    ${testRunSections}

    <h2>Findings</h2>
    ${findingSections}

    <h2>Evidence inventory</h2>
    <div class="table-wrap"><table>
      <caption>Finding relationships for ${captures.length} local captures</caption>
      <thead><tr><th scope="col">Capture</th><th scope="col">Finding references</th><th scope="col">Dimensions</th><th scope="col">Issues</th></tr></thead>
      <tbody>${captureRows}</tbody>
    </table></div>

    ${actionPlanSection}

    <h2>WCAG 2.2 audit checklist</h2>
    <div class="table-wrap"><table>
      <caption>${applicable.length} criteria in the ${escapeHtml(audit.standard, "")} audit target</caption>
      <colgroup><col style="width:10%"><col style="width:8%"><col style="width:35%"><col style="width:15%"><col style="width:14%"><col style="width:18%"></colgroup>
      <thead><tr><th scope="col">Criterion</th><th scope="col">Level</th><th scope="col">Name</th><th scope="col">Audit test result</th><th scope="col">Finding linked</th><th scope="col">Auditor note</th></tr></thead>
      <tbody>${checklistRows}</tbody>
    </table></div>

    <section aria-labelledby="acr-title">
      <h2 id="acr-title">Accessibility Conformance Report authoring scaffold</h2>
      <p><strong>${vpatCompleted} of ${applicable.length} auditor responses entered.</strong> Conformance responses in this section require direct human entry. Checklist results, finding counts, contrast measurements, and automated signals never populate a response.</p>
      <div class="table-wrap"><table>
        <caption>VPAT-style WCAG 2.2 conformance responses authored by the auditor</caption>
        <colgroup><col style="width:55%"><col style="width:8%"><col style="width:17%"><col style="width:20%"></colgroup>
        <thead><tr><th scope="col">Criterion</th><th scope="col">Level</th><th scope="col">Auditor conformance response</th><th scope="col">Remarks and explanations</th></tr></thead>
        <tbody>${vpatRows}</tbody>
      </table></div>
    </section>
  </main>
  <footer>
    This report records the auditor's working evidence and decisions. Automated and deterministic checks are partial signals and do not establish WCAG conformance. Every conformance response shown above was entered by an auditor.
  </footer>
</body>
</html>`;
}
