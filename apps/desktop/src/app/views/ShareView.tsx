import { useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  Check,
  Clipboard,
  Eye,
  FileText,
  LockKey,
  ShareNetwork,
  SignIn,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  Account,
  AuditProject,
  CaptureEntry,
  Finding,
  PublishedReport,
  WorkspaceStage,
} from "../../shared/desktop";
import { desktop, getStored, listCaptures, setStored } from "../api";
import { auditStoreKey, type RecordAuditActivity } from "../audits";
import { Button, EmptyState, Field, StatusBadge, Toast } from "../components";
import { useTransientMessage } from "../hooks";
import { ISSUE_TYPES, parseDoc } from "../../lib/annotate/model";
import { renderDoc } from "../../lib/annotate/render";

async function renderCapture(entry: CaptureEntry): Promise<string> {
  const [raw, image] = await Promise.all([
    desktop.invoke<string | null>("capture:read-document", { id: entry.id }),
    new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () =>
        reject(new Error("The selected capture could not be loaded"));
      next.src = entry.assetUrl;
    }),
  ]);
  const doc = parseDoc(raw || "");
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / image.naturalWidth);
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  renderDoc(source.getContext("2d")!, image, doc?.shapes ?? [], {
    selectedId: null,
    forExport: true,
  });
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png").split(",")[1];
}

