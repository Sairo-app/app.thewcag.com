import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TICKET_FIELD_MAPPINGS } from "../../src/shared/ticket-connectors";
import type { TicketFieldValues } from "../../src/shared/desktop";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${Buffer.from(value).toString("base64")}`),
    decryptString: (value: Buffer) => Buffer.from(value.toString().replace(/^encrypted:/, ""), "base64").toString(),
  },
}));

import { TicketConnectorService } from "./ticket-connectors";

const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function directory(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "thewcag-ticket-test-"));
  directories.push(value);
  return value;
}

function fields(): TicketFieldValues {
  return {
    title: "Checkout button has no accessible name",
    description: "The control has no accessible name.",
    actualResult: "Screen readers announce only button.",
    expectedResult: "The visible label is exposed.",
    userImpact: "Screen-reader users cannot identify the action.",
    wcagMapping: "4.1.2",
    severity: "blocker",
    evidenceLink: "https://app.thewcag.com/s/evidence-1",
    owner: "Checkout team",
    targetDate: "2026-08-15",
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

describe("ticket connector main-process service", () => {
  it("encrypts Jira credentials and creates an issue from mapped finding fields", async () => {
    const userData = await directory();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST") return json({ key: "A11Y-42" }, 201);
      expect(url).toContain("/rest/api/3/issue/A11Y-42");
      return json({
        key: "A11Y-42",
        fields: {
          summary: fields().title,
          priority: { name: "Highest" },
          labels: ["accessibility", "wcag", "wcag-4.1.2"],
          duedate: fields().targetDate,
          status: { name: "To Do" },
          description: {
            type: "doc",
            version: 1,
            content: [
              { type: "heading", content: [{ type: "text", text: "Issue description" }] },
              { type: "paragraph", content: [{ type: "text", text: fields().description }] },
            ],
          },
        },
      });
    }) as unknown as typeof fetch;
    const service = new TicketConnectorService(userData, fetchMock);
    const configuration = await service.saveConnector({
      connector: "jira",
      credential: "jira-api-token-1234",
      baseUrl: "https://example.atlassian.net",
      email: "auditor@example.com",
      projectKey: "a11y",
      issueType: "Bug",
      mapping: DEFAULT_TICKET_FIELD_MAPPINGS.jira,
    });
    expect(JSON.stringify(configuration)).not.toContain("jira-api-token-1234");
    expect((await readFile(join(userData, "ticket-connectors.bin"), "utf8"))).not.toContain("jira-api-token-1234");
    await expect(service.externalOrigins()).resolves.toEqual(["https://example.atlassian.net"]);
    const link = await service.create({ connector: "jira", fields: fields() });
    expect(link).toMatchObject({ key: "A11Y-42", externalStatus: "To Do", syncState: "in-sync" });
    const createPayload = JSON.parse(String((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]?.body));
    expect(createPayload.fields.summary).toBe(fields().title);
    expect(createPayload.fields.priority.name).toBe("Highest");
    expect(createPayload.fields.labels).toContain("wcag-4.1.2");
  });

  it("creates Linear and GitHub issues through their configured main-process clients", async () => {
    const linearData = await directory();
    const linearFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      expect(request.variables.input.title).toBe(fields().title);
      return json({ data: { issueCreate: { success: true, issue: {
        id: "linear-id",
        identifier: "A11Y-8",
        url: "https://linear.app/team/issue/A11Y-8",
        title: fields().title,
        description: request.variables.input.description,
        priority: 1,
        dueDate: fields().targetDate,
        state: { name: "Todo" },
        assignee: null,
      } } } });
    }) as unknown as typeof fetch;
    const linear = new TicketConnectorService(linearData, linearFetch);
    await linear.saveConnector({
      connector: "linear",
      credential: "linear-api-token-1234",
      teamId: "team-id",
      mapping: DEFAULT_TICKET_FIELD_MAPPINGS.linear,
    });
    await expect(linear.externalOrigins()).resolves.toEqual(["https://linear.app"]);
    await expect(linear.create({ connector: "linear", fields: fields() })).resolves.toMatchObject({ key: "A11Y-8" });

    const githubData = await directory();
    const githubFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.github.com/repos/example/product/issues");
      const request = JSON.parse(String(init?.body));
      expect(request.title).toBe(fields().title);
      return json({
        number: 17,
        html_url: "https://github.com/example/product/issues/17",
        state: "open",
        title: request.title,
        body: request.body,
        labels: [],
        assignees: [],
        milestone: null,
      }, 201);
    }) as unknown as typeof fetch;
    const github = new TicketConnectorService(githubData, githubFetch);
    await github.saveConnector({
      connector: "github",
      credential: "github-api-token-1234",
      repository: "example/product",
      mapping: DEFAULT_TICKET_FIELD_MAPPINGS.github,
    });
    await expect(github.externalOrigins()).resolves.toEqual(["https://github.com"]);
    await expect(github.create({ connector: "github", fields: fields() })).resolves.toMatchObject({
      key: "example/product#17",
      externalStatus: "open",
    });
  });
});
