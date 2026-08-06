import type {
  AiProviderId,
  AuditLoggingField,
  AuditLoggingLayout,
  AuditLoggingProfile,
  Finding,
} from "./desktop";

const SOURCE_FIELDS = new Set<AuditLoggingField["sourceField"]>([
  "title", "description", "actualResult", "expectedResult", "userImpact", "affectedUsers",
  "wcag", "severity", "severityRationale", "recommendation",
  "reproductionSteps", "location", "owner", "dueDate", "status",
  "evidenceLink", "note", "ticket", "riskAcceptance", "retestNote", "comparisonNote", "custom",
]);
const FIELD_KINDS = new Set<AuditLoggingField["kind"]>([
  "text", "long-text", "select", "date", "url", "number",
]);
const CONDITION_OPERATORS = new Set(["equals", "not-equals", "empty", "not-empty"]);
const PROVIDERS = new Set<AiProviderId>(["thewcag", "openai", "anthropic", "openrouter"]);

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`AI returned an invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function textValue(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string") throw new Error(`AI returned an invalid ${label}`);
  const text = value.trim();
  if ((required && !text) || text.length > max) throw new Error(`AI returned an invalid ${label}`);
  return text;
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return textValue(value, label, max);
}

function integerValue(value: unknown, fallback: number, minimum: number, maximum: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum) return value;
  throw new Error(`AI returned an invalid ${label}`);
}

function stringList(value: unknown, label: string, maximum: number, itemMaximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`AI returned invalid ${label}`);
  return value.map((item) => textValue(item, label, itemMaximum));
}

function validationPattern(value: string, fieldId: string): string {
  try { new RegExp(value); } catch { throw new Error(`AI returned an invalid validation pattern for ${fieldId}`); }
  if (
    /\\[1-9]/.test(value) ||
    /\(\?/.test(value) ||
    /\([^)]*\)\s*(?:[+*]|\{)/.test(value) ||
    /(?:\.\*){2,}|(?:\.\+){2,}/.test(value)
  ) {
    throw new Error(`AI returned an unsafe validation pattern for ${fieldId}`);
  }
  return value;
}

function normalizeField(rawField: unknown, index: number, ids: Set<string>): AuditLoggingField {
  const field = objectValue(rawField, `field ${index + 1}`);
  const id = textValue(field.id, `field ${index + 1} ID`, 64).toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id)) {
    throw new Error("AI returned duplicate or invalid audit field identifiers");
  }
  ids.add(id);
  if (!SOURCE_FIELDS.has(field.sourceField as AuditLoggingField["sourceField"])) {
    throw new Error(`AI returned an unsupported mapping for ${id}`);
  }
  if (!FIELD_KINDS.has(field.kind as AuditLoggingField["kind"])) {
    throw new Error(`AI returned an unsupported field type for ${id}`);
  }
  const options = stringList(field.options ?? [], `${id} options`, 50, 120);
  const kind = field.kind as AuditLoggingField["kind"];
  if (kind === "select" && !options.length) throw new Error(`AI did not identify the allowed values for ${id}`);

  const rawMappings = field.valueMappings ?? [];
  if (!Array.isArray(rawMappings) || rawMappings.length > 50) throw new Error(`AI returned invalid value mappings for ${id}`);
  const valueMappings = rawMappings.map((rawMapping) => {
    const mapping = objectValue(rawMapping, `${id} value mapping`);
    return {
      agencyValue: textValue(mapping.agencyValue, `${id} agency value`, 120),
      nativeValue: textValue(mapping.nativeValue, `${id} native value`, 120),
    };
  });
  const constrainedNativeValues = field.sourceField === "severity"
    ? new Set(["blocker", "major", "minor"])
    : field.sourceField === "status"
      ? new Set(["open", "retest", "fixed", "accepted"])
      : field.sourceField === "affectedUsers"
        ? new Set(["screen-reader", "keyboard", "low-vision", "color-vision", "cognitive", "motor", "voice-control", "deaf-hard-of-hearing", "all-users", "other"])
      : undefined;
  if (constrainedNativeValues) {
    if (kind !== "select") throw new Error(`${id} must use a select control`);
    const invalid = options.some((option) => {
      const nativeValue = valueMappings.find((mapping) => mapping.agencyValue === option)?.nativeValue ?? option;
      return !constrainedNativeValues.has(nativeValue);
    });
    if (invalid) throw new Error(`${id} must map every agency option to a supported TheWCAG value`);
  }

  const rawConditions = field.requiredWhen ?? [];
  if (!Array.isArray(rawConditions) || rawConditions.length > 10) throw new Error(`AI returned invalid conditions for ${id}`);
  const requiredWhen = rawConditions.map((rawCondition) => {
    const condition = objectValue(rawCondition, `${id} condition`);
    if (!CONDITION_OPERATORS.has(String(condition.operator))) throw new Error(`AI returned an invalid condition for ${id}`);
    return {
      fieldId: textValue(condition.fieldId, `${id} condition field`, 64).toLowerCase(),
      operator: condition.operator as "equals" | "not-equals" | "empty" | "not-empty",
      value: textValue(condition.value ?? "", `${id} condition value`, 500, false),
    };
  });

  let validation: AuditLoggingField["validation"];
  if (field.validation && typeof field.validation === "object" && !Array.isArray(field.validation)) {
    const candidate = field.validation as Record<string, unknown>;
    const rawPattern = optionalText(candidate.pattern, `${id} pattern`, 240);
    const pattern = rawPattern ? validationPattern(rawPattern, id) : undefined;
    const minLength = integerValue(candidate.minLength, 0, 0, 10_000, `${id} minimum length`);
    const maxLength = integerValue(candidate.maxLength, 10_000, 1, 10_000, `${id} maximum length`);
    if (minLength > maxLength) throw new Error(`AI returned invalid length limits for ${id}`);
    validation = { pattern, minLength, maxLength };
  }

  return {
    id,
    label: textValue(field.label, `${id} label`, 100),
    sourceField: field.sourceField as AuditLoggingField["sourceField"],
    kind,
    required: field.required === true,
    instructions: textValue(field.instructions, `${id} instructions`, 800, false),
    options,
    example: optionalText(field.example, `${id} example`, 500),
    columnIndex: integerValue(field.columnIndex, index + 1, 1, 200, `${id} destination column`),
    defaultValue: optionalText(field.defaultValue, `${id} default`, 2_000),
    valueMappings: valueMappings.length ? valueMappings : undefined,
    validation,
    requiredWhen: requiredWhen.length ? requiredWhen : undefined,
  };
}

function normalizeLayout(rawLayout: unknown, index: number): AuditLoggingLayout {
  const layout = objectValue(rawLayout, `layout ${index + 1}`);
  const rawFields = layout.fields;
  if (!Array.isArray(rawFields) || !rawFields.length || rawFields.length > 60) {
    throw new Error("AI could not identify a usable issue-field layout in this template");
  }
  const ids = new Set<string>();
  const fields = rawFields.map((field, fieldIndex) => normalizeField(field, fieldIndex, ids));
  const columns = fields.map((field) => field.columnIndex ?? 1);
  if (new Set(columns).size !== columns.length) {
    throw new Error("AI returned duplicate destination columns in an audit layout");
  }
  for (const field of fields) {
    if (field.requiredWhen?.some((condition) => !ids.has(condition.fieldId))) {
      throw new Error(`AI returned a condition for ${field.id} that references an unknown field`);
    }
  }
  const id = textValue(layout.id ?? `layout-${index + 1}`, `layout ${index + 1} ID`, 64).toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error("AI returned an invalid layout identifier");
  const headerRow = integerValue(layout.headerRow, 1, 1, 10_000, `${id} header row`);
  const dataStartRow = integerValue(layout.dataStartRow, 2, 1, 10_001, `${id} first issue row`);
  if (dataStartRow <= headerRow) throw new Error(`${id} must start issue data after its header row`);
  return {
    id,
    label: textValue(layout.label ?? layout.sheetName ?? `Issue layout ${index + 1}`, `${id} label`, 100),
    sheetName: textValue(layout.sheetName ?? "Issues", `${id} sheet name`, 120),
    description: textValue(layout.description ?? "", `${id} description`, 800, false),
    appliesTo: textValue(layout.appliesTo ?? "All accessibility findings", `${id} applicability`, 500, false),
    headerRow,
    dataStartRow,
    fields,
  };
}

export function auditLoggingLayouts(profile: AuditLoggingProfile): AuditLoggingLayout[] {
  return profile.layouts?.length ? profile.layouts : [{
    id: "default",
    label: profile.sheetName || "Issue log",
    sheetName: profile.sheetName || "Issues",
    description: profile.summary,
    appliesTo: "All accessibility findings",
    headerRow: 1,
    dataStartRow: 2,
    fields: profile.fields,
  }];
}

export function normalizeAuditLoggingProfile(value: unknown): AuditLoggingProfile {
  const profile = objectValue(value, "audit logging profile");
  if (profile.version !== 1) throw new Error("AI returned an unsupported audit logging profile");
  let layouts: AuditLoggingLayout[];
  if (Array.isArray(profile.layouts) && profile.layouts.length) {
    if (profile.layouts.length > 8) throw new Error("AI returned too many issue layouts");
    layouts = profile.layouts.map(normalizeLayout);
    if (new Set(layouts.map((layout) => layout.id)).size !== layouts.length) {
      throw new Error("AI returned duplicate layout identifiers");
    }
    if (new Set(layouts.map((layout) => layout.sheetName.toLowerCase())).size !== layouts.length) {
      throw new Error("AI returned multiple issue layouts for the same worksheet");
    }
  } else {
    layouts = [normalizeLayout({
      id: "default",
      label: profile.sheetName || "Issue log",
      sheetName: profile.sheetName || "Issues",
      description: profile.summary || "",
      appliesTo: "All accessibility findings",
      headerRow: 1,
      dataStartRow: 2,
      fields: profile.fields,
    }, 0)];
  }
  const provenance = objectValue(profile.provenance, "audit profile provenance");
  if (!PROVIDERS.has(provenance.provider as AiProviderId)) throw new Error("AI returned invalid audit profile provenance");
  const analyzedAt = profile.analyzedAt;
  if (typeof analyzedAt !== "number" || !Number.isFinite(analyzedAt) || analyzedAt < 0) {
    throw new Error("AI returned an invalid analysis time");
  }
  const templateName = textValue(profile.templateName, "template name", 180);
  const profileId = optionalText(profile.profileId, "profile ID", 80)
    ?? `profile-${templateName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "audit"}-${Math.round(analyzedAt).toString(36)}`;
  return {
    version: 1,
    profileId,
    revision: integerValue(profile.revision, 1, 1, 10_000, "profile revision"),
    templateName,
    sheetName: layouts[0].sheetName,
    summary: textValue(profile.summary, "template summary", 1_500),
    instructions: stringList(profile.instructions ?? [], "template instructions", 20, 800),
    fields: layouts[0].fields,
    layouts,
    analyzedAt,
    provenance: {
      provider: provenance.provider as AiProviderId,
      model: textValue(provenance.model, "profile model", 160),
      promptVersion: textValue(provenance.promptVersion, "profile prompt version", 80),
    },
  };
}

export function auditLoggingProfileFromStored(value: unknown): AuditLoggingProfile | undefined {
  if (value === undefined || value === null) return undefined;
  try { return normalizeAuditLoggingProfile(value); } catch { return undefined; }
}

export function agencyValueFromNative(field: AuditLoggingField, nativeValue: string): string {
  return field.valueMappings?.find((mapping) => mapping.nativeValue === nativeValue)?.agencyValue ?? nativeValue;
}

export function nativeValueFromAgency(field: AuditLoggingField, agencyValue: string): string {
  return field.valueMappings?.find((mapping) => mapping.agencyValue === agencyValue)?.nativeValue ?? agencyValue;
}

export function auditFieldIsRequired(
  field: AuditLoggingField,
  valueForField: (fieldId: string) => string,
): boolean {
  if (field.required) return true;
  if (!field.requiredWhen?.length) return false;
  return field.requiredWhen.every((condition) => {
    const current = valueForField(condition.fieldId).trim();
    if (condition.operator === "equals") return current === condition.value;
    if (condition.operator === "not-equals") return current !== condition.value;
    if (condition.operator === "empty") return !current;
    return Boolean(current);
  });
}

export function auditFieldValidationError(field: AuditLoggingField, value: string): string | null {
  if (!value) return null;
  if (field.kind === "select") {
    const selectedValues = field.sourceField === "affectedUsers" ? value.split("\n").filter(Boolean) : [value];
    if (selectedValues.some((selected) => !field.options.includes(selected))) {
      return `Choose only the allowed ${field.label} values.`;
    }
  }
  if (field.kind === "url") {
    try { new URL(value); } catch { return `${field.label} must be a valid URL.`; }
  }
  if (field.kind === "date") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
    if (!match || !parsed || parsed.getUTCFullYear() !== Number(match[1]) || parsed.getUTCMonth() !== Number(match[2]) - 1 || parsed.getUTCDate() !== Number(match[3])) {
      return `${field.label} must be a valid date.`;
    }
  }
  if (field.kind === "number" && !Number.isFinite(Number(value))) return `${field.label} must be a number.`;
  const validation = field.validation;
  if (validation?.minLength !== undefined && value.length < validation.minLength) {
    return `${field.label} must contain at least ${validation.minLength} characters.`;
  }
  if (validation?.maxLength !== undefined && value.length > validation.maxLength) {
    return `${field.label} must contain no more than ${validation.maxLength} characters.`;
  }
  if (validation?.pattern && !new RegExp(validation.pattern).test(value)) {
    return `${field.label} does not match the agency's required format.`;
  }
  return null;
}

