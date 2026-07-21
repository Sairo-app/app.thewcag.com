# TheWCAG Auditor Product Roadmap

This roadmap turns TheWCAG into a complete accessibility evaluation workspace while preserving three product rules:

1. Automation may collect signals, but it never declares conformance.
2. Every reported barrier must remain traceable to scope, evidence, a criterion decision, and an auditor.
3. Local work stays local until the auditor deliberately exports or publishes it.

## Product outcome

An auditor should be able to plan, execute, document, retest, review, and deliver an accessibility audit without rebuilding the record in spreadsheets or documents. A developer or client should receive enough evidence and context to understand, reproduce, prioritize, remediate, and verify every finding.

## Phase 1: Complete solo-auditor workflow

Status: complete

- Make Plan the first workflow stage instead of hiding evaluation context in Settings.
- Track the representative sample as structured pages, flows, components, documents, and application states.
- Record sample status, location, notes, and blockers.
- Keep WCAG Level A and Level AA applicability mathematically correct.
- Require rationale for not-applicable decisions.
- Link failed criteria to durable finding records.
- Support manual, native-tool, browser-extension, and AI-assisted findings in one register.
- Track affected users, severity rationale, owners, tickets, dates, accepted risk, and retest evidence.
- Add an auditor-controlled conclusion with readiness safeguards.
- Export complete Markdown and printable HTML audit records.

Acceptance:

- A new auditor can identify the next required action without opening Settings.
- A report cannot appear complete while plan fields, sample coverage, criterion decisions, N/A rationale, failure links, or finding details are missing.
- A finding cannot be marked verified fixed without a retest record.
- A risk cannot be accepted without an accountable rationale.

## Phase 2: Auditor speed and repeatability

Status: complete

- Reusable audit templates for common browser, device, operating-system, and assistive-technology matrices.
- Reusable test scripts for authentication, checkout, forms, media, documents, and design-system components.
- Keyboard-first checklist navigation and configurable decision shortcuts.
- Finding duplication for repeated component failures with occurrence tracking.
- Bulk owner, status, severity, target-date, and export operations.
- Saved filters and views such as blockers, retest queue, missing mappings, and overdue remediation.
- Human-readable finding references that remain stable across sorting and export.
- Import and export of complete local audit packages with integrity validation.
- Before-and-after evidence comparison for remediation verification.

Acceptance:

- Repeat audits can start from an approved methodology and test matrix.
- Common triage work takes seconds and remains undoable.
- Stable references survive export, reordering, and reopening.

Delivered:

- Four built-in audit templates cover web products, release regression, desktop applications, and document collections. Auditors can save and remove personal templates without changing prior audits.
- Six guided test scripts cover authentication, checkout, forms, media, documents, and reusable components, with step observations and explicit blocked or complete states.
- Checklist rows support configurable pass, fail, not-applicable, previous, next, and expand shortcuts with a visible shortcut legend and single-action undo.
- Findings have stable `F-001` style references, repeat-failure duplication, occurrence records, before-and-after evidence, saved queues, multi-select triage, selected-item export, and undoable bulk changes.
- Complete `.thewcag-audit.json` packages include audit context, sample, guided runs, findings, views, checklist decisions, captures, annotation documents, activity, palettes, contrast history, and report records. Imports validate schema bounds and a SHA-256 integrity record before writing local data, and roll back partial imports on failure.
- Markdown and printable HTML records preserve stable references, guided-run outcomes, repeated occurrences, and remediation comparisons.

## Phase 3: Engineering handoff and integrations

- Jira, Linear, GitHub Issues, and Azure DevOps connectors.
- Field mapping for title, description, actual result, expected result, impact, WCAG, severity, evidence, owner, and target date.
- Two-way ticket state and reference synchronization with conflict review.
- Design-system component references and source-code links.
- Webhook and API access for approved audit events.
- CSV and JSON imports with validation and explicit field mapping.

Acceptance:

- Auditors can create implementation-ready tickets without copying fields manually.
- External changes never overwrite local auditor decisions silently.

## Phase 4: Review and collaboration

- Auditor, reviewer, remediation owner, and client roles.
- Finding comments, mentions, review requests, and decision history.
- Reviewer sign-off for severity, criterion mapping, accepted risk, and final conclusion.
- Immutable activity history for material changes.
- Offline edits with understandable conflict resolution.
- Redacted client views and internal-only notes.
- Shared terminology, severity, and report templates at organization level.

Acceptance:

- Every material decision has an accountable author and timestamp.
- Internal notes and sensitive evidence never leak into client reports.

## Phase 5: Reporting and compliance programs

- Executive summary, evaluation limitations, remediation themes, and prioritized action plan.
- Branded HTML and PDF delivery with accessible tables, headings, links, and document metadata.
- Configurable report sections and audience-specific detail levels.
- WCAG 2.0, 2.1, and 2.2 views plus jurisdiction mappings where legally appropriate.
- VPAT and Accessibility Conformance Report authoring support that requires human responses and review.
- Historical program dashboards for recurrence, remediation time, component hotspots, and regression rate.
- Scheduled reassessment and accepted-risk review reminders.

Acceptance:

- Report generation never turns partial automation into a conformance claim.
- Exported reports remain accessible and preserve evidence traceability.

## Phase 6: Advanced evidence and testing

- Guided screen-reader scripts with auditor-entered observations.
- Keyboard path recording and focus-order comparison.
- Responsive and zoom test matrices with viewport-specific evidence.
- Document and PDF audit workspaces.
- Mobile device evidence intake and native application test sessions.
- DOM, accessibility-tree, network-state, and visual evidence bundles with privacy controls.
- Regression comparison across builds and releases.
- Rule-engine integrations that preserve raw results separately from confirmed findings.

Acceptance:

- Automated results remain distinct from confirmed findings.
- Evidence records state the environment, method, timestamp, and limitations.

## Phase 7: Enterprise administration and trust

- SSO, SCIM, organization roles, and least-privilege access.
- Configurable retention, legal hold, regional storage, and deletion policies.
- Encryption controls, audit-log export, and security event monitoring.
- Evidence classification and sensitive-content warnings.
- Organization-wide methodology governance and approved templates.
- Usage, storage, AI, and publishing policy controls.
- Backup, recovery, and migration testing.

Acceptance:

- Administrators can prove who accessed, changed, exported, or published audit data.
- Retention and deletion behavior is predictable and testable.

## Guardrails

- Do not use an automated pass rate as a conformance score.
- Do not hide untested criteria inside a percentage.
- Do not let AI finalize severity, WCAG mapping, remediation, or conclusions.
- Do not treat accepted risk as fixed.
- Do not publish visible page content without an explicit privacy review.
- Do not create custom controls when a familiar accessible control is sufficient.

## Product quality measures

- Time from observation to complete finding.
- Percentage of failed criteria linked to findings.
- Percentage of N/A decisions with rationale.
- Percentage of findings with reproduction, impact, mapping, owner, and evidence.
- Median time from ready-for-retest to verified outcome.
- Number of reviewer corrections after delivery.
- Recurrence rate for previously fixed component failures.
- Export accessibility defects and privacy incidents, both targeted at zero.
