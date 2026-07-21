import type {
  AuditTemplate,
  AuditTestRun,
  AuditTestStepResult,
} from "../shared/desktop";

export interface AuditTestScript {
  id: string;
  title: string;
  category: AuditTestRun["category"];
  description: string;
  steps: string[];
}

export const AUDIT_TEST_SCRIPTS: AuditTestScript[] = [
  {
    id: "authentication",
    title: "Authentication and account recovery",
    category: "authentication",
    description: "Verify sign in, validation, recovery, timeout, and authenticated state changes.",
    steps: [
      "Complete sign in using only the keyboard and verify a visible focus indicator.",
      "Trigger every validation error and confirm it is announced, associated, and understandable.",
      "Complete password or account recovery without relying on memory, color, or a pointer.",
      "Verify timeout warnings can be extended and restored without losing entered information.",
      "Confirm status changes and authentication errors are exposed to assistive technology.",
    ],
  },
  {
    id: "checkout",
    title: "Cart and checkout journey",
    category: "checkout",
    description: "Evaluate discovery, cart updates, payment, errors, and order confirmation as one task.",
    steps: [
      "Find a product and add it to the cart at 200% zoom and with keyboard-only input.",
      "Change quantity, remove an item, and confirm updated totals are announced.",
      "Complete address and payment fields with a screen reader and autocomplete enabled.",
      "Trigger payment and address errors, then recover without losing valid information.",
      "Confirm the order review and success states expose names, totals, and status changes.",
    ],
  },
  {
    id: "forms",
    title: "Forms and validation",
    category: "forms",
    description: "Check labels, instructions, input purpose, errors, review, and submission feedback.",
    steps: [
      "Navigate every field in a logical order using the keyboard and a screen reader.",
      "Confirm visible labels and programmatic names remain present after values are entered.",
      "Verify required format, autocomplete, and input-purpose information is exposed.",
      "Submit invalid data and confirm errors identify the field and explain recovery.",
      "Submit valid data and confirm success or processing status is announced.",
    ],
  },
  {
    id: "media",
    title: "Audio, video, and animation",
    category: "media",
    description: "Review alternatives, captions, descriptions, controls, autoplay, and flashing content.",
    steps: [
      "Verify prerecorded video has synchronized captions and an equivalent audio description or alternative.",
      "Verify live media provides captions when required by the evaluation target.",
      "Operate play, pause, volume, seek, captions, and full-screen controls with keyboard and screen reader.",
      "Confirm automatically playing audio can be paused or stopped independently.",
      "Check animation, flashing, and motion-triggered interactions for pause and reduced-motion behavior.",
    ],
  },
  {
    id: "documents",
    title: "Documents and downloadable content",
    category: "documents",
    description: "Review document structure, reading order, alternatives, tables, forms, and metadata.",
    steps: [
      "Open each document from its published link and record the format and reader used.",
      "Verify title, language, headings, lists, landmarks, and reading order are meaningful.",
      "Check images, charts, links, tables, and form controls for appropriate alternatives and structure.",
      "Navigate the document using keyboard and assistive-technology shortcuts.",
      "Confirm visible content and annotations are not omitted from the accessibility tree.",
    ],
  },
  {
    id: "components",
    title: "Design-system component coverage",
    category: "components",
    description: "Test reusable controls in default, interactive, validation, disabled, and responsive states.",
    steps: [
      "Inventory the component variants and states used by the representative sample.",
      "Verify name, role, value, instructions, and state changes for each interactive variant.",
      "Check keyboard order, activation, dismissal, and focus restoration.",
      "Evaluate default, hover, focus, selected, disabled, loading, error, and success states.",
      "Repeat at 320 CSS pixels, 200% zoom, forced colors, and reduced motion where applicable.",
    ],
  },
];

