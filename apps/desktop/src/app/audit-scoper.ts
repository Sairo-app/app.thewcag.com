import type {
  AuditScopeDiscovery,
  AuditProject,
  AuditSampleItem,
  AuditScopeFeature,
  AuditScopeProfile,
  AuditTargetType,
  AuditTemplate,
} from "../shared/desktop";
import { BUILT_IN_AUDIT_TEMPLATES } from "./audit-templates";

export const AUDIT_TARGET_TYPE_OPTIONS: Array<{
  id: AuditTargetType;
  label: string;
  description: string;
}> = [
  { id: "content-site", label: "Content website", description: "Public pages, navigation, articles, forms, media, and downloads." },
  { id: "web-product", label: "Web product", description: "Authenticated tasks, dashboards, workflows, and reusable controls." },
  { id: "commerce-service", label: "Commerce or service", description: "Search, selection, application, booking, payment, and confirmation." },
  { id: "release-regression", label: "Release regression", description: "Fixed findings, changed components, and affected critical journeys." },
  { id: "desktop-product", label: "Desktop application", description: "Native windows, menus, dialogs, keyboard access, and platform APIs." },
  { id: "mobile-product", label: "Mobile application", description: "Native touch, gestures, large text, orientation, and mobile assistive technology." },
  { id: "document-set", label: "Document collection", description: "PDF, office documents, downloadable forms, and document templates." },
  { id: "component-library", label: "Component library", description: "Reusable components, variants, states, tokens, and usage guidance." },
];

export const AUDIT_SCOPE_FEATURE_OPTIONS: Array<{
  id: AuditScopeFeature;
  label: string;
  description: string;
  sample: Pick<AuditSampleItem, "kind" | "label" | "location" | "notes">;
}> = [
  {
    id: "authentication",
    label: "Authentication and recovery",
    description: "Sign in, account creation, recovery, timeout, and authenticated state changes.",
    sample: { kind: "flow", label: "Authentication and account recovery", location: "", notes: "Cover success, validation, recovery, timeout, and sign-out states." },
  },
  {
    id: "checkout",
    label: "Checkout or critical transaction",
    description: "Cart, application, booking, payment, review, errors, and confirmation.",
    sample: { kind: "flow", label: "Checkout or critical transaction", location: "", notes: "Cover success, validation, payment failure, recovery, and confirmation." },
  },
  {
    id: "forms",
    label: "Forms and validation",
    description: "Labels, instructions, input purpose, errors, review, and status feedback.",
    sample: { kind: "state", label: "Representative form and validation states", location: "", notes: "Include required, invalid, error summary, processing, and success states." },
  },
  {
    id: "media",
    label: "Media and motion",
    description: "Audio, video, captions, descriptions, controls, autoplay, flashing, and animation.",
    sample: { kind: "page", label: "Representative media and motion", location: "", notes: "Include controls, alternatives, autoplay, flashing, and reduced-motion behavior." },
  },
  {
    id: "documents",
    label: "Documents and downloads",
    description: "PDF and office-document structure, reading order, forms, tables, and alternatives.",
    sample: { kind: "document", label: "Representative downloadable document", location: "", notes: "Select each material document template and complex content pattern." },
  },
  {
    id: "components",
    label: "Reusable components",
    description: "Shared controls, variants, interaction states, responsive behavior, and overlays.",
    sample: { kind: "component", label: "Reusable components and interaction states", location: "", notes: "Cover default, focus, active, selected, disabled, loading, error, and success states." },
  },
];

const TYPE_TEMPLATE: Record<AuditTargetType, string> = {
  "content-site": "content-site-aa",
  "web-product": "web-product-aa",
  "commerce-service": "commerce-service",
  "release-regression": "release-regression",
  "desktop-product": "desktop-product",
  "mobile-product": "mobile-product",
  "document-set": "document-set",
  "component-library": "component-library",
};

const DEFAULT_FEATURES: Record<AuditTargetType, AuditScopeFeature[]> = {
  "content-site": ["forms", "media", "documents", "components"],
  "web-product": ["authentication", "forms", "components"],
  "commerce-service": ["authentication", "checkout", "forms", "components"],
  "release-regression": ["components"],
  "desktop-product": ["forms", "components"],
  "mobile-product": ["authentication", "forms", "media", "components"],
  "document-set": ["documents"],
  "component-library": ["forms", "media", "components"],
};

