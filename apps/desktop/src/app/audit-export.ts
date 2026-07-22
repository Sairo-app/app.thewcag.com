import type {
  AuditProject,
  AuditSampleItem,
  AuditTestRun,
  CaptureEntry,
  Finding,
} from "../shared/desktop";
import { auditPlanProgress } from "./audit-plan";
import { WCAG_CRITERIA } from "./data/wcag";

export interface ChecklistExportEntry {
  result: "untested" | "pass" | "fail" | "na";
  note: string;
  findingKey?: string;
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

export function buildAuditMarkdown(input: {
  audit: AuditProject;
  findings: Finding[];
  checklist: Record<string, ChecklistExportEntry>;
  captures: CaptureEntry[];
  sampleItems: AuditSampleItem[];
  testRuns: AuditTestRun[];
  generatedAt?: Date;
}): string {
  const { audit, captures, checklist, findings, sampleItems, testRuns } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const plan = auditPlanProgress(audit);
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
    `- Guided test runs: ${testRuns.filter((run) => run.status === "complete").length} of ${testRuns.length} complete`,
    `- WCAG review: ${applicableCriteria.length - counts.untested} of ${applicableCriteria.length} applicable criteria recorded`,
    `- Findings: ${findings.length} total, ${statuses.open} open, ${statuses.retest} ready for retest, ${statuses.fixed} verified fixed, ${statuses.accepted} risk accepted`,
    `- Evidence captures: ${captures.length}`,
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
        `- Steps recorded: ${run.steps.filter((step) => step.complete).length} of ${run.steps.length}`,
        "",
      );
      run.steps.forEach((step) => {
        lines.push(
          `- [${step.complete ? "x" : " "}] ${step.label}${step.observation ? `: ${step.observation}` : ""}`,
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
          testRuns.some((run) => run.status !== "complete") ||
          counts.fail ||
          counts.untested ||
          undocumentedNA ||
          statuses.open ||
          statuses.retest ||
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
    "### Executive summary",
    "",
    value(audit.executiveSummary),
    "",
    "### Limitations",
    "",
    value(audit.limitations),
    "",
    "## Findings",
    "",
  );

  if (!findings.length) {
    lines.push("No findings have been recorded.", "");
  } else {
    findings.forEach((finding, index) => {
      lines.push(
        `### ${finding.reference || String(index + 1)}. ${heading(finding.title)}`,
        "",
        `- Finding ID: ${finding.id}`,
        `- Criterion: ${value(finding.wcag, "Needs mapping")}`,
        `- Severity: ${finding.severity}`,
        `- Status: ${finding.status}`,
        `- Location: ${value(finding.location)}`,
        `- Evidence capture: ${value(
          captures.find((capture) => capture.id === finding.captureId)?.title,
          "Not linked",
        )}`,
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

  lines.push("## Evidence inventory", "");
  if (captures.length) {
    lines.push("| Capture | Dimensions | Issues | Created |", "| --- | ---: | ---: | --- |");
    for (const capture of captures) {
      lines.push(`| ${cell(capture.title)} | ${capture.width} × ${capture.height} | ${capture.issues} | ${new Date(capture.createdAt).toISOString()} |`);
    }
  } else {
    lines.push("No native captures have been recorded.");
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

export function buildAuditHtml(input: {
  audit: AuditProject;
  findings: Finding[];
  checklist: Record<string, ChecklistExportEntry>;
  captures: CaptureEntry[];
  sampleItems: AuditSampleItem[];
  testRuns: AuditTestRun[];
  generatedAt?: Date;
}): string {
  const { audit, captures, checklist, findings, sampleItems, testRuns } = input;
  const generatedAt = input.generatedAt ?? new Date();
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
          testRuns.some((run) => run.status !== "complete") ||
          applicable.some((criterion) => checklist[criterion.sc]?.result === "fail") ||
          undocumentedNA ||
          activeFindings.length ||
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
          const capture = captures.find((item) => item.id === finding.captureId);
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
              <span class="finding-number">Finding ${escapeHtml(finding.reference, String(index + 1).padStart(2, "0"))}</span>
              <code class="finding-id">${escapeHtml(finding.id, "Identity unavailable")}</code>
              <h3>${escapeHtml(finding.title, "Untitled finding")}</h3>
              <div class="finding-tags">
                <span class="tag severity-${finding.severity}">${escapeHtml(finding.severity, "")}</span>
                <span class="tag">${escapeHtml(statusLabel[finding.status], "")}</span>
                <span class="tag">WCAG ${escapeHtml(finding.wcag, "Needs mapping")}</span>
              </div>
            </header>
            <dl>
              <div><dt>Location</dt><dd>${escapeHtml(finding.location)}</dd></div>
              <div><dt>Evidence</dt><dd>${escapeHtml(capture?.title, "Not linked")}</dd></div>
              <div><dt>Owner</dt><dd>${escapeHtml(finding.owner, "Unassigned")}</dd></div>
              <div><dt>Reference</dt><dd>${escapeHtml(finding.ticket, "Not linked")}</dd></div>
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
  const testRunSections = testRuns.length
    ? testRuns
        .map(
          (run) => `<article class="finding test-run-report">
            <header>
              <span class="finding-number">${escapeHtml(run.category, "")}</span>
              <h3>${escapeHtml(run.title, "")}</h3>
              <div class="finding-tags"><span class="tag">${escapeHtml(run.status, "")}</span><span class="tag">${run.steps.filter((step) => step.complete).length}/${run.steps.length} steps</span></div>
            </header>
            <div class="finding-body"><section><h4>Recorded steps</h4><ol>${run.steps
              .map((step) => `<li>${step.complete ? "Completed" : "Not completed"}: ${escapeHtml(step.label, "")}${step.observation ? `<br><span class="meta">${escapeHtml(step.observation, "")}</span>` : ""}</li>`)
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

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(audit.project, "Accessibility audit")} accessibility audit</title>
  <style>
    :root { color-scheme: light; --ink:#1f2933; --body:#4f5c68; --line:#d8d0c3; --paper:#fffdf8; --canvas:#f5eddd; --orange:#a9380b; --green:#28745d; --red:#ad342e; --yellow:#8b5b18; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    * { box-sizing:border-box; }
    html { background:var(--canvas); color:var(--ink); }
    body { max-width:1100px; margin:0 auto; padding:40px 32px 64px; background:var(--paper); font-size:15px; line-height:1.55; }
    .skip { position:absolute; left:-999px; top:8px; padding:8px 12px; background:var(--ink); color:white; }
    .skip:focus { left:8px; }
    h1,h2,h3,h4 { line-height:1.2; text-wrap:balance; }
    h1 { max-width:18ch; margin:12px 0 10px; font-size:38px; letter-spacing:-.025em; }
    h2 { margin:42px 0 14px; padding-bottom:8px; border-bottom:2px solid var(--ink); font-size:24px; }
    h3 { margin:0; font-size:20px; }
    h4 { margin:0 0 6px; font-size:14px; }
    p { max-width:75ch; margin:7px 0; color:var(--body); }
    a { color:var(--orange); }
    .report-header { padding-bottom:28px; border-bottom:1px solid var(--line); }
    .brand { color:var(--orange); font-weight:800; }
    .report-meta,.summary { display:flex; flex-wrap:wrap; gap:8px 18px; color:var(--body); }
    .outcome { display:inline-block; margin-top:16px; padding:7px 10px; border:1px solid var(--line); border-radius:7px; background:var(--canvas); font-weight:700; }
    .summary { margin-top:20px; padding:16px 0; border-top:1px solid var(--line); }
    .summary div { min-width:140px; }
    .summary strong { display:block; font-size:22px; color:var(--ink); }
    .summary span { color:var(--body); font-size:13px; }
    .prose-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px 30px; }
    .prose-grid section { min-width:0; }
    .prose-grid .wide { grid-column:1/-1; }
    .table-wrap { width:100%; overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    caption { padding:10px 12px; text-align:left; font-weight:700; }
    th,td { padding:8px 10px; border-top:1px solid var(--line); text-align:left; vertical-align:top; }
    thead th { background:var(--canvas); border-top:0; }
    tbody th { white-space:nowrap; }
    .tag { display:inline-block; padding:3px 6px; border-radius:5px; background:#ece7dd; color:var(--ink); font-size:12px; font-weight:700; text-transform:capitalize; }
    .severity-blocker,.result-fail { color:#7d3028; background:#f4dcda; }
    .severity-major { color:#744b13; background:#f6e8c7; }
    .severity-minor,.result-na { color:#315c88; background:#dce8f2; }
    .result-pass { color:#205d49; background:#dcece5; }
    .finding { margin:0 0 18px; border:1px solid var(--line); border-radius:10px; break-inside:avoid; }
    .finding > header { padding:16px; border-bottom:1px solid var(--line); }
    .finding-number { color:var(--orange); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
    .finding-id { display:block; margin:4px 0 7px; color:var(--body); font-size:10px; overflow-wrap:anywhere; }
    .finding-tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    dl { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin:0; background:#faf6ee; }
    dl div { padding:10px 14px; border-bottom:1px solid var(--line); }
    dt { color:var(--body); font-size:12px; font-weight:700; }
    dd { margin:3px 0 0; overflow-wrap:anywhere; }
    .finding-body { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px 24px; padding:16px; }
    .finding-body section { min-width:0; }
    .empty-copy { padding:18px; border:1px solid var(--line); border-radius:8px; }
    footer { margin-top:42px; padding-top:16px; border-top:1px solid var(--line); color:var(--body); font-size:12px; }
    @media (max-width:700px) { body { padding:24px 18px 40px; } .prose-grid,.finding-body,dl { grid-template-columns:1fr; } .prose-grid .wide { grid-column:auto; } h1 { font-size:30px; } }
    @media print { html { background:white; } body { max-width:none; padding:0; } .finding { break-inside:avoid; } a { color:inherit; } }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to audit</a>
  <header class="report-header">
    <div class="brand">TheWCAG</div>
    <h1>${escapeHtml(audit.project, "Accessibility audit")}</h1>
    <div class="report-meta">
      <span>Target: ${escapeHtml(audit.target)}</span>
      <span>Auditor: ${escapeHtml(audit.auditor)}</span>
      <span>Standard: ${escapeHtml(audit.standard, "")}</span>
      <span>Generated: ${escapeHtml(generatedAt.toLocaleDateString(), "")}</span>
    </div>
    <div class="outcome">${escapeHtml(conclusion, "")}</div>
    <div class="summary" aria-label="Audit summary">
      <div><strong>${reviewed}/${applicable.length}</strong><span>criteria reviewed</span></div>
      <div><strong>${findings.length}</strong><span>findings</span></div>
      <div><strong>${activeFindings.length}</strong><span>unresolved</span></div>
      <div><strong>${captures.length}</strong><span>evidence captures</span></div>
      <div><strong>${sampleItems.filter((item) => item.status === "complete").length}/${sampleItems.length}</strong><span>sample tested</span></div>
      <div><strong>${testRuns.filter((run) => run.status === "complete").length}/${testRuns.length}</strong><span>test runs complete</span></div>
    </div>
  </header>
  <main id="main">
    <h2>Conclusion</h2>
    <div class="prose-grid">
      <section class="wide"><h3>Executive summary</h3>${paragraphs(audit.executiveSummary)}</section>
      <section><h3>Limitations</h3>${paragraphs(audit.limitations)}</section>
      <section><h3>Completion</h3><p>${escapeHtml(audit.completedAt, "Not completed")}</p></section>
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

    <h2>WCAG checklist</h2>
    <div class="table-wrap"><table>
      <caption>${applicable.length} criteria applicable to ${escapeHtml(audit.standard, "")}</caption>
      <thead><tr><th scope="col">Criterion</th><th scope="col">Level</th><th scope="col">Name</th><th scope="col">Result</th><th scope="col">Finding linked</th><th scope="col">Audit note</th></tr></thead>
      <tbody>${checklistRows}</tbody>
    </table></div>
  </main>
  <footer>
    This report records the auditor's working evidence and decisions. Automated and deterministic checks are partial signals and do not establish WCAG conformance without expert review.
  </footer>
</body>
</html>`;
}
