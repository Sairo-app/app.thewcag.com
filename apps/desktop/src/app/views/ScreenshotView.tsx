import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowSquareOut,
  Camera,
  Clipboard,
  DownloadSimple,
  FrameCorners,
  Image,
  MagnifyingGlass,
  NotePencil,
  ShareNetwork,
  SignIn,
  Trash,
  X,
} from "../Icon";
import type { Account, CaptureEntry } from "../../shared/desktop";
import { issueTypeOf, parseDoc } from "../../lib/annotate/model";
import { desktop, listCaptures } from "../api";
import { renderCaptureDataUrl } from "../capture-render";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  StatusBadge,
  Toast,
} from "../components";
import { messageFromError, useTransientMessage } from "../hooks";
import { LatestRequest } from "../latest-request";

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

export function ScreenshotView({
  shareCaptureId = "",
  onShareHandled,
}: {
  shareCaptureId?: string;
  onShareHandled?: () => void;
}) {
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CaptureEntry | null>(null);
  const [shareTarget, setShareTarget] = useState<CaptureEntry | null>(null);
  const [shareTitle, setShareTitle] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareApproved, setShareApproved] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [account, setAccount] = useState<Account>({ signedIn: false });
  const [message, show, clearMessage] = useTransientMessage(5000);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const captureLoader = useRef(new LatestRequest<CaptureEntry[]>());

  async function loadCaptureLibrary(): Promise<CaptureEntry[] | null> {
    return captureLoader.current.run(
      () => listCaptures(undefined, { unscoped: true }),
      setCaptures,
    );
  }

  async function refresh() {
    await loadCaptureLibrary();
  }

  function reportLoadFailure(error: unknown) {
    show(messageFromError(error, "The screenshot library could not be loaded."), true);
  }

  function openCapture(id: string) {
    void desktop.invoke("capture:open", { id })
      .catch((error) => show(messageFromError(error, "The capture could not be opened."), true));
  }

  useEffect(() => {
    void Promise.all([loadCaptureLibrary(), desktop.invoke<Account>("auth:account")])
      .then(([, nextAccount]) => setAccount(nextAccount))
      .catch(reportLoadFailure);
    const offCapture = desktop.on("capture:saved", () => {
      void loadCaptureLibrary().catch(reportLoadFailure);
    });
    const offAccount = desktop.on("account:changed", () =>
      void desktop.invoke<Account>("auth:account")
        .then(setAccount)
        .catch((error) => show(messageFromError(error, "Account status could not be refreshed."), true)),
    );
    return () => {
      captureLoader.current.invalidate();
      offCapture();
      offAccount();
    };
  }, []);

  useEffect(() => {
    const dialog = shareDialog.current;
    if (!dialog) return;
    if (shareTarget && !dialog.open) dialog.showModal();
    if (!shareTarget && dialog.open) dialog.close();
  }, [shareTarget]);

  const filtered = useMemo(
    () =>
      captures.filter((capture) =>
        capture.title.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [captures, query],
  );

  async function startCapture(full = false) {
    if (busy) return;
    setBusy(true);
    try {
      if (full) {
        await desktop.invoke("capture:fullscreen", { standalone: true });
      } else {
        await desktop.invoke("capture:begin", {
          mode: "capture",
          standalone: true,
        });
      }
      await refresh();
      show(full ? "Full screen captured" : "Drag to select an area");
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function copyOrExport(entry: CaptureEntry, copy: boolean) {
    const action = copy ? "copy" : "export";
    setWorking(`${action}-${entry.id}`);
    try {
      const pngDataUrl = await renderCaptureDataUrl(entry);
      if (copy) {
        await desktop.invoke("clipboard:write-image", { pngDataUrl });
        show("Annotated screenshot copied");
      } else {
        const path = await desktop.invoke<string | null>("dialog:save-image", {
          name: `${entry.title}.png`,
          pngDataUrl,
        });
        if (path) show("Annotated PNG exported");
      }
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setWorking("");
    }
  }

  async function deleteCapture() {
    if (!deleteTarget) return;
    setWorking(`delete-${deleteTarget.id}`);
    try {
      await desktop.invoke("capture:delete", { id: deleteTarget.id });
      setDeleteTarget(null);
      await refresh();
      show("Screenshot deleted");
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setWorking("");
    }
  }

  function openShare(entry: CaptureEntry) {
    clearMessage();
    setShareTarget(entry);
    setShareTitle(entry.title);
    setShareDescription("");
    setShareApproved(false);
    setPublishedUrl("");
  }

  useEffect(() => {
    if (!shareCaptureId) return;
    void loadCaptureLibrary()
      .then((next) => {
        if (!next) return;
        const target = next.find((entry) => entry.id === shareCaptureId);
        if (target) openShare(target);
        else show("The screenshot selected for sharing is no longer available.", true);
      })
      .catch((error) => show(messageFromError(error, "The screenshot selected for sharing could not be loaded."), true))
      .finally(() => onShareHandled?.());
  }, [shareCaptureId]);

  function closeShare() {
    if (working === "publish") return;
    setShareTarget(null);
  }

  async function signIn() {
    try {
      await desktop.invoke("auth:sign-in");
      show("Complete sign in in your browser");
    } catch (error) {
      show(messageFromError(error), true);
    }
  }

  async function publish() {
    if (
      !shareTarget ||
      !shareTitle.trim() ||
      !shareApproved ||
      !account.signedIn ||
      working === "publish"
    ) return;
    setWorking("publish");
    try {
      const [pngDataUrl, rawDocument] = await Promise.all([
        renderCaptureDataUrl(shareTarget, 1600),
        desktop.invoke<string | null>("capture:read-document", {
          id: shareTarget.id,
        }),
      ]);
      const annotationDocument = parseDoc(rawDocument || "");
      const badges = (annotationDocument?.shapes ?? []).filter(
        (shape) => shape.kind === "badge",
      );
      const issues = badges.map((shape, index) => {
        const issue = issueTypeOf(shape);
        return {
          id: shape.findingId,
          n: index + 1,
          sc: issue.sc || undefined,
          label: issue.label || `Issue ${index + 1}`,
          severity: shape.severity || "major",
          note: shape.note || issue.template,
        };
      });
      const url = await desktop.invoke<string>("report:publish", {
        title: shareTitle.trim(),
        description: shareDescription.trim(),
        issues,
        imageBase64: pngDataUrl.split(",")[1] || "",
      });
      if (!url) throw new Error("The sharing service did not return a link");
      await desktop.invoke("clipboard:write-text", { text: url });
      setPublishedUrl(url);
      show("Share link created and copied");
    } catch (error) {
      show(messageFromError(error), true);
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="screenshot-view">
      {!shareTarget ? <Toast message={message} /> : null}

      <section className="capture-banner screenshot-banner">
        <div className="capture-illustration">
          <FrameCorners size={32} />
          <span><Camera size={16} /></span>
        </div>
        <div>
          <span className="section-label">Standalone screenshot workspace</span>
          <h2>Capture, explain, and share without an audit</h2>
          <p>
            Use your own audit process. Screenshots stay local while you annotate,
            copy, or export them, and only upload when you create a share link.
          </p>
        </div>
        <div className="capture-actions">
          <Button
            variant="primary"
            icon={FrameCorners}
            disabled={busy}
            onClick={() => void startCapture(false)}
          >
            Select region
          </Button>
          <Button
            icon={Camera}
            disabled={busy}
            onClick={() => void startCapture(true)}
          >
            Full screen
          </Button>
        </div>
      </section>

      <div className="screenshot-toolbar">
        <div>
          <strong>Your screenshots</strong>
          <span>{captures.length} stored locally outside every audit</span>
        </div>
        <label className="search-field">
          <MagnifyingGlass size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search screenshots"
            aria-label="Search screenshots"
          />
        </label>
        <Button icon={FrameCorners} onClick={() => void startCapture(false)}>
          New screenshot
        </Button>
      </div>

      <section className="capture-library screenshot-library" aria-label="Standalone screenshots">
        {filtered.length ? (
          filtered.map((entry) => (
            <article className="capture-card screenshot-card" key={entry.id}>
              <button
                className="capture-thumb"
                onClick={() => openCapture(entry.id)}
              >
                {entry.thumbnailUrl || entry.assetUrl ? (
                  <img
                    src={entry.thumbnailUrl || entry.assetUrl}
                    alt={`Preview of ${entry.title}`}
                  />
                ) : (
                  <Image size={20} />
                )}
                {entry.issues ? (
                  <span>{entry.issues} issue{entry.issues === 1 ? "" : "s"}</span>
                ) : null}
              </button>
              <div className="capture-meta screenshot-meta">
                <div>
                  <strong>{entry.title}</strong>
                  <span>{entry.width} × {entry.height} · {dateLabel(entry.createdAt)}</span>
                </div>
              </div>
              <div className="screenshot-card-actions" aria-label={`Actions for ${entry.title}`}>
                <button
                  onClick={() => openCapture(entry.id)}
                  aria-label={`Annotate ${entry.title}`}
                  title="Annotate"
                ><NotePencil size={20} /></button>
                <button
                  disabled={Boolean(working)}
                  onClick={() => void copyOrExport(entry, true)}
                  aria-label={`Copy ${entry.title}`}
                  title="Copy"
                ><Clipboard size={20} /></button>
                <button
                  disabled={Boolean(working)}
                  onClick={() => void copyOrExport(entry, false)}
                  aria-label={`Export ${entry.title}`}
                  title="Export PNG"
                ><DownloadSimple size={20} /></button>
                <button
                  onClick={() => openShare(entry)}
                  aria-label={`Share ${entry.title}`}
                  title="Create share link"
                ><ShareNetwork size={20} /></button>
                <button
                  onClick={() => setDeleteTarget(entry)}
                  aria-label={`Delete ${entry.title}`}
                  title="Delete"
                ><Trash size={20} /></button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            icon={Camera}
            title={query ? "No matching screenshots" : "No standalone screenshots yet"}
            body={
              query
                ? "Try a different title."
                : "Capture any app or screen, annotate it, then copy, export, or share it in your own workflow."
            }
            action={
              !query ? (
                <Button
                  variant="primary"
                  icon={FrameCorners}
                  onClick={() => void startCapture(false)}
                >
                  Capture a region
                </Button>
              ) : undefined
            }
          />
        )}
      </section>

      <dialog
        ref={shareDialog}
        className="modal-dialog screenshot-share-dialog"
        aria-labelledby="screenshot-share-title"
        onCancel={(event) => {
          event.preventDefault();
          closeShare();
        }}
        onClose={() => {
          if (shareTarget && working !== "publish") setShareTarget(null);
        }}
      >
        <Toast message={message} />
        <div className="screenshot-share-heading">
          <div>
            <span>Unlisted web link</span>
            <h2 id="screenshot-share-title">Share this screenshot</h2>
          </div>
          <button aria-label="Close sharing" onClick={closeShare} disabled={working === "publish"}>
            <X size={20} />
          </button>
        </div>

        {publishedUrl ? (
          <div className="screenshot-share-success" role="status">
            <StatusBadge tone="success">Link ready</StatusBadge>
            <p>Anyone with this unlisted link can view the annotated screenshot.</p>
            <code>{publishedUrl}</code>
            <div>
              <Button
                icon={Clipboard}
                onClick={() => void desktop.invoke("clipboard:write-text", { text: publishedUrl })
                  .then(() => show("Share link copied"))
                  .catch((error) => show(messageFromError(error, "The share link could not be copied."), true))}
              >
                Copy link
              </Button>
              <Button
                variant="primary"
                icon={ArrowSquareOut}
                onClick={() => void desktop.invoke("shell:open-external", { url: publishedUrl })
                  .catch((error) => show(messageFromError(error, "The published screenshot could not be opened."), true))}
              >
                Open link
              </Button>
            </div>
          </div>
        ) : (
          <>
            {shareTarget ? (
              <div className="screenshot-share-preview">
                <img src={shareTarget.thumbnailUrl || shareTarget.assetUrl} alt="" />
                <span>{shareTarget.issues} issue badge{shareTarget.issues === 1 ? "" : "s"} included</span>
              </div>
            ) : null}
            <div className="screenshot-share-fields">
              <Field label="Link title">
                <input
                  value={shareTitle}
                  maxLength={140}
                  onChange={(event) => setShareTitle(event.target.value)}
                />
              </Field>
              <Field label="Context" hint="Optional. Explain what the reviewer should look at.">
                <textarea
                  value={shareDescription}
                  maxLength={500}
                  onChange={(event) => setShareDescription(event.target.value)}
                />
              </Field>
              <label className="screenshot-share-consent">
                <input
                  type="checkbox"
                  checked={shareApproved}
                  onChange={(event) => setShareApproved(event.target.checked)}
                />
                <span>I reviewed the image and understand that anyone with the link can view it.</span>
              </label>
            </div>
            <div className="screenshot-share-actions">
              <span>{account.signedIn ? "Signed in and ready to publish" : "Sign in is required only to create a link"}</span>
              {account.signedIn ? (
                <Button
                  variant="primary"
                  icon={ShareNetwork}
                  disabled={!shareTitle.trim() || !shareApproved || working === "publish"}
                  onClick={() => void publish()}
                >
                  {working === "publish" ? "Creating link" : "Create share link"}
                </Button>
              ) : (
                <Button variant="primary" icon={SignIn} onClick={() => void signIn()}>
                  Sign in to share
                </Button>
              )}
            </div>
          </>
        )}
      </dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.title || "screenshot"}?`}
        description="This permanently removes the screenshot and its editable annotations from this computer."
        confirmLabel="Delete screenshot"
        busy={working.startsWith("delete-")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteCapture()}
      />
    </div>
  );
}