const TYPE_SIGNALS: Record<AuditTargetType, RegExp[]> = {
  "content-site": [/\b(marketing|content|news|blog|article|public site|brochure|information)\b/i],
  "web-product": [/\b(web app|dashboard|portal|saas|workspace|admin|account area|authenticated)\b/i, /(^|\.)app\./i],
  "commerce-service": [/\b(checkout|cart|basket|payment|purchase|e-?commerce|shop|store|booking|reservation|application flow|quote)\b/i],
  "release-regression": [/\b(release|regression|retest|remediation|fixed findings?|release candidate|hotfix)\b/i],
  "desktop-product": [/\b(desktop|windows app|mac app|macos app|electron|native application|installed application)\b/i, /\.(exe|msi|dmg|app)\b/i],
  "mobile-product": [/\b(mobile app|ios app|android app|iphone|ipad|apk|aab|testflight)\b/i],
  "document-set": [/\b(pdf|documents?|docx|office files?|downloadable forms?|policy collection|annual reports?)\b/i, /\.(pdf|docx?|xlsx?|pptx?)\b/i],
  "component-library": [/\b(design system|component library|storybook|ui kit|pattern library|design tokens?)\b/i],
};

const FEATURE_SIGNALS: Record<AuditScopeFeature, RegExp[]> = {
  authentication: [/\b(sign[ -]?in|log[ -]?in|account|authentication|password|recovery|session|mfa|two-factor)\b/i],
  checkout: [/\b(checkout|cart|basket|payment|purchase|order|booking|reservation|transaction)\b/i, /\bapplication (flow|journey|process|submission)\b/i],
  forms: [/\b(form|validation|input|registration|contact|survey|search)\b/i, /\bapplication form\b/i],
  media: [/\b(video|audio|media|caption|transcript|animation|motion|livestream|podcast)\b/i],
  documents: [/\b(pdf|document|download|docx|xlsx|pptx|report|policy|statement)\b/i],
  components: [/\b(component|design system|storybook|widget|dialog|menu|tabs?|accordion|data grid|shared controls?)\b/i],
};

const SCOPER_CONTEXT_FIELDS = new Set<keyof AuditProject>([
  "target",
  "goal",
  "scope",
  "sample",
  "excludedScope",
  "environment",
  "assistiveTechnology",
  "methodology",
  "standard",
]);