export const BUILT_IN_AUDIT_TEMPLATES: AuditTemplate[] = [
  {
    id: "web-product-aa",
    name: "Web product, WCAG 2.2 AA",
    description: "A cross-browser, keyboard, screen-reader, zoom, and responsive product evaluation.",
    source: "built-in",
    goal: "Evaluate critical user journeys and reusable components against WCAG 2.2 Level A and AA.",
    scope: "Critical user journeys, shared templates, navigation, forms, errors, authenticated states, and downloadable content.",
    sample: "Include every shared template, critical task, repeated component, error state, and materially different responsive layout.",
    excludedScope: "Record third-party and unavailable states before testing begins.",
    environment: "Chrome and Edge on Windows 11; Safari on current macOS; Safari on iOS; 320 CSS pixels; 200% and 400% zoom; forced colors; reduced motion.",
    assistiveTechnology: "Keyboard-only; NVDA with Chrome; VoiceOver with Safari on macOS and iOS; browser text-spacing overrides; Windows High Contrast.",
    methodology: "Manual WCAG review following the documented representative sample, supported by deterministic tools, keyboard testing, screen-reader verification, responsive reflow checks, and evidence capture. Automated results remain unconfirmed until reviewed by an auditor.",
    standard: "WCAG 2.2 AA",
    sampleItems: [
      { kind: "flow", label: "Primary critical journey", location: "", notes: "Include success, error, and recovery states." },
      { kind: "component", label: "Global navigation and shared controls", location: "", notes: "Test every repeated state and breakpoint." },
      { kind: "page", label: "Content-heavy representative page", location: "", notes: "Include headings, links, images, and tables where present." },
    ],
    testScriptIds: ["authentication", "forms", "components"],
  },
  {
    id: "release-regression",
    name: "Release regression",
    description: "A focused reassessment of critical flows, fixed findings, and shared components before release.",
    source: "built-in",
    goal: "Confirm previously fixed barriers remain resolved and the release introduces no regression in critical tasks.",
    scope: "Previously failed criteria, remediated components, affected user journeys, and release-specific interface changes.",
    sample: "Prioritize every remediated component and each critical journey that uses it, plus one unaffected baseline flow.",
    excludedScope: "Unchanged areas not connected to remediated or release-specific components.",
    environment: "The same browser, operating-system, viewport, zoom, and build combinations used for the original finding, plus the primary supported production browser.",
    assistiveTechnology: "The same assistive technology used for the original finding, plus keyboard-only verification.",
    methodology: "Reproduce the original failure, capture before and after evidence, repeat the original test in the release candidate, and verify adjacent component states for regression.",
    standard: "WCAG 2.2 AA",
    sampleItems: [
      { kind: "flow", label: "Critical release journey", location: "", notes: "Retest fixed findings in context." },
      { kind: "component", label: "Remediated shared component", location: "", notes: "Cover every affected variant and state." },
    ],
    testScriptIds: ["components"],
  },
  {
    id: "desktop-product",
    name: "Desktop application",
    description: "A native desktop evaluation across keyboard, accessibility APIs, scaling, and system preferences.",
    source: "built-in",
    goal: "Evaluate critical desktop workflows, native semantics, keyboard access, focus behavior, and system preference support.",
    scope: "Application shell, menus, dialogs, critical workflows, editable content, notifications, updates, and system integrations.",
    sample: "Include each primary window type, modal and non-modal flow, reusable control family, empty state, error state, and permission state.",
    excludedScope: "Document operating-system dialogs or embedded third-party surfaces evaluated separately.",
    environment: "Current and previous supported macOS releases on Apple silicon; Windows 11 at 100%, 200%, and high-contrast settings; high-DPI and multi-monitor configurations.",
    assistiveTechnology: "Keyboard-only; VoiceOver on macOS; NVDA on Windows; Voice Control or Windows Voice Access; increased contrast; reduced motion.",
    methodology: "Manual application testing using native accessibility APIs, keyboard operation, assistive technology, display scaling, system appearance preferences, and annotated evidence capture.",
    standard: "WCAG 2.2 AA",
    sampleItems: [
      { kind: "flow", label: "Primary desktop workflow", location: "", notes: "Include menus, dialogs, and completion feedback." },
      { kind: "state", label: "Permission, empty, loading, and error states", location: "", notes: "Verify recovery and announcements." },
      { kind: "component", label: "Reusable desktop controls", location: "", notes: "Include focus, disabled, and selected states." },
    ],
    testScriptIds: ["forms", "components"],
  },
  {
    id: "document-set",
    name: "Document collection",
    description: "A structured sample for PDFs, office documents, and downloadable forms.",
    source: "built-in",
    goal: "Evaluate representative downloadable documents for structure, reading order, alternatives, navigation, and forms.",
    scope: "Published PDFs, office documents, forms, policy files, reports, and linked alternatives included in the representative sample.",
    sample: "Include every document template, authoring source, document type, complex table pattern, form pattern, and high-priority public document.",
    excludedScope: "Record archived, superseded, or inaccessible source documents separately.",
    environment: "Adobe Acrobat Reader and browser PDF viewers on Windows and macOS; source application where remediation is expected.",
    assistiveTechnology: "NVDA with Acrobat Reader; VoiceOver with Preview or Safari; keyboard-only navigation; high zoom and reflow where supported.",
    methodology: "Manual document structure and reading-order review supported by accessibility checkers. Tool results remain signals until verified against rendered and assistive-technology behavior.",
    standard: "WCAG 2.2 AA",
    sampleItems: [
      { kind: "document", label: "Representative simple document", location: "", notes: "Check title, language, headings, links, and reading order." },
      { kind: "document", label: "Complex table or visual report", location: "", notes: "Check table structure and equivalent descriptions." },
      { kind: "document", label: "Interactive form document", location: "", notes: "Check labels, order, validation, and submission." },
    ],
    testScriptIds: ["documents"],
  },
];

export function createTestRun(script: AuditTestScript): AuditTestRun {
  const now = Date.now();
  const steps: AuditTestStepResult[] = script.steps.map((label, index) => ({
    id: `${script.id}-${index + 1}`,
    label,
    complete: false,
    observation: "",
  }));
  return {
    id: crypto.randomUUID(),
    scriptId: script.id,
    title: script.title,
    category: script.category,
    status: "planned",
    steps,
    notes: "",
    createdAt: now,
    modifiedAt: now,
  };
}