export function ShareView({
  audit,
  recordActivity,
  onNavigate,
}: {
  audit: AuditProject;
  recordActivity: RecordAuditActivity;
  onNavigate: (stage: WorkspaceStage) => void;
}) {
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reports, setReports] = useState<PublishedReport[]>([]);
  const [account, setAccount] = useState<Account>({ signedIn: false });
  const [captureId, setCaptureId] = useState("");
  const [title, setTitle] = useState(`${audit.project} accessibility report`);
  const [description, setDescription] = useState(
    audit.scope || `Accessibility review for ${audit.target || audit.project}.`,
  );
  const [attested, setAttested] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [message, show] = useTransientMessage(5000);
  const reportsKey = auditStoreKey(audit.id, "reports");

  useEffect(() => {
    void Promise.all([
      listCaptures(audit.id),
      getStored<Finding[]>(auditStoreKey(audit.id, "findings"), []),
      getStored<PublishedReport[]>(reportsKey, []),
      desktop.invoke<Account>("auth:account"),
    ])
      .then(([nextCaptures, nextFindings, nextReports, nextAccount]) => {
        setCaptures(nextCaptures);
        setFindings(nextFindings);
        setReports(nextReports);
        setAccount(nextAccount);
        setCaptureId((current) => current || nextCaptures[0]?.id || "");
      })
      .catch((error) => show(String(error), true));
    return desktop.on(
      "account:changed",
      () => void desktop.invoke<Account>("auth:account").then(setAccount),
    );
  }, [audit.id]);

  const selectedCapture =
    captures.find((capture) => capture.id === captureId) ?? null;
  const includedFindings = useMemo(
    () =>
      findings.filter(
        (finding) =>
          finding.status !== "accepted" &&
          (!finding.captureId || finding.captureId === captureId),
      ),
    [captureId, findings],
  );
  const ready = Boolean(
    selectedCapture &&
      title.trim() &&
      description.trim() &&
      attested &&
      includedFindings.length &&
      account.signedIn,
  );

  async function signIn() {
    try {
      await desktop.invoke("auth:sign-in");
      show("Complete sign in in your browser");
    } catch (error) {
      show(String(error), true);
    }
  }

  async function publish() {
    if (!ready || !selectedCapture || publishing) return;
    setPublishing(true);
    try {
      const imageBase64 = await renderCapture(selectedCapture);
      const issues = includedFindings.map((finding, index) => ({
        n: index + 1,
        sc: finding.wcag || undefined,
        label: finding.title,
        severity: finding.severity,
        note: finding.note,
      }));
      const url = await desktop.invoke<string>("report:publish", {
        title: title.trim(),
        description: description.trim(),
        issues,
        imageBase64,
      });
      if (!url)
        throw new Error("The report service did not return a share link");
      const report: PublishedReport = {
        id: crypto.randomUUID(),
        auditId: audit.id,
        captureId,
        title: title.trim(),
        url,
        findingCount: issues.length,
        createdAt: Date.now(),
      };
      const next = [report, ...reports].slice(0, 40);
      setReports(next);
      await Promise.all([
        setStored(reportsKey, next),
        desktop.invoke("clipboard:write-text", { text: url }),
        recordActivity({
          kind: "published",
          title: "Report published",
          detail: `${issues.length} findings`,
          url,
        }),
      ]);
      setPublishedUrl(url);
      show("Report published. Link copied to clipboard.");
    } catch (error) {
      show(String(error), true);
    } finally {
      setPublishing(false);
    }
  }

  if (!captures.length || !findings.length)
    return (
      <div className="share-view">
        <EmptyState
          icon={FileText}
          title="Build the report evidence first"
          body="A report needs at least one capture and one finding. Add evidence, review it, then return here to publish."
          action={
            <Button variant="primary" onClick={() => onNavigate("evidence")}>
              Go to evidence
            </Button>
          }
        />
      </div>
    );

  return (
    <div className="share-view">
      <Toast message={message} />
      {publishedUrl ? (
        <section className="publish-success" role="status">
          <span>
            <Check size={22} weight="bold" />
          </span>
          <div>
            <strong>Report is live</strong>
            <p>
              The public link is ready and has been copied to your clipboard.
            </p>
            <code>{publishedUrl}</code>
          </div>
          <div>
            <Button
              icon={Clipboard}
              onClick={() =>
                void desktop.invoke("clipboard:write-text", {
                  text: publishedUrl,
                })
              }
            >
              Copy link
            </Button>
            <Button
              variant="primary"
              icon={ArrowSquareOut}
              onClick={() =>
                void desktop.invoke("shell:open-external", {
                  url: publishedUrl,
                })
              }
            >
              Open report
            </Button>
          </div>
        </section>
      ) : null}

      <div className="report-layout">
        <section className="report-draft">
          <div className="report-section-heading">
            <span>
              <FileText size={19} weight="duotone" />
            </span>
            <div>
              <h2>Report draft</h2>
              <p>Review every public detail before publishing.</p>
            </div>
            <StatusBadge tone="neutral">Draft</StatusBadge>
          </div>
          <Field label="Evidence capture">
            <select
              value={captureId}
              onChange={(event) => setCaptureId(event.target.value)}
            >
              {captures.map((capture) => (
                <option key={capture.id} value={capture.id}>
                  {capture.title} · {capture.issues} issues
                </option>
              ))}
            </select>
          </Field>
          <Field label="Report title">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
            />
          </Field>
          <Field label="Public summary" hint={`${description.length}/600`}>
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value.slice(0, 600))
              }
              rows={5}
            />
          </Field>
          <div className="access-row">
            <LockKey size={19} weight="duotone" />
            <span>
              <strong>Anyone with the link</strong>
              <small>
                The link is unlisted. Recipients do not need an account.
              </small>
            </span>
            <StatusBadge tone="warning">Public link</StatusBadge>
          </div>
          <label className="attestation">
            <input
              type="checkbox"
              checked={attested}
              onChange={(event) => setAttested(event.target.checked)}
            />
            <span>
              <strong>
                I reviewed this capture for sensitive information.
              </strong>
              <small>
                Redactions are baked into the published image and cannot be
                reversed.
              </small>
            </span>
          </label>
        </section>

        <aside className="report-preview" aria-label="Report preview">
          <div className="report-section-heading">
            <span>
              <Eye size={19} weight="duotone" />
            </span>
            <div>
              <h2>Included evidence</h2>
              <p>Exactly what recipients will see.</p>
            </div>
          </div>
          {selectedCapture ? (
            <div className="report-capture">
              <img
                src={selectedCapture.thumbnailUrl || selectedCapture.assetUrl}
                alt={`Selected evidence: ${selectedCapture.title}`}
              />
              <span>
                {selectedCapture.width} × {selectedCapture.height}
              </span>
            </div>
          ) : null}
          <div className="included-findings">
            <div>
              <strong>{includedFindings.length} findings included</strong>
              <small>Accepted risks are excluded</small>
            </div>
            {includedFindings.slice(0, 6).map((finding) => (
              <article key={finding.key}>
                <i className={`severity-${finding.severity}`} />
                <span>
                  <strong>{finding.title}</strong>
                  <small>{finding.wcag || ISSUE_TYPES.at(-1)?.label}</small>
                </span>
                <StatusBadge
                  tone={
                    finding.severity === "blocker"
                      ? "danger"
                      : finding.severity === "major"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {finding.severity}
                </StatusBadge>
              </article>
            ))}
            {includedFindings.length > 6 ? (
              <p>And {includedFindings.length - 6} more findings</p>
            ) : null}
          </div>
          {!account.signedIn ? (
            <div className="sign-in-callout">
              <WarningCircle size={20} weight="duotone" />
              <div>
                <strong>Sign in to publish</strong>
                <p>Your local audit remains available without an account.</p>
              </div>
              <Button icon={SignIn} onClick={() => void signIn()}>
                Sign in
              </Button>
            </div>
          ) : (
            <div className="signed-in-line">
              <Check size={16} weight="bold" />
              <span>Publishing as {account.email}</span>
            </div>
          )}
          <Button
            className="publish-button"
            variant="primary"
            icon={ShareNetwork}
            disabled={!ready || publishing}
            onClick={() => void publish()}
          >
            {publishing ? "Publishing report" : "Publish report"}
          </Button>
          {!attested ? (
            <p className="publish-hint">
              Confirm the privacy review to enable publishing.
            </p>
          ) : !includedFindings.length ? (
            <p className="publish-hint">
              This capture has no included findings.
            </p>
          ) : null}
        </aside>
      </div>

      {reports.length ? (
        <section className="report-history">
          <div className="section-heading">
            <h2>Published reports</h2>
            <button
              onClick={() =>
                void desktop.invoke("shell:open-external", {
                  url: "https://app.thewcag.com/screenshots",
                })
              }
            >
              Manage online
            </button>
          </div>
          {reports.slice(0, 5).map((report) => (
            <button
              key={report.id}
              onClick={() =>
                void desktop.invoke("shell:open-external", { url: report.url })
              }
            >
              <ShareNetwork size={17} />
              <span>
                <strong>{report.title}</strong>
                <small>
                  {report.findingCount} findings ·{" "}
                  {new Date(report.createdAt).toLocaleDateString()}
                </small>
              </span>
              <ArrowSquareOut size={16} />
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
