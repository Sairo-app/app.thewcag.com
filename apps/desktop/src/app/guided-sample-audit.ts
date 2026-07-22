import type { AuditActivity, AuditProject, Finding } from "../shared/desktop";
import { createAuditProject, localDateInputValue } from "./audits";
import type { AuditPackagePayload } from "./audit-package";
import { WCAG_CRITERIA } from "./data/wcag";

export const GUIDED_SAMPLE_NAME = "Guided sample audit";

const SAMPLE_CAPTURE_ID = "cap-guided-sample";
const SAMPLE_ITEM_ID = "sample-checkout-form";
const SAMPLE_RUN_ID = "run-guided-components";
const SAMPLE_FINDING_ID = "demo-low-contrast-action";

// A small, bundled PNG of a fictional checkout panel. It is deliberately local
// and self-contained so starting the sample never fetches a URL.
const SAMPLE_CAPTURE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAGQCAYAAAA+89ElAAAL/ElEQVR42u3dL3LCQBiHYW4SHZ1jYZFrY3MAHK4X4AC4CkRdVQYbg2GGSUwHUDUMiP5ZsruPeC7Qj/nlnZpdnI/9BQCAciz8EQAABCAAAAIQAAABCACAAAQAQAACACAAAQAQgAAACEAAAAQgAAACEAAAAQgAgAAEAEAAAgAIQAAABCAAAAIQAAABCACAAAQAQAACACAAAQAQgAAACEAAAAQgAAACEAAAAQgAgAAEACDBAKzqBgBgVgSgAAQABKAAFIAAgAAUgAIQABCAAlAAAgACUAAKQABAAApAPzIAQAAKQAAAASgAAQAEoAAEABCAAhAAQAAKQAAAASgAAQAEoAAEABCAAhAAEIACUAACAAJQAApAAEAACkABCAAIQAEoAAEAASgAIwbgdPggIqMBgAAUgAJQAAKAABSAAlAAAoAAFIACUAACgAAUgAJQAAKAABSAAlAAAoAAFIACUAACgAAKAABSACEAAEIACEAEIAALQU3AAAAJQAAIAAlAACkAAQAAKQAEIAAhAASgAAQABKAAFIAAgAAWgAAQABKAABAAQgAIQAEAACkAAAAEoAAEABKAABAAQgAIQAEAACkAAAAEoAAEAASgABSAAIAAFoAAEAASgABSAAIAAFIACEAAQgALwzuVrAgCYFQEoAAEAASgABSAAIAAFoAAEAASgABSAAIAAFIACEAAQgALQjwwAEIACEABAAApAAAABKAABAASgAAQAEIACEABAAApAAAABKAABAASgAAQABKAAFIAAgAAUgAIQABCAAlAAAgACUAAKQABAAApAAQgACEABCAAgAAUgAIAAFIAAAAJQAAIACEABCAAgAAUgAIAAFIAAAAJQAAIACMD0A7CqGyBxPkaAABSAAhAEIIAAFIACEAQggAAUgAIQBCCAABSAgAAEEIACEBCAAAJQAAICEBCAAlAAAgIQEIACUAACAhAQgAJQAAICEBCAAlAAAgIQEIACUAACAhAQgAJQAAICEBCAAlAAAgIQEIACUACCAAQQgAJQAIIABBCAAlAAggAEEIAC0McTBCCAACwrAAEABKAABAAQgAIQAEAACkAAQAAKQAEIAAhAASgAAQABKAAFIAAgAAWgAAQABKAAFIAAgAAUgAAAAlAAAgAIQAEIACAABeBz680bAAUQLQhAASgAAQQgCEABCIAABAEoAAEQgCAABSAAAhAEoAAEQAAiAAWgAARAACIABaAABEAAIgAFoAAEQAAiAAWgl0AAAAEoAP3IAAABKAABAASgAAQAEIACEABAAApAAAABKAABAASgAAQAEIACEABAAApAAEAACkABCAAIQAEoAAEAASgABSAAIAAFoAAEAASgABSAAIAAFIAAAAJQAAIACEABCAAgAAUgAIAAFIAAAAJQAAIACEABCAAgAAUgAIAAFIAAgAAUgAIQABCAAlAAAgACUAAKQABAAApAAQgACEABKAABAAEoAAEABKAABAAQgAIQAEAACsAHxtMARGLIgVz+QSQABSAgAAEBKAAFICAAAQEoAAUgIAABASgABSAIQAEICEABKABBABpyQAAKQAEIAtCQAwJQAApAEIACEASg3RCAAhAEoAAEAWg3BKAABAEoAEEA2g0BKABBAApAEIAC0IF9lEEA+piCABSAAhAQgIAAFIAC8InlKvADYkgACkBAAApAASgAEYCGHBCAAlAACkAEoCEHBKAAFIACEAFoyAEBKAAFoABEAApAEIB2QwAKQAGIABSAIADthgAUgAIQASgAQQAKQAcWgAIQASgAQQAKQAEoAAUgAhDQBwJQAAICEBCAAlAAAgIQEIACUAACAhAQgAJQAAICEBCAAlAAAoYcEIACUAACmQx5aDv4dwJQAApAAAGIABSAAlAAAghABKAAFIAODCAAEYACUAA6MCAABSACUB8IQAEICEABiADUBwJQAAICUAAiAAWgAEz4wONpACIRgCAABaAAFIAgAAUgCEABKAAFIAhAQw4IQAEoAEEAGnJAAApAAQgCUACCALQbAlAAggAUgCAA7YYAFIAgAAUgCEC7IQAFIAhAAQgCUAA6sI8yCEAfUxCAAlAAAgIQEIACUAACAhAQgAJQAAICEBCAAlAAAgIQEIACsIAAXK4CCRNlAlAAggAUgAJQAApABCCgDwSgABSAAhABCAhAASgABaAARAACAlAACkAEIAIQEIACUAAiABGAgAAUgAIQASgABSAgAAWgAEQACkBDDghAASgAEYACMK8hD20HsyEABaADewkEBKAARAAKQAEoAAEBKAARgPpAAApAQAAKQASgABSAAhAQgAIQASgABaAABASgAEQACkABKAABASgAEYACUAAKQBCAAhAEoAAUgAIQBKAABAEoAAWgAAQBaMgBASgABSAIQEMOCEABKABBAApAEIB2QwAKQBCAAhAEoN0QgAIQBKAABAEoAB1YAIIAFIAgAAWgAAQEIKAPBKAABAQgIAAFoAAEBCAgAAWgAAQEICAABaAABAQgIAAFoAAEBCAgAAWgAAQBKAABASgABSAIQEMOCEABKABBABpyQAAKQAEIAtCQAwJQAApAEIACEASg3RCAAhAEoAAEAWg3BCCAAAQBKAAdGCDOkIe2I0MiTAAKQAEICEABKAARgAJQAAICUAAKQASgABSAgABEACIABaAABAQgAhABKAAFICAAEYAIQAEIIAARgAhAAQggABGAAlAACkAAAYgAFIACUAACeAkEBKDdEIAAAhAEoAB0YEAAAvpAADowIAABfSAABSAgAAF9IAAFICAAAQEoAAUgIAABASgABSAgAAEBKAAFICAAAQEoAAUgYMgBASgABSBgyAEBKAABDDkgAAXgr73vtvBNDAlAQB8IQAGIAEQAAgJQAApABCACEBCAAlAAIgARgIAAFIACEAGIAAQEoAAUgAhABCAgAAWgAEQAIgABASgABSACEEMOCEABKAARgBhyQAAKQAGIAEQAggC0GwJQACIAEYAgAO2GABSACEAEIAhAuyEABSACEAEIAlAACsA/Cof+c88LCEAEIAhAuyEABaAAFIAIQBCAdkMACkABKAARgCAABaADC0ABKAARgCAABaAAFIACUAAKQEAfCEABKAAFIAIQEIACUAAKQAGIAAQEoAAUgAJQACIAAQEoAAUgAhABCAhAAeglELwEggAEBKAAFIAIQAQgIAAFoABEAGLIAQEoAAUgAhBDDghAASgAEYAIQBCAdkMACkAEIAIQBKDdEIACEAGIAAQBaDcEoABEACIAQQAKQAcWgAhABCAIQAEoABGACEBAHwhAAYgARAACAlAACkAEIAIQEIACUAAiABGAgAAUgAIQAYgABASgAEzwwAAAAlAAAgACUAAKQABAAApAAQgACEABKAABAAEoAAUgACAABaAABAAEoAAEABCAAhAAQAAKQAAAASgAAQAEoAAEABCAAhAAQAAKQAAAASgAAQAEoAAEAASgABSAAIAAFIACEAAQgAJQAAIAAlAACkAAQAAKQAEIAAhAAQgAIAAFIACAABSAAAACUAACAAhAAQgAIAAFIACAAAQAIAMCEABAAAIAIAABABCAAAAIQAAABCAAAAIQAAABCACAAAQAQAACACAAAQAQgAAACEAAAAQgAIAABABAAAIAIAABABCAAAAIQAAABCAAAAIQAAABCACAAAQAQAACACAAAQAQgAAACEAAAG6uHMBEwU4q0BkAAAAASUVORK5CYII=";

