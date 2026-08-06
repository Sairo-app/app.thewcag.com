import { useEffect, useState } from "react";
import { Check, FileText, Sparkle, Trash, UploadSimple, WarningCircle } from "./Icon";
import type { AuditLoggingProfile, AuditProject, AuditTemplateUpload, Finding } from "../shared/desktop";
import { auditLoggingLayouts, migrateFindingsToAuditLoggingProfile, normalizeAuditLoggingProfile } from "../shared/audit-logging-profile";
import { auditStoreKey, type RecordAuditActivity } from "./audits";
import { desktop, getStored, saveStoredFindings } from "./api";
import { messageFromError, useTransientMessage } from "./hooks";
import { AuditLoggingProfileEditor } from "./AuditLoggingProfileEditor";
import { Button, ConfirmDialog, Toast } from "./components";

export function AuditTemplateProjectSettings({
  audit,
  onAuditChange,
  recordActivity,
}: {
  audit: AuditProject;
  onAuditChange: (patch: Partial<AuditProject>) => void;
  recordActivity: RecordAuditActivity;
}) {
  const [upload, setUpload] = useState<AuditTemplateUpload | null>(null);
  const [preview, setPreview] = useState("");
  const [includedSheets, setIncludedSheets] = useState<string[]>([]);
  const [draft, setDraft] = useState<AuditLoggingProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [findingCount, setFindingCount] = useState(0);
  const [message, show] = useTransientMessage(6000);

  useEffect(() => {
    void getStored<Finding[]>(auditStoreKey(audit.id, "findings"), []).then((findings) => setFindingCount(findings.length));
  }, [audit.id]);

  function resetUpload() {
    setUpload(null);
    setPreview("");
    setIncludedSheets([]);
    setDraft(null);
  }

  async function chooseTemplate() {
    try {
      const selected = await desktop.invoke<AuditTemplateUpload | null>("dialog:open-audit-template");
      if (!selected) return;
      setUpload(selected);
      setPreview(selected.content);
      setIncludedSheets(selected.sheetNames);
      setDraft(null);
      setEditing(false);
    } catch (error) {
      show(messageFromError(error, "The audit template could not be opened."), true);
    }
  }

  function toggleSheet(sheetName: string) {
    if (!upload?.sheets) return;
    const next = includedSheets.includes(sheetName)
      ? includedSheets.filter((name) => name !== sheetName)
      : [...includedSheets, sheetName];
    setIncludedSheets(next);
    setPreview(upload.sheets.filter((sheet) => next.includes(sheet.name)).map((sheet) =>
      `[Sheet: ${sheet.name}]\n${sheet.rows.map((row) => row.values.join("\t")).join("\n")}${sheet.metadata?.length ? `\n[Worksheet rules]\n${sheet.metadata.join("\n")}` : ""}`,
    ).join("\n\n"));
  }

  async function analyze() {
    if (!upload || !preview.trim() || !includedSheets.length) return;
    setBusy(true);
    try {
      const profile = await desktop.invoke<AuditLoggingProfile>("ai:analyze-audit-template", {
        ...upload,
        content: preview,
        sheetNames: includedSheets,
      });
      setDraft(profile);
      show("AI mapping ready. Review every layout and field before applying it.");
    } catch (error) {
      show(messageFromError(error, "AI could not analyze this template."), true);
    } finally {
      setBusy(false);
    }
  }

  async function applyProfile(candidate: AuditLoggingProfile, token?: string) {
    setBusy(true);
    try {
      const normalized = normalizeAuditLoggingProfile({
        ...candidate,
        profileId: audit.loggingProfile?.profileId ?? candidate.profileId,
        revision: (audit.loggingProfile?.revision ?? 0) + 1,
      });
      let asset = audit.loggingTemplateAsset;
      if (token) {
        const saved = await desktop.invoke<Omit<NonNullable<AuditProject["loggingTemplateAsset"]>, "available">>("audit-template:attach", {
          auditId: audit.id,
          uploadToken: token,
        });
        asset = { ...saved, available: true };
      }
      const history = [
        ...(audit.loggingProfileHistory ?? []),
        ...(audit.loggingProfile ? [audit.loggingProfile] : []),
      ].slice(-10);
      const key = auditStoreKey(audit.id, "findings");
      const findings = await getStored<Finding[]>(key, []);
      const migrated = migrateFindingsToAuditLoggingProfile(findings, audit.loggingProfile, normalized);
      if (findings.length) await saveStoredFindings(key, findings, migrated);
      onAuditChange({
        loggingProfile: normalized,
        loggingProfileHistory: history.length ? history : undefined,
        loggingTemplateAsset: asset,
      });
      let activityWarning = "";
      try {
        await recordActivity({
          kind: "updated",
          title: audit.loggingProfile ? "Agency logging format updated" : "Agency logging format enabled",
          detail: `${normalized.layouts?.length ?? 1} layout${(normalized.layouts?.length ?? 1) === 1 ? "" : "s"}, revision ${normalized.revision}`,
        });
      } catch (error) {
        activityWarning = ` The mapping was applied, but its activity entry could not be saved: ${messageFromError(error)}`;
      }
      setEditing(false);
      resetUpload();
      show(`${findingCount ? `${findingCount} existing findings migrated. ` : ""}Agency format revision ${normalized.revision} is active.${activityWarning}`, Boolean(activityWarning));
    } catch (error) {
      show(messageFromError(error, "The agency logging format could not be applied."), true);
    } finally {
      setBusy(false);
    }
  }

  async function removeProfile() {
    setBusy(true);
    try {
      await desktop.invoke("audit-template:remove", { auditId: audit.id });
      const history = [...(audit.loggingProfileHistory ?? []), ...(audit.loggingProfile ? [audit.loggingProfile] : [])].slice(-10);
      onAuditChange({ loggingProfile: undefined, loggingProfileHistory: history, loggingTemplateAsset: undefined });
      let activityWarning = "";
      try {
        await recordActivity({ kind: "updated", title: "Agency logging format disabled", detail: "Existing finding values remain preserved." });
      } catch (error) {
        activityWarning = ` The format was disabled, but its activity entry could not be saved: ${messageFromError(error)}`;
      }
      setRemoveConfirm(false);
      show(`Standard finding authoring is active. Historical agency values were preserved.${activityWarning}`, Boolean(activityWarning));
    } catch (error) {
      show(messageFromError(error, "The agency logging format could not be removed."), true);
    } finally {
      setBusy(false);
    }
  }

  let draftError = "";
  if (draft) {
    try {
      normalizeAuditLoggingProfile(draft);
    } catch (error) {
      draftError = messageFromError(error, "Review the agency mapping before applying it.");
    }
  }

  return (
    <section className="settings-section audit-template-project-settings">
      <Toast message={message} />
      <div className="settings-intro">
        <h2>Agency finding format</h2>
        <p>Add or revise an optional agency workbook. AI proposes the mapping; an auditor approves it before it controls authoring and export.</p>
        {audit.loggingProfile ? (
          <div className="active-template-summary">
            <span><Check size={20} /></span>
            <div><strong>{audit.loggingProfile.templateName}</strong><small>Revision {audit.loggingProfile.revision ?? 1} · {auditLoggingLayouts(audit.loggingProfile).length} layout{auditLoggingLayouts(audit.loggingProfile).length === 1 ? "" : "s"} · {audit.loggingTemplateAsset?.available ? "original workbook retained" : "profile only"}</small></div>
          </div>
        ) : (
          <div className="active-template-summary is-empty"><span><FileText size={20} /></span><div><strong>Standard TheWCAG format</strong><small>No agency template is active.</small></div></div>
        )}
      </div>
      <div className="audit-template-project-body">
        {!upload && !editing ? (
          <div className="audit-template-project-actions">
            <Button icon={UploadSimple} onClick={() => void chooseTemplate()}>{audit.loggingProfile ? "Replace workbook" : "Add agency workbook"}</Button>
            {audit.loggingProfile ? <Button onClick={() => { setDraft(audit.loggingProfile!); setEditing(true); }}>Edit accepted mapping</Button> : null}
            {audit.loggingProfile ? <Button icon={Trash} onClick={() => setRemoveConfirm(true)}>Disable format</Button> : null}
          </div>
        ) : null}
        {!upload && !editing && audit.loggingProfileHistory?.length ? (
          <details className="audit-template-history">
            <summary>Previous accepted mappings ({audit.loggingProfileHistory.length})</summary>
            <ol>
              {[...audit.loggingProfileHistory].reverse().map((profile, index) => (
                <li key={`${profile.profileId ?? profile.templateName}-${profile.revision ?? index}`}>
                  <span><strong>{profile.templateName}</strong><small>Revision {profile.revision ?? 1} · {auditLoggingLayouts(profile).length} layout{auditLoggingLayouts(profile).length === 1 ? "" : "s"}</small></span>
                  <time dateTime={new Date(profile.analyzedAt).toISOString()}>{new Date(profile.analyzedAt).toLocaleDateString()}</time>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
        {upload && !draft ? (
          <div className="audit-template-project-preview">
            <div className="audit-template-file"><div><FileText size={20} /><span><strong>{upload.name}</strong><small>Review exactly what will be sent to AI.</small></span></div><button type="button" onClick={resetUpload}>Cancel</button></div>
            {upload.sheetNames.length > 1 ? <fieldset><legend>Worksheets to analyze</legend><div>{upload.sheetNames.map((name) => <label key={name}><input type="checkbox" checked={includedSheets.includes(name)} onChange={() => toggleSheet(name)} /><span>{name}</span></label>)}</div></fieldset> : null}
            <label><span>Extracted template data <small>Redact sensitive examples before analysis.</small></span><textarea rows={10} value={preview} onChange={(event) => setPreview(event.target.value)} /></label>
            <p className="audit-template-privacy">The file type, selected worksheet names, and this reviewed extraction are sent to the selected AI provider. The file name and source workbook stay local; the source is retained only after you approve the mapping.</p>
            <Button variant="primary" icon={Sparkle} disabled={busy || !preview.trim() || !includedSheets.length} onClick={() => void analyze()}>{busy ? "Analyzing" : "Analyze structure"}</Button>
          </div>
        ) : null}
        {draft ? (
          <div className="audit-template-project-review">
            <div className="profile-review-warning"><WarningCircle size={20} /><p><strong>Auditor approval required</strong> Confirm every mapping, rule, and worksheet position. {findingCount ? `Applying it will migrate ${findingCount} existing findings without deleting their values.` : ""}</p></div>
            <AuditLoggingProfileEditor profile={draft} onChange={setDraft} />
            {draftError ? <p className="audit-template-message is-error" role="alert">{draftError}</p> : null}
            <div className="audit-template-project-actions">
              <Button onClick={() => { setDraft(null); setEditing(false); }}>Cancel</Button>
              <Button variant="primary" icon={Check} disabled={busy || Boolean(draftError)} onClick={() => void applyProfile(draft, upload?.uploadToken)}>{busy ? "Applying" : "Approve and apply format"}</Button>
            </div>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={removeConfirm}
        title="Disable the agency format?"
        description="New finding authoring will return to the standard format. The accepted profile is retained in history and existing agency values stay on their findings. The locally retained workbook is removed."
        confirmLabel="Disable agency format"
        busy={busy}
        onCancel={() => setRemoveConfirm(false)}
        onConfirm={() => void removeProfile()}
      />
    </section>
  );
}
