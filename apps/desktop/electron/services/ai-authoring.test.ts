import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EVIDENCE_SCHEMA_VERSION,
  type EvidencePacketV1,
} from "@accessibility-build/audit-contracts";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${Buffer.from(value).toString("base64")}`),
    decryptString: (value: Buffer) => Buffer.from(value.toString().replace(/^encrypted:/, ""), "base64").toString(),
  },
}));

import {
  AiAuthoringService,
  generateWithProvider,
  verifyProvider,
} from "./ai-authoring";

const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function evidence(includeImage = false, includeUrl = true, includeElementText = true): EvidencePacketV1 {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: "3c977290-cb66-4bbd-a68b-72b770828b39",
    capturedAt: 1_800_000_000_000,
    captureMode: "element",
    observation: "The checkout button is announced only as button.",
    taskContext: "Complete checkout",
    page: {
      title: "Checkout",
      url: "https://private.example/checkout?customer=42",
      origin: "https://private.example",
      locale: "en",
      browser: "Chrome",
      viewport: { width: 1280, height: 720, devicePixelRatio: 2, visualScale: 1, offsetLeft: 0, offsetTop: 0 },
    },
    target: {
      kind: "element",
      tagName: "button",
      role: "button",
      accessibleName: "Private customer action",
      accessibleDescription: "Private description",
      selector: "button.checkout",
      structuralPath: "html > body > button",
      bounds: { x: 100, y: 200, width: 180, height: 44 },
      marker: { x: 100, y: 200, width: 180, height: 44 },
      states: ["focusable"],
      labels: ["Private label"],
      nearbyHeading: "Payment",
      landmark: "main",
      attributes: { type: "button", "aria-label": "Private customer action" },
      styles: { display: "inline-flex" },
      domExcerpt: "<button aria-label=\"Private customer action\"></button>",
    },
    image: includeImage ? {
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      width: 180,
      height: 44,
      sourceWidth: 2560,
      sourceHeight: 1440,
    } : undefined,
    checks: [{
      id: "interactive-name",
      outcome: "fail",
      title: "Interactive control has no accessible name",
      description: "The selected button has no accessible name.",
      wcag: ["4.1.2"],
      impact: "major",
    }],
    omissions: [],
    consent: {
      approvedAt: 1_800_000_000_100,
      includeScreenshot: includeImage,
      includeElementText,
      includeUrl,
    },
  };
}

const providerFinding = {
  title: "Checkout button has no accessible name",
  description: "The checkout control is exposed without an accessible name.",
  actualResult: "A screen reader announces only button.",
  expectedResult: "The control exposes a descriptive name.",
  userImpact: "Screen reader and voice-control users cannot identify the action.",
  affectedUsers: ["screen-reader", "voice-control"],
  severity: "major",
  severityRationale: "The control is required for checkout, but task blocking needs confirmation.",
  wcag: [{ criterion: "4.1.2", level: "AA", name: "Untrusted name", rationale: "The control has no name.", confidence: "high" }],
  recommendation: "Give the native button visible descriptive text.",
  exampleFix: "<button>Complete checkout</button>",
  reproductionSteps: ["Open checkout.", "Inspect the button with a screen reader."],
  confidence: "high",
  fieldConfidence: [{ field: "severity", confidence: "low", reason: "Task impact needs confirmation." }],
  assumptions: [],
  manualChecks: ["Confirm the computed accessible name."],
};

function requestBody(fetchMock: ReturnType<typeof vi.fn>, index = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[index][1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("desktop AI provider adapters", () => {
  it("uses OpenAI structured outputs and omits evidence the auditor withheld", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(providerFinding) }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;

    const draft = await generateWithProvider(evidence(false, false, false), "openai", "sk-openai-test", "gpt-5.6", fetchMock);
    const body = requestBody(fetchMock as unknown as ReturnType<typeof vi.fn>);
    const serialized = JSON.stringify(body);

    expect(body).toEqual(expect.objectContaining({ model: "gpt-5.6", store: false }));
    expect(serialized).toContain('"type":"json_schema"');
    expect(serialized).not.toContain("private.example");
    expect(serialized).not.toContain("Private customer action");
    expect(serialized).not.toContain("input_image");
    expect(draft.provenance.model).toBe("openai");
    expect(draft.wcag[0]).toEqual(expect.objectContaining({ level: "A", name: "Name, Role, Value" }));
  });

  it("sends consented images through Claude structured outputs", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(providerFinding) }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;

    const draft = await generateWithProvider(evidence(true), "anthropic", "sk-ant-test", "claude-sonnet-4-6", fetchMock);
    const body = requestBody(fetchMock as unknown as ReturnType<typeof vi.fn>);
    const headers = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Record<string, string>;

    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(JSON.stringify(body)).toContain('"output_config"');
    expect(JSON.stringify(body)).toContain('"type":"image"');
    expect(draft.provenance.model).toBe("anthropic");
  });

  it("uses OpenRouter chat structured outputs with app attribution", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(providerFinding) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;

    const draft = await generateWithProvider(evidence(), "openrouter", "sk-or-v1-test", "anthropic/claude-sonnet-4.6", fetchMock);
    const body = requestBody(fetchMock as unknown as ReturnType<typeof vi.fn>);
    const headers = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Record<string, string>;

    expect(body.response_format).toEqual(expect.objectContaining({ type: "json_schema" }));
    expect(headers["X-OpenRouter-Title"]).toBe("TheWCAG");
    expect(draft.provenance.model).toBe("openrouter");
  });

  it("verifies both the OpenRouter key and requested model", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { label: "test" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "openai/gpt-5.6" }] }), { status: 200 }));
    await expect(verifyProvider("openrouter", "sk-or-v1-test", "openai/gpt-5.6", fetchMock as typeof fetch)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("AI provider credential vault", () => {
  it("encrypts keys at rest and never returns them to the renderer", async () => {
    const directory = await mkdtemp(join(tmpdir(), "thewcag-ai-"));
    directories.push(directory);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "gpt-5.6" }), { status: 200 })) as unknown as typeof fetch;
    const service = new AiAuthoringService(directory, { generateFinding: vi.fn() }, fetchMock);

    const saved = await service.saveProvider({ provider: "openai", apiKey: "sk-openai-super-secret", model: "gpt-5.6" });
    expect(JSON.stringify(saved)).not.toContain("sk-openai-super-secret");
    expect(saved.providers.find((provider) => provider.id === "openai")?.keyHint).toBe("••••cret");

    const file = await readFile(join(directory, "ai-providers.bin"), "utf8");
    expect(file).not.toContain("sk-openai-super-secret");

    const verified = await service.testProvider({ provider: "openai" });
    expect(verified.providers.find((provider) => provider.id === "openai")?.verifiedAt).toEqual(expect.any(Number));

    const active = await service.setActive({ provider: "openai" });
    expect(active.activeProvider).toBe("openai");
    expect(active.providers.find((provider) => provider.id === "openai")?.active).toBe(true);
  });
});