export interface AuditScopeRecommendation {
  targetType: AuditTargetType;
  template: AuditTemplate;
  confidence: "high" | "medium" | "low";
  featureIds: AuditScopeFeature[];
  reasons: string[];
  sampleItems: AuditTemplate["sampleItems"];
  testScriptIds: string[];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function typeLabel(type: AuditTargetType): string {
  return AUDIT_TARGET_TYPE_OPTIONS.find((option) => option.id === type)?.label ?? type;
}

function detectTargetType(text: string): {
  targetType: AuditTargetType;
  confidence: AuditScopeRecommendation["confidence"];
  reasons: string[];
} {
  const scores = Object.fromEntries(
    AUDIT_TARGET_TYPE_OPTIONS.map(({ id }) => [id, 0]),
  ) as Record<AuditTargetType, number>;
  const matched = new Map<AuditTargetType, string[]>();

  for (const { id } of AUDIT_TARGET_TYPE_OPTIONS) {
    for (const signal of TYPE_SIGNALS[id]) {
      const match = text.match(signal)?.[0];
      if (!match) continue;
      scores[id] += 4;
      matched.set(id, [...(matched.get(id) ?? []), match]);
    }
  }

  try {
    const url = new URL(text.split(/\s+/).find((value) => /^https?:\/\//i.test(value)) ?? "");
    scores["content-site"] += 2;
    scores["web-product"] += 1;
    if (/^(app|account|dashboard|portal)\./i.test(url.hostname)) scores["web-product"] += 3;
    if (/\.(pdf|docx?|xlsx?|pptx?)$/i.test(url.pathname)) scores["document-set"] += 5;
  } catch {
    // Product names and application targets are valid scoper inputs without a URL.
  }

  const ranked = (Object.entries(scores) as Array<[AuditTargetType, number]>)
    .sort((left, right) => right[1] - left[1]);
  const [winner, score] = ranked[0];
  const gap = score - ranked[1][1];
  const confidence = score >= 6 && gap >= 2 ? "high" : score >= 3 ? "medium" : "low";
  const signals = unique(matched.get(winner) ?? []).slice(0, 3);
  const reasons = signals.length
    ? [`Matched ${signals.map((signal) => `“${signal}”`).join(", ")} to ${typeLabel(winner).toLowerCase()} coverage.`]
    : ["No strong product-type signal was found, so the general content website scope is the safest starting point."];
  return { targetType: winner, confidence, reasons };
}

export function recommendAuditScope(input: {
  target: string;
  project?: string;
  goal?: string;
  targetType?: AuditTargetType | "auto";
  featureIds?: AuditScopeFeature[];
  targetTypeOrigin?: "auditor" | "discovery";
  featureOrigin?: "auditor" | "discovery";
}): AuditScopeRecommendation {
  const text = [input.target, input.project, input.goal].filter(Boolean).join(" ").trim();
  const detected = detectTargetType(text);
  const targetType = input.targetType && input.targetType !== "auto"
    ? input.targetType
    : detected.targetType;
  const confidence = input.targetType && input.targetType !== "auto"
    ? input.targetTypeOrigin === "discovery" ? "medium" : "high"
    : detected.confidence;
  const reasons = input.targetType && input.targetType !== "auto"
    ? [input.targetTypeOrigin === "discovery"
        ? `Public-page inspection suggested ${typeLabel(targetType).toLowerCase()} coverage; the auditor must confirm it.`
        : `${typeLabel(targetType)} was selected by the auditor.`]
    : detected.reasons;

  const detectedFeatures = AUDIT_SCOPE_FEATURE_OPTIONS
    .filter(({ id }) => FEATURE_SIGNALS[id].some((signal) => signal.test(text)))
    .map(({ id }) => id);
  const featureIds = input.featureIds === undefined
    ? unique([...DEFAULT_FEATURES[targetType], ...detectedFeatures])
    : unique(input.featureIds);
  if (detectedFeatures.length && input.featureIds === undefined) {
    reasons.push(`Detected coverage signals for ${detectedFeatures.map((id) => AUDIT_SCOPE_FEATURE_OPTIONS.find((feature) => feature.id === id)?.label.toLowerCase()).join(", ")}.`);
  } else if (input.featureIds !== undefined) {
    reasons.push(input.featureOrigin === "discovery"
      ? "Feature coverage was detected from the inspected public pages and requires auditor confirmation."
      : "Feature coverage was adjusted by the auditor.");
  }

  const templateId = TYPE_TEMPLATE[targetType];
  const template = BUILT_IN_AUDIT_TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new Error(`The built-in scope template ${templateId} is unavailable.`);
  const targetLocation = input.target.trim();
  const sampleItems = [...template.sampleItems, ...featureIds.map((id) => {
    const feature = AUDIT_SCOPE_FEATURE_OPTIONS.find((item) => item.id === id);
    if (!feature) throw new Error(`The scope feature ${id} is unavailable.`);
    return feature.sample;
  })]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index)
    .map((item, index) => ({
      ...item,
      location: item.location || (index === 0 ? targetLocation : ""),
    }));
  const testScriptIds = unique(featureIds);

  return {
    targetType,
    template,
    confidence,
    featureIds,
    reasons,
    sampleItems,
    testScriptIds,
  };
}

function discoveryFeatureForSample(label: string): AuditScopeFeature | null {
  if (/auth|account|sign|recovery/i.test(label)) return "authentication";
  if (/checkout|transaction|payment|cart|booking/i.test(label)) return "checkout";
  if (/form|validation/i.test(label)) return "forms";
  if (/media|motion|audio|video/i.test(label)) return "media";
  if (/document|download|pdf/i.test(label)) return "documents";
  if (/component|control|navigation/i.test(label)) return "components";
  return null;
}

export function incorporateScopeDiscovery(
  recommendation: AuditScopeRecommendation,
  discovery: AuditScopeDiscovery,
): AuditScopeRecommendation {
  const discoveredItems: AuditTemplate["sampleItems"] = discovery.pages.map((page) => ({
    kind: "page",
    label: page.title,
    location: page.url,
    notes: `Detected representative template: ${page.templateKey}.${page.signals.length ? ` Signals: ${page.signals.join(", ")}.` : ""}`,
  }));
  const completedRecommendations = recommendation.sampleItems.map((item) => {
    if (item.location) return item;
    const feature = discoveryFeatureForSample(item.label);
    const matching = discovery.pages.find((page) => feature && page.signals.includes(feature === "checkout" ? "transaction" : feature === "components" ? "interactive components" : feature));
    return matching ? { ...item, location: matching.url } : item;
  });
  const sampleItems = [...discoveredItems, ...completedRecommendations]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label && candidate.location === item.location) === index);
  return {
    ...recommendation,
    reasons: [
      ...recommendation.reasons,
      `Inspected ${discovery.pages.length} public page${discovery.pages.length === 1 ? "" : "s"} across ${discovery.templateCount} detected template${discovery.templateCount === 1 ? "" : "s"}.`,
    ],
    sampleItems,
  };
}

export function scopeProfileFromRecommendation(
  recommendation: AuditScopeRecommendation,
): AuditScopeProfile {
  return {
    version: 1,
    targetType: recommendation.targetType,
    featureIds: [...recommendation.featureIds],
    templateId: recommendation.template.id,
    confidence: recommendation.confidence,
    reasons: [...recommendation.reasons],
    confirmedAt: Date.now(),
  };
}

export function auditPatchInvalidatesScopeProfile(
  patch: Partial<AuditProject>,
): boolean {
  return (Object.keys(patch) as Array<keyof AuditProject>).some((key) =>
    SCOPER_CONTEXT_FIELDS.has(key),
  );
}
