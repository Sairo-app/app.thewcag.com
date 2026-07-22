"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportIssue, ReportIssueSeverity, ReportRemediationStatus } from "@/lib/schema";
import {
  DEFAULT_REPORT_ISSUE_QUERY,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
  filterAndSortReportIssues,
  reportIssueEmptyState,
  reportIssueStatus,
  type ReportIssueQuery,
  type ReportIssueSort,
} from "@/lib/report-view";

const SEVERITY_LABEL: Record<ReportIssueSeverity, string> = {
  blocker: "Blocker",
  major: "Major",
  minor: "Minor",
};

const STATUS_LABEL: Record<ReportRemediationStatus, string> = {
  open: "Open",
  retest: "Ready for retest",
  fixed: "Fixed",
  accepted: "Accepted",
};

interface ReportExplorerProps {
  title: string;
  issues: ReportIssue[];
  imageUrl: string;
  imageAlt: string;
}

export function ReportExplorer({ title, issues, imageUrl, imageAlt }: ReportExplorerProps) {
  const [query, setQuery] = useState<ReportIssueQuery>(DEFAULT_REPORT_ISSUE_QUERY);
  const [pendingFinding, setPendingFinding] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageTriggerRef = useRef<HTMLButtonElement>(null);

  const criteria = useMemo(() => {
    const sorted = filterAndSortReportIssues(issues, { ...DEFAULT_REPORT_ISSUE_QUERY, sort: "criterion" });
    return Array.from(new Set(sorted.flatMap((issue) => (issue.sc ? [issue.sc] : []))));
  }, [issues]);

  const visibleIssues = useMemo(() => filterAndSortReportIssues(issues, query), [issues, query]);
  const orderedIssues = useMemo(
    () => filterAndSortReportIssues(issues, { ...DEFAULT_REPORT_ISSUE_QUERY, sort: query.sort }),
    [issues, query.sort],
  );
  const visibleIssueNumbers = useMemo(() => new Set(visibleIssues.map((issue) => issue.n)), [visibleIssues]);
  const emptyState = reportIssueEmptyState(issues.length, visibleIssues.length);

  useEffect(() => {
    if (pendingFinding === null) return;
    const target = document.getElementById(`finding-${pendingFinding}`);
    if (!target) return;
    window.history.replaceState(null, "", `#finding-${pendingFinding}`);
    target.scrollIntoView({ block: "start" });
    target.focus({ preventScroll: true });
    setPendingFinding(null);
  }, [pendingFinding, query]);

  function updateQuery<Key extends keyof ReportIssueQuery>(key: Key, value: ReportIssueQuery[Key]) {
    setQuery((current) => ({ ...current, [key]: value }));
  }

  function prepareFindingJump(issue: ReportIssue) {
    return (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      const findingIsVisible = visibleIssueNumbers.has(issue.n);
      if (!findingIsVisible) setQuery(DEFAULT_REPORT_ISSUE_QUERY);
      setPendingFinding(issue.n);
    };
  }

  function openLightbox() {
    dialogRef.current?.showModal();
  }

  function closeLightbox() {
    dialogRef.current?.close();
  }

  return (
    <>
      <div className="report-visual-grid">
        <section id="report-screenshot" className="report-image" aria-labelledby="report-screenshot-title">
          <div className="report-section-heading">
            <div>
              <p className="report-eyebrow">Audit evidence</p>
              <h2 id="report-screenshot-title">Annotated screenshot</h2>
            </div>
            <p>{issues.length === 0 ? "No markers published" : `${issues.length} numbered ${issues.length === 1 ? "marker" : "markers"}`}</p>
          </div>
          <div className="report-image__frame">
            <button
              ref={imageTriggerRef}
              type="button"
              className="report-image__trigger"
              aria-haspopup="dialog"
              aria-describedby="report-screenshot-help"
              onClick={openLightbox}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={imageAlt} />
              <span className="report-image__action" aria-hidden="true">Open full size</span>
              <span className="sr-only">Open annotated screenshot in full-screen viewer</span>
            </button>
          </div>
          <p id="report-screenshot-help" className="report-image__help">
            Activate the image to inspect it at full size. Every annotation is also available as text in the findings list.
          </p>
        </section>

        <nav className="report-severity-summary" aria-labelledby="report-severity-title">
          <div className="report-section-heading">
            <div>
              <p className="report-eyebrow">Finding index</p>
              <h2 id="report-severity-title">Jump by severity</h2>
            </div>
          </div>
          {issues.length > 0 ? (
            <div className="report-severity-groups">
              {REPORT_SEVERITIES.map((severity) => {
                const matchingIssues = issues.filter((issue) => issue.severity === severity);
                return (
                  <section key={severity} className="report-severity-group" data-severity={severity}>
                    <h3>
                      <span>{SEVERITY_LABEL[severity]}</span>
                      <span>{matchingIssues.length}</span>
                    </h3>
                    {matchingIssues.length > 0 ? (
                      <ol>
                        {matchingIssues.map((issue) => (
                          <li key={issue.n}>
                            <a href={`#finding-${issue.n}`} onClick={prepareFindingJump(issue)}>
                              <span>Finding {issue.n}</span>
                              <span>{issue.label}</span>
                            </a>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>No {severity} findings</p>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="report-empty-state report-empty-state--compact">
              <h3>No findings published</h3>
              <p>This shared report contains an annotated screenshot but no finding records.</p>
            </div>
          )}
        </nav>
      </div>

      <section id="report-findings" className="report-findings-section" aria-labelledby="report-findings-title">
        <div className="report-findings-heading">
          <div>
            <p className="report-eyebrow">Detailed review</p>
            <h2 id="report-findings-title">Findings</h2>
            <p>Filter the published findings, then follow each numbered item back to its screenshot marker.</p>
          </div>
          {issues.length > 0 && (
            <p className="report-result-count" role="status" aria-live="polite">
              Showing {visibleIssues.length} of {issues.length}
            </p>
          )}
        </div>

        {issues.length > 0 && (
          <form className="report-controls" onSubmit={(event) => event.preventDefault()}>
            <div>
              <label htmlFor="report-filter-severity">Severity</label>
              <select
                id="report-filter-severity"
                value={query.severity}
                onChange={(event) => updateQuery("severity", event.target.value as ReportIssueQuery["severity"])}
              >
                <option value="all">All severities</option>
                {REPORT_SEVERITIES.map((severity) => <option key={severity} value={severity}>{SEVERITY_LABEL[severity]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="report-filter-criterion">WCAG criterion</label>
              <select
                id="report-filter-criterion"
                value={query.criterion}
                onChange={(event) => updateQuery("criterion", event.target.value)}
              >
                <option value="all">All criteria</option>
                {criteria.map((criterion) => <option key={criterion} value={criterion}>WCAG {criterion}</option>)}
                {issues.some((issue) => !issue.sc) && <option value="unmapped">Not mapped</option>}
              </select>
            </div>
            <div>
              <label htmlFor="report-filter-status">Remediation status</label>
              <select
                id="report-filter-status"
                value={query.status}
                onChange={(event) => updateQuery("status", event.target.value as ReportIssueQuery["status"])}
              >
                <option value="all">All statuses</option>
                {REPORT_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="report-sort">Sort by</label>
              <select
                id="report-sort"
                value={query.sort}
                onChange={(event) => updateQuery("sort", event.target.value as ReportIssueSort)}
              >
                <option value="number">Finding number</option>
                <option value="severity">Severity</option>
                <option value="criterion">WCAG criterion</option>
                <option value="status">Remediation status</option>
              </select>
            </div>
            <button type="button" onClick={() => setQuery(DEFAULT_REPORT_ISSUE_QUERY)}>
              Reset filters
            </button>
          </form>
        )}

        {emptyState === "no-findings" && (
          <div className="report-empty-state">
            <h3>No findings to review</h3>
            <p>The publisher did not include any finding records in this report.</p>
          </div>
        )}

        {emptyState === "no-matches" && (
          <div className="report-empty-state" role="status">
            <h3>No findings match these filters</h3>
            <p>Try a different severity, WCAG criterion, or remediation status.</p>
            <button type="button" onClick={() => setQuery(DEFAULT_REPORT_ISSUE_QUERY)}>Clear all filters</button>
          </div>
        )}

        {issues.length > 0 && (
          <ol className="report-findings-list" aria-label="Published accessibility findings">
            {orderedIssues.map((issue) => {
              const status = reportIssueStatus(issue);
              return (
                <li key={issue.n} hidden={!visibleIssueNumbers.has(issue.n)}>
                  <article id={`finding-${issue.n}`} className="report-finding" tabIndex={-1} data-severity={issue.severity}>
                    <div className="report-finding__number" aria-hidden="true">{issue.n}</div>
                    <div className="report-finding__body">
                      <div className="report-finding__meta">
                        <span className="report-tag" data-severity={issue.severity}>{SEVERITY_LABEL[issue.severity]}</span>
                        <span className="report-tag" data-status={status}>{STATUS_LABEL[status]}</span>
                        {issue.sc && <span className="report-tag report-tag--criterion">WCAG {issue.sc}</span>}
                      </div>
                      <h3>Finding {issue.n}: {issue.label}</h3>
                      {issue.note ? <p>{issue.note}</p> : <p className="report-finding__empty-note">No remediation note was provided.</p>}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <dialog
        ref={dialogRef}
        className="report-lightbox"
        aria-labelledby="report-lightbox-title"
        aria-describedby="report-lightbox-description"
        onClose={() => imageTriggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeLightbox();
        }}
      >
        <div className="report-lightbox__panel">
          <div className="report-lightbox__header">
            <div>
              <h2 id="report-lightbox-title">Annotated screenshot</h2>
              <p id="report-lightbox-description">{title}. Press Escape or use Close to return to the report.</p>
            </div>
            <button type="button" onClick={closeLightbox}>Close</button>
          </div>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={imageAlt} />
            <figcaption>Full annotation text is available in the findings section after this viewer.</figcaption>
          </figure>
        </div>
      </dialog>
    </>
  );
}
