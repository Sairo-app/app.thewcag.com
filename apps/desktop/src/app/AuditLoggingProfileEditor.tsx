import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash } from "./Icon";
import { ConfirmDialog } from "./components";
import type {
  AuditLoggingField,
  AuditLoggingLayout,
  AuditLoggingProfile,
  AuditLoggingSourceField,
} from "../shared/desktop";
import { auditLoggingLayouts } from "../shared/audit-logging-profile";

const SOURCE_OPTIONS: Array<{ value: AuditLoggingSourceField; label: string }> = [
  ["title", "Issue title"], ["description", "Description"], ["actualResult", "Actual result"],
  ["expectedResult", "Expected result"], ["userImpact", "User impact"], ["affectedUsers", "Affected users"], ["wcag", "WCAG criterion"],
  ["severity", "Severity"], ["severityRationale", "Severity rationale"], ["recommendation", "Recommendation"],
  ["reproductionSteps", "Reproduction steps"], ["location", "Location"], ["owner", "Owner"],
  ["dueDate", "Due date"], ["status", "Status"], ["evidenceLink", "Evidence link"],
  ["note", "Internal note"], ["ticket", "Ticket or reference"], ["riskAcceptance", "Risk acceptance rationale"],
  ["retestNote", "Retest record"], ["comparisonNote", "Before/after comparison"], ["custom", "Agency-specific value"],
].map(([value, label]) => ({ value: value as AuditLoggingSourceField, label }));

function slug(value: string, fallback: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54) || fallback;
}

function mappingsText(field: AuditLoggingField): string {
  return (field.valueMappings ?? []).map((mapping) => `${mapping.agencyValue} = ${mapping.nativeValue}`).join("\n");
}

function parseMappings(value: string): NonNullable<AuditLoggingField["valueMappings"]> {
  return value.split("\n").flatMap((line) => {
    const separator = line.indexOf("=");
    if (separator < 1) return [];
    const agencyValue = line.slice(0, separator).trim();
    const nativeValue = line.slice(separator + 1).trim();
    return agencyValue && nativeValue ? [{ agencyValue, nativeValue }] : [];
  });
}

function rulesText(field: AuditLoggingField): string {
  return (field.requiredWhen ?? []).map((rule) => `${rule.fieldId} | ${rule.operator} | ${rule.value}`).join("\n");
}

function parseRules(value: string): NonNullable<AuditLoggingField["requiredWhen"]> {
  return value.split("\n").flatMap((line) => {
    const [fieldId, operator, ...rest] = line.split("|").map((part) => part.trim());
    if (!fieldId || !["equals", "not-equals", "empty", "not-empty"].includes(operator)) return [];
    return [{
      fieldId: slug(fieldId, "field"),
      operator: operator as "equals" | "not-equals" | "empty" | "not-empty",
      value: rest.join(" | ").trim(),
    }];
  });
}

function nextField(layout: AuditLoggingLayout): AuditLoggingField {
  let number = layout.fields.length + 1;
  while (layout.fields.some((field) => field.id === `custom-field-${number}`)) number += 1;
  const usedColumns = new Set(layout.fields.map((field, index) => field.columnIndex ?? index + 1));
  let columnIndex = 1;
  while (usedColumns.has(columnIndex) && columnIndex < 200) columnIndex += 1;
  return {
    id: `custom-field-${number}`,
    label: `Custom field ${number}`,
    sourceField: "custom",
    kind: "text",
    required: false,
    instructions: "",
    options: [],
    columnIndex,
  };
}