function activity(auditId: string, now: number): AuditActivity[] {
  return [
    {
      id: "demo-activity-ready",
      auditId,
      kind: "review",
      title: "Guided sample is ready",
      detail: "Follow Plan, Inspect, Review, and Deliver using bundled local data. Evidence stays attached to the finding.",
      createdAt: now,
    },
    {
      id: "demo-activity-capture",
      auditId,
      kind: "captured",
      title: "Sample checkout evidence annotated",
      detail: "One contrast issue is linked to the sample finding.",
      createdAt: now - 1_000,
    },
  ];
}

function sampleFinding(now: number): Finding {
  return {
    key: SAMPLE_FINDING_ID,
    reference: "F-001",
    sampleItemId: SAMPLE_ITEM_ID,
    testRunId: SAMPLE_RUN_ID,
    evidenceCaptureIds: [SAMPLE_CAPTURE_ID],
    captureId: SAMPLE_CAPTURE_ID,
    title: "Checkout action text has insufficient contrast",
    wcag: "1.4.3",
    severity: "major",
    status: "open",
    note: "The action text measures 1.24:1 against its background.",
    location: "Bundled sample, checkout form, Continue action",
    description: "The primary checkout action uses low-contrast text in its default state.",
    actualResult: "The text and button surface measure 1.24:1.",
    expectedResult: "Normal-size text reaches at least 4.5:1 against its background.",
    userImpact: "People with low vision or reduced contrast sensitivity may not identify the action.",
    affectedUsers: ["low-vision", "color-vision"],
    severityRationale: "The problem affects a required action in the sample task but has a direct design-token fix.",
    recommendation: "Use the darker action-text token so the label reaches at least 4.5:1.",
    reproductionSteps: [
      "Open the bundled checkout sample.",
      "Inspect the Continue action in its default state.",
      "Compare the text and button surface colors.",
    ],
    source: "local",
    schemaVersion: 2,
    createdAt: now,
    modifiedAt: now,
  };
}

