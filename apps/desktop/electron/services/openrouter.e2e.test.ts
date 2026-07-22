import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_SCHEMA_VERSION,
  NATIVE_PROTOCOL_VERSION,
  createFindingId,
  parseEvidencePacket,
  type EvidencePacketV1,
} from "@accessibility-build/audit-contracts";
import type { AuditProject, Finding } from "../../src/shared/desktop";
import { generateWithProvider, verifyProvider } from "./ai-authoring";
import { handleNativeRequest } from "./native-protocol";
import { JsonStore } from "./store";

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
const model = process.env.OPENROUTER_MODEL?.trim() || "anthropic/claude-sonnet-4.6";
const liveIt = apiKey ? it : it.skip;

function extensionEvidence(): EvidencePacketV1 {
  const capturedAt = Date.now();
  return parseEvidencePacket({
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    findingId: createFindingId(capturedAt),
    auditId: "aud-e2eflow1",
    capturedAt,
    captureMode: "element",
    observation:
      "The unlabeled checkout button is announced only as button, so screen-reader users cannot identify its purpose.",
    taskContext: "Complete checkout and submit payment",
    page: {
      title: "Checkout",
      url: "https://example.com/checkout",
      origin: "https://example.com",
      locale: "en-US",
      browser: "Chrome",
      viewport: {
        width: 1280,
        height: 720,
        devicePixelRatio: 2,
        visualScale: 1,
        offsetLeft: 0,
        offsetTop: 0,
      },
    },
    target: {
      kind: "element",
      tagName: "button",
      role: "button",
      accessibleName: "",
      accessibleDescription: "",
      selector: "button.checkout-submit",
      structuralPath: "html > body > main > form > button.checkout-submit",
      bounds: { x: 980, y: 610, width: 180, height: 44 },
      marker: { x: 972, y: 602, width: 196, height: 60 },
      states: ["focusable"],
      labels: [],
      nearbyHeading: "Payment",
      landmark: "main",
      attributes: { class: "checkout-submit", type: "submit" },
      styles: { display: "inline-flex" },
      domExcerpt: '<button class="checkout-submit" type="submit"></button>',
    },
    checks: [
      {
        id: "interactive-name",
        outcome: "fail",
        title: "Interactive control has no accessible name",
        description: "The selected submit button exposes no accessible name.",
        wcag: ["4.1.2"],
        impact: "major",
      },
    ],
    omissions: [
      "Form values were not collected",
      "Cookies, browser storage, and network data were not accessed",
    ],
    consent: {
      approvedAt: capturedAt,
      includeScreenshot: false,
      includeElementText: true,
      includeUrl: true,
    },
  });
}

describe("live extension to desktop OpenRouter workflow", () => {
  liveIt(
    "verifies the key, generates a structured draft, and saves it into the selected audit",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "thewcag-openrouter-e2e-"));
      try {
        const store = new JsonStore(directory);
        await store.initialize();
        const now = Date.now();
        const audit: AuditProject = {
          id: "aud-e2eflow1",
          project: "Extension E2E audit",
          target: "https://example.com/checkout",
          goal: "Verify the browser evidence handoff",
          scope: "Checkout submit control",
          sample: "Checkout payment step",
          excludedScope: "",
          environment: "Chrome desktop",
          assistiveTechnology: "Screen reader",
          methodology: "Extension evidence capture and manual review",
          executiveSummary: "",
          limitations: "",
          conclusion: "in-progress",
          completedAt: "",
          standard: "WCAG 2.2 AA",
          auditor: "E2E test",
          startedAt: new Date(now).toISOString().slice(0, 10),
          updatedAt: now,
          createdAt: now,
        };
        await Promise.all([
          store.set("audits-v2", [audit]),
          store.set("active-audit-v2", audit.id),
        ]);

        await verifyProvider("openrouter", apiKey!, model);
        const evidence = extensionEvidence();
        const services = {
          store,
          ai: {
            generateFinding: (value: unknown) =>
              generateWithProvider(value, "openrouter", apiKey!, model),
          },
          appVersion: "e2e",
        };

        const auditsResponse = await handleNativeRequest(
          {
            protocolVersion: NATIVE_PROTOCOL_VERSION,
            requestId: crypto.randomUUID(),
            type: "audits:list",
          },
          services,
        );
        expect(auditsResponse).toEqual(
          expect.objectContaining({ ok: true, type: "audits:list" }),
        );

        const generationResponse = await handleNativeRequest(
          {
            protocolVersion: NATIVE_PROTOCOL_VERSION,
            requestId: crypto.randomUUID(),
            type: "finding:generate",
            evidence,
          },
          services,
        );
        if (!generationResponse.ok || generationResponse.type !== "finding:generated") {
          throw new Error(
            !generationResponse.ok
              ? generationResponse.message
              : "OpenRouter returned an unexpected response",
          );
        }
        expect(generationResponse.draft.provenance).toMatchObject({
          source: "ai",
          model: "openrouter",
          modelVersion: model,
        });
        expect(generationResponse.draft.wcag).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ criterion: "4.1.2" }),
          ]),
        );

        const saveResponse = await handleNativeRequest(
          {
            protocolVersion: NATIVE_PROTOCOL_VERSION,
            requestId: crypto.randomUUID(),
            type: "finding:save",
            auditId: audit.id,
            evidence,
            draft: generationResponse.draft,
          },
          services,
        );
        expect(saveResponse).toEqual(
          expect.objectContaining({
            ok: true,
            type: "finding:saved",
            findingKey: evidence.id,
          }),
        );

        const findings = await store.get<Finding[]>(`findings-${audit.id}`, []);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({
          id: evidence.findingId,
          key: evidence.id,
          reference: "F-001",
          schemaVersion: 2,
          source: "ai",
        });
        expect(findings[0].provenance).toMatchObject({
          model: "openrouter",
          modelVersion: model,
        });
        expect(await store.getRaw("finding-identities")).toContain(
          evidence.findingId,
        );
        expect(await store.getRaw(`evidence-${evidence.id}`)).toContain(
          evidence.findingId,
        );
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    120_000,
  );
});