export function migrateFindingsToAuditLoggingProfile(
  findings: Finding[],
  previousProfile: AuditLoggingProfile | undefined,
  nextProfile: AuditLoggingProfile,
): Finding[] {
  const nextLayouts = auditLoggingLayouts(nextProfile);
  const previousLayouts = previousProfile ? auditLoggingLayouts(previousProfile) : [];
  return findings.map((finding) => {
    const previousLayout = previousLayouts.find((layout) => layout.id === finding.agencyLayoutId) ?? previousLayouts[0];
    const nextLayout = nextLayouts.find((layout) => layout.id === finding.agencyLayoutId)
      ?? nextLayouts.find((layout) => layout.sheetName === previousLayout?.sheetName)
      ?? nextLayouts[0];
    const agencyFields = { ...(finding.agencyFields ?? {}) };
    for (const nextField of nextLayout.fields.filter((field) => field.sourceField === "custom")) {
      if (agencyFields[nextField.id]) continue;
      const previousField = previousLayout?.fields.find((field) => field.sourceField === "custom" && (
        field.id === nextField.id || field.label.trim().toLowerCase() === nextField.label.trim().toLowerCase()
      ));
      if (previousField && agencyFields[previousField.id]) agencyFields[nextField.id] = agencyFields[previousField.id];
    }
    return {
      ...finding,
      agencyFields,
      agencyLayoutId: nextLayout.id,
      agencyProfileId: nextProfile.profileId,
      agencyProfileRevision: nextProfile.revision,
    };
  });
}

export function auditFindingLoggingErrors(
  profile: AuditLoggingProfile,
  finding: Finding,
): Array<{ fieldId: string; label: string; message: string }> {
  const layouts = auditLoggingLayouts(profile);
  const layout = layouts.find((candidate) => candidate.id === finding.agencyLayoutId) ?? layouts[0];
  const valueForField = (fieldId: string) => {
    const field = layout.fields.find((candidate) => candidate.id === fieldId);
    if (!field) return "";
    if (field.sourceField === "custom") return finding.agencyFields?.[field.id]?.trim() || field.defaultValue || "";
    const raw = finding[field.sourceField];
    const agencyValue = Array.isArray(raw)
      ? raw.map((item) => agencyValueFromNative(field, String(item))).join("\n")
      : agencyValueFromNative(field, String(raw ?? ""));
    return agencyValue || field.defaultValue || "";
  };
  return layout.fields.flatMap((field) => {
    const value = valueForField(field.id);
    if (auditFieldIsRequired(field, valueForField) && !value) {
      return [{ fieldId: field.id, label: field.label, message: `${field.label} is required.` }];
    }
    const error = auditFieldValidationError(field, value);
    return error ? [{ fieldId: field.id, label: field.label, message: error }] : [];
  });
}