export function createGuidedSampleAuditPackage(now = Date.now()): AuditPackagePayload {
  const audit: AuditProject = {
    ...createAuditProject(GUIDED_SAMPLE_NAME),
    demo: true,
    target: "Bundled local checkout sample",
    goal: "Practice a complete four-stage accessibility audit using safe, local sample data.",
    scope: "One fictional checkout form, its primary action, keyboard focus, and contrast presentation.",
    sample: "One deliberately small flow keeps the walkthrough focused on the workstation workflow.",
    excludedScope: "Network content, real accounts, payment processing, and external applications are excluded.",
    environment: "Bundled 640 by 400 local sample at the workstation's current display settings.",
    assistiveTechnology: "Keyboard-only review, contrast inspection, annotated evidence, and the optional vision lens.",
    methodology: "Manual review of authored demo evidence. The included result is training data, not an automated conformance claim.",
    executiveSummary: "This authored demo identifies one major text-contrast barrier in a fictional checkout action and demonstrates how evidence stays linked to a finding.",
    limitations: "Training sample only. It is not an evaluation of a real product or service.",
    conclusion: "does-not-meet-target" as const,
    completedAt: localDateInputValue(new Date(now)),
    auditor: "TheWCAG guided sample",
    startedAt: localDateInputValue(new Date(now)),
    createdAt: now,
    updatedAt: now,
    scopeProfile: {
      version: 1 as const,
      targetType: "web-product" as const,
      featureIds: ["forms", "components"],
      templateId: "guided-sample-demo",
      confidence: "high" as const,
      reasons: ["This bundled scope was authored specifically for the guided sample."],
      confirmedAt: now,
    },
  };
  const checklist = Object.fromEntries(
    WCAG_CRITERIA.map((criterion) => [
      criterion.sc,
      criterion.sc === "1.4.3"
        ? {
            result: "fail",
            note: "The bundled Continue action measures 1.24:1.",
            findingKey: SAMPLE_FINDING_ID,
          }
        : criterion.sc === "2.4.7"
          ? {
              result: "pass",
              note: "The authored sample includes a visible keyboard focus treatment.",
            }
          : {
              result: "na",
              note: "Not exercised by this deliberately narrow bundled training sample.",
            },
    ]),
  );

  return {
    exportedAt: new Date(now).toISOString(),
    audit,
    sections: {
      sampleItems: [
        {
          id: SAMPLE_ITEM_ID,
          kind: "flow",
          label: "Fictional checkout form",
          location: "Bundled sample / checkout form",
          status: "complete",
          notes: "Inspect the primary action, fields, and focus treatment.",
          createdAt: now,
          modifiedAt: now,
        },
      ],
      testRuns: [
        {
          id: SAMPLE_RUN_ID,
          scriptId: "components",
          sampleItemId: SAMPLE_ITEM_ID,
          title: "Checkout action and focus",
          category: "components",
          status: "complete",
          steps: [
            {
              id: "demo-step-contrast",
              label: "Inspect the primary action's text contrast.",
              complete: true,
              observation: "The authored pair measures 1.24:1 and fails WCAG 1.4.3.",
            },
            {
              id: "demo-step-focus",
              label: "Confirm the action has a visible focus indicator.",
              complete: true,
              observation: "The sample includes a distinct focus treatment.",
            },
          ],
          notes: "A compact completed run demonstrates how observations support review decisions.",
          createdAt: now,
          modifiedAt: now,
        },
      ],
      findings: [sampleFinding(now)],
      findingViews: [],
      checklist,
      history: [
        {
          fg: "#DDD7CC",
          bg: "#C8C1B5",
          ratio: 1.24,
          createdAt: now,
        },
        {
          fg: "#1F2933",
          bg: "#FFFDF8",
          ratio: 14.18,
          createdAt: now - 1_000,
        },
      ],
      palette: ["#1F2933", "#FFFDF8", "#C8C1B5", "#DDD7CC"],
      activity: activity(audit.id, now),
      reports: [],
    },
    captures: [
      {
        id: SAMPLE_CAPTURE_ID,
        title: "Demo checkout contrast evidence",
        sampleItemId: SAMPLE_ITEM_ID,
        testRunId: SAMPLE_RUN_ID,
        rawPngDataUrl: SAMPLE_CAPTURE_PNG,
        thumbnailPngDataUrl: SAMPLE_CAPTURE_PNG,
        document: JSON.stringify({
          version: 1,
          nextId: 3,
          shapes: [
            {
              id: 1,
              kind: "badge",
              x1: 190,
              y1: 327,
              x2: 190,
              y2: 327,
              color: "#F59E0B",
              issueType: "contrast",
              severity: "major",
              note: "Text contrast is below the 4.5:1 minimum.",
            },
            {
              id: 2,
              kind: "rect",
              x1: 64,
              y1: 305,
              x2: 204,
              y2: 349,
              color: "#BD3D0B",
            },
          ],
        }),
      },
    ],
  };
}