export function AuditLoggingProfileEditor({
  profile,
  onChange,
}: {
  profile: AuditLoggingProfile;
  onChange: (profile: AuditLoggingProfile) => void;
}) {
  const layouts = auditLoggingLayouts(profile);
  const [removeLayoutId, setRemoveLayoutId] = useState<string | null>(null);
  const [patternDrafts, setPatternDrafts] = useState<Record<string, string>>({});
  const [patternErrors, setPatternErrors] = useState<Record<string, string>>({});

  function clampedNumber(raw: string, min: number, max: number, fallback: number): number {
    if (!raw.trim()) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }

  function optionalClampedNumber(raw: string, min: number, max: number): number | undefined {
    if (!raw.trim()) return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }

  function patchPattern(layoutId: string, field: AuditLoggingField, raw: string) {
    setPatternDrafts((current) => ({ ...current, [field.id]: raw }));
    if (!raw.trim()) {
      setPatternErrors((current) => ({ ...current, [field.id]: "" }));
      patchField(layoutId, field.id, { validation: { ...field.validation, pattern: undefined } });
      return;
    }
    try {
      new RegExp(raw);
      setPatternErrors((current) => ({ ...current, [field.id]: "" }));
      patchField(layoutId, field.id, { validation: { ...field.validation, pattern: raw } });
    } catch {
      setPatternErrors((current) => ({ ...current, [field.id]: "This is not a valid regular expression, so it has not been applied." }));
    }
  }

  function replaceLayouts(next: AuditLoggingLayout[]) {
    onChange({ ...profile, layouts: next, sheetName: next[0]?.sheetName, fields: next[0]?.fields ?? [] });
  }

  function patchLayout(layoutId: string, patch: Partial<AuditLoggingLayout>) {
    replaceLayouts(layouts.map((layout) => layout.id === layoutId ? { ...layout, ...patch } : layout));
  }

  function patchField(layoutId: string, fieldId: string, patch: Partial<AuditLoggingField>) {
    replaceLayouts(layouts.map((layout) => layout.id === layoutId ? {
      ...layout,
      fields: layout.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field),
    } : layout));
  }

  function moveField(layoutId: string, index: number, offset: -1 | 1) {
    const layout = layouts.find((candidate) => candidate.id === layoutId);
    if (!layout || index + offset < 0 || index + offset >= layout.fields.length) return;
    const fields = [...layout.fields];
    [fields[index], fields[index + offset]] = [fields[index + offset], fields[index]];
    patchLayout(layoutId, { fields });
  }

  function addLayout() {
    if (layouts.length >= 8) return;
    let number = layouts.length + 1;
    while (layouts.some((layout) => layout.id === `issue-layout-${number}`)) number += 1;
    replaceLayouts([...layouts, {
      id: `issue-layout-${number}`,
      label: `Issue layout ${number}`,
      sheetName: `Issues ${number}`,
      description: "",
      appliesTo: "",
      headerRow: 1,
      dataStartRow: 2,
      fields: [nextField({ fields: [], id: "", label: "", sheetName: "", description: "", appliesTo: "", headerRow: 1, dataStartRow: 2 })],
    }]);
  }

  return (
    <div className="logging-profile-review">
      <div className="logging-profile-summary-grid">
        <label><span>AI summary</span><textarea rows={2} value={profile.summary} onChange={(event) => onChange({ ...profile, summary: event.target.value })} /></label>
        <label><span>Agency format instructions <small>one per line</small></span><textarea rows={2} value={profile.instructions.join("\n")} onChange={(event) => onChange({ ...profile, instructions: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} /></label>
      </div>
      {layouts.map((layout, layoutIndex) => (
        <section className="logging-layout-review" key={layout.id}>
          <div className="logging-layout-heading">
            <div><span>Layout {layoutIndex + 1}</span><strong>{layout.label}</strong></div>
            {layouts.length > 1 ? <button type="button" onClick={() => setRemoveLayoutId(layout.id)}><Trash size={20} /> Remove layout</button> : null}
          </div>
          <div className="logging-layout-grid">
            <label><span>Layout label</span><input value={layout.label} onChange={(event) => patchLayout(layout.id, { label: event.target.value })} /></label>
            <label><span>Worksheet</span><input value={layout.sheetName} onChange={(event) => patchLayout(layout.id, { sheetName: event.target.value })} /></label>
            <label><span>Header row</span><input type="number" min={1} value={layout.headerRow} onChange={(event) => patchLayout(layout.id, { headerRow: clampedNumber(event.target.value, 1, 10000, layout.headerRow) })} /></label>
            <label><span>First issue row</span><input type="number" min={1} value={layout.dataStartRow} onChange={(event) => patchLayout(layout.id, { dataStartRow: clampedNumber(event.target.value, 1, 10000, layout.dataStartRow) })} /></label>
            <label className="logging-layout-wide"><span>Layout description</span><textarea rows={2} value={layout.description} onChange={(event) => patchLayout(layout.id, { description: event.target.value })} /></label>
            <label className="logging-layout-wide"><span>Use this layout for</span><input value={layout.appliesTo} onChange={(event) => patchLayout(layout.id, { appliesTo: event.target.value })} placeholder="Web findings, mobile findings, retests…" /></label>
          </div>
          <div className="logging-field-review-list">
            {layout.fields.map((field, fieldIndex) => (
              <details className="logging-field-review" key={field.id}>
                <summary>
                  <span>{fieldIndex + 1}</span><strong>{field.label}</strong><small>{SOURCE_OPTIONS.find((option) => option.value === field.sourceField)?.label}</small>
                </summary>
                <div className="logging-field-review-body">
                  <div className="logging-field-toolbar">
                    <button type="button" aria-label={`Move ${field.label} up`} disabled={fieldIndex === 0} onClick={() => moveField(layout.id, fieldIndex, -1)}><ArrowUp size={20} /></button>
                    <button type="button" aria-label={`Move ${field.label} down`} disabled={fieldIndex === layout.fields.length - 1} onClick={() => moveField(layout.id, fieldIndex, 1)}><ArrowDown size={20} /></button>
                    <button type="button" disabled={layout.fields.length === 1} onClick={() => patchLayout(layout.id, { fields: layout.fields.filter((candidate) => candidate.id !== field.id) })}><Trash size={20} /> Remove</button>
                  </div>
                  <div className="logging-field-review-grid">
                    <label><span>Agency label</span><input value={field.label} onChange={(event) => patchField(layout.id, field.id, { label: event.target.value })} /></label>
                    <label><span>Stable field ID <small>used by conditional rules</small></span><input value={field.id} readOnly /></label>
                    <label><span>Map into TheWCAG</span><select value={field.sourceField} onChange={(event) => patchField(layout.id, field.id, { sourceField: event.target.value as AuditLoggingSourceField })}>{SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label><span>Control type</span><select value={field.kind} onChange={(event) => patchField(layout.id, field.id, { kind: event.target.value as AuditLoggingField["kind"] })}><option value="text">Short text</option><option value="long-text">Long text</option><option value="select">Select</option><option value="date">Date</option><option value="url">URL</option><option value="number">Number</option></select></label>
                    <label><span>Worksheet column</span><input type="number" min={1} value={field.columnIndex ?? fieldIndex + 1} onChange={(event) => patchField(layout.id, field.id, { columnIndex: clampedNumber(event.target.value, 1, 200, field.columnIndex ?? fieldIndex + 1) })} /></label>
                    <label className="logging-check"><input type="checkbox" checked={field.required} onChange={(event) => patchField(layout.id, field.id, { required: event.target.checked })} /><span>Required for every issue</span></label>
                    <label><span>Default value</span><input value={field.defaultValue ?? ""} onChange={(event) => patchField(layout.id, field.id, { defaultValue: event.target.value || undefined })} /></label>
                    <label><span>Example value</span><input value={field.example ?? ""} onChange={(event) => patchField(layout.id, field.id, { example: event.target.value || undefined })} /></label>
                    <label className="logging-layout-wide"><span>Filling instruction</span><textarea rows={2} value={field.instructions} onChange={(event) => patchField(layout.id, field.id, { instructions: event.target.value })} /></label>
                    <label><span>Allowed values <small>one per line</small></span><textarea rows={3} value={field.options.join("\n")} onChange={(event) => patchField(layout.id, field.id, { options: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} /></label>
                    <label><span>Value mapping <small>Agency = TheWCAG</small></span><textarea rows={3} value={mappingsText(field)} onChange={(event) => patchField(layout.id, field.id, { valueMappings: parseMappings(event.target.value) })} /></label>
                    <label><span>Required when <small>field | operator | value</small></span><textarea rows={3} value={rulesText(field)} onChange={(event) => patchField(layout.id, field.id, { requiredWhen: parseRules(event.target.value) })} /></label>
                    <label><span>Validation pattern</span><input value={patternDrafts[field.id] ?? field.validation?.pattern ?? ""} aria-invalid={patternErrors[field.id] ? true : undefined} onChange={(event) => patchPattern(layout.id, field, event.target.value)} placeholder="Optional regular expression" />{patternErrors[field.id] ? <small role="alert">{patternErrors[field.id]}</small> : null}</label>
                    <label><span>Minimum length</span><input type="number" min={0} max={10000} value={field.validation?.minLength ?? ""} onChange={(event) => patchField(layout.id, field.id, { validation: { ...field.validation, minLength: optionalClampedNumber(event.target.value, 0, 10000) } })} /></label>
                    <label><span>Maximum length</span><input type="number" min={1} max={10000} value={field.validation?.maxLength ?? ""} onChange={(event) => patchField(layout.id, field.id, { validation: { ...field.validation, maxLength: optionalClampedNumber(event.target.value, 1, 10000) } })} /></label>
                  </div>
                </div>
              </details>
            ))}
          </div>
          <button className="logging-add-field" type="button" disabled={layout.fields.length >= 60} onClick={() => patchLayout(layout.id, { fields: [...layout.fields, nextField(layout)] })}><Plus size={20} /> {layout.fields.length >= 60 ? "60-field limit reached" : "Add field"}</button>
        </section>
      ))}
      <button className="logging-add-layout" type="button" disabled={layouts.length >= 8} onClick={addLayout}><Plus size={20} /> {layouts.length >= 8 ? "8-layout limit reached" : "Add another issue layout"}</button>
      <ConfirmDialog
        open={removeLayoutId !== null}
        title="Remove this layout?"
        description="The layout and every field it contains will be removed from the agency format."
        confirmLabel="Remove layout"
        onConfirm={() => {
          if (removeLayoutId) replaceLayouts(layouts.filter((candidate) => candidate.id !== removeLayoutId));
          setRemoveLayoutId(null);
        }}
        onCancel={() => setRemoveLayoutId(null)}
      />
    </div>
  );
}
