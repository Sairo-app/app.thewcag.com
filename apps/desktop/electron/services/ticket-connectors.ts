import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { safeStorage } from "electron";
import type {
  FindingTicketLink,
  TicketConnectorConfiguration,
  TicketConnectorId,
  TicketConnectorPublicConfig,
  TicketExternalSnapshot,
  TicketFieldMapping,
  TicketFieldValues,
  TicketSourceField,
} from "../../src/shared/desktop";
import {
  DEFAULT_TICKET_FIELD_MAPPINGS,
  TICKET_FIELD_LABELS,
  TICKET_SOURCE_FIELDS,
  createFindingTicketLink,
  mapTicketFieldValues,
  ticketMarkdownSectionValues,
  ticketMarkdownSections,
  type MappedTicketField,
} from "../../src/shared/ticket-connectors";

const REQUEST_TIMEOUT_MS = 20_000;
const CONNECTOR_IDS = new Set<TicketConnectorId>(["jira", "linear", "github"]);

interface StoredConnectorBase {
  credential: string;
  mapping: TicketFieldMapping;
}

interface StoredJiraConnector extends StoredConnectorBase {
  id: "jira";
  baseUrl: string;
  email: string;
  projectKey: string;
  issueType: string;
}

interface StoredLinearConnector extends StoredConnectorBase {
  id: "linear";
  teamId: string;
}

interface StoredGithubConnector extends StoredConnectorBase {
  id: "github";
  repository: string;
}

type StoredConnector = StoredJiraConnector | StoredLinearConnector | StoredGithubConnector;

interface StoredTicketVault {
  version: 1;
  connectors: Partial<Record<TicketConnectorId, StoredConnector>>;
}

interface CreatedTicket {
  externalId: string;
  key: string;
  url: string;
  snapshot: TicketExternalSnapshot;
}

function emptyVault(): StoredTicketVault {
  return { version: 1, connectors: {} };
}

function asObject(value: unknown, label = "ticket connector request"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}

function connectorId(value: unknown): TicketConnectorId {
  if (typeof value !== "string" || !CONNECTOR_IDS.has(value as TicketConnectorId)) {
    throw new Error("Choose Jira, Linear, or GitHub Issues");
  }
  return value as TicketConnectorId;
}

function text(value: unknown, label: string, maximum = 2_000, required = true): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label}`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum) throw new Error(`Invalid ${label}`);
  return normalized;
}

function credential(value: unknown, prior?: string): string {
  const next = typeof value === "string" && value.trim() ? value.trim() : prior;
  if (!next || next.length < 8 || next.length > 1_000 || /\s/.test(next)) {
    throw new Error("Enter a valid API token without spaces");
  }
  return next;
}

function credentialHint(value: string): string {
  return `••••${value.slice(-4)}`;
}

function httpsOrigin(value: unknown, label: string): string {
  const raw = text(value, label, 2_048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be a valid HTTPS URL without embedded credentials`);
  }
  return url.origin;
}

function mappingFrom(value: unknown, connector: TicketConnectorId): TicketFieldMapping {
  const raw = asObject(value, "ticket field mapping");
  const result = { ...DEFAULT_TICKET_FIELD_MAPPINGS[connector] };
  for (const field of TICKET_SOURCE_FIELDS) {
    if (typeof raw[field] !== "string" || raw[field].length > 120 || /[\r\n]/.test(raw[field] as string)) {
      throw new Error(`Invalid mapping for ${TICKET_FIELD_LABELS[field]}`);
    }
    result[field] = (raw[field] as string).trim();
  }
  if (!result.title) throw new Error("Map the title before saving this connector");
  return result;
}

function fieldsFrom(value: unknown): TicketFieldValues {
  const raw = asObject(value, "ticket fields");
  const result = {} as TicketFieldValues;
  for (const field of TICKET_SOURCE_FIELDS) {
    const maximum = field === "title" ? 500 : 20_000;
    result[field] = text(raw[field] ?? "", TICKET_FIELD_LABELS[field], maximum, field === "title");
  }
  if (!["blocker", "major", "minor"].includes(result.severity)) throw new Error("Invalid finding severity");
  return result;
}

function safeError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return message
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9+/=._-]+/gi, "$1 [redacted]")
    .replace(/(token|api[_ -]?key)[=: ]+[A-Za-z0-9._-]{8,}/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

async function responseJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  label: string,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const raw = await response.text();
  let body: unknown = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${safeError(raw)}`);
  return asObject(body, `${label} response`);
}

function entriesFor(fields: MappedTicketField[], target: string): MappedTicketField[] {
  return fields.filter((field) => field.target === target);
}

function firstValue(fields: MappedTicketField[], target: string, fallback = ""): string {
  return entriesFor(fields, target)[0]?.value ?? fallback;
}

function severityPriority(value: string): string {
  return value === "blocker" ? "Highest" : value === "major" ? "High" : "Medium";
}

function prioritySeverity(value: unknown): string {
  const priority = externalText(value).toLowerCase();
  if (priority === "highest" || priority === "urgent" || priority === "1") return "blocker";
  if (priority === "high" || priority === "2") return "major";
  return "minor";
}

function slugLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function externalText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(externalText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return externalText(item.value ?? item.name ?? item.displayName ?? item.login ?? item.id ?? "");
  }
  return "";
}

function snapshotFromFields(
  mapping: TicketFieldMapping,
  raw: Record<string, unknown>,
  sections: Partial<TicketFieldValues>,
  status: string,
): TicketExternalSnapshot {
  const fields: Partial<TicketFieldValues> = {};
  for (const source of TICKET_SOURCE_FIELDS) {
    const target = mapping[source];
    if (!target) continue;
    if (target === "description" || target === "body") {
      if (sections[source] !== undefined) fields[source] = sections[source];
      continue;
    }
    if (!(target in raw)) continue;
    if (source === "severity" && target === "priority") fields[source] = prioritySeverity(raw[target]);
    else if (source === "wcagMapping" && target === "labels") {
      const labels = Array.isArray(raw[target]) ? raw[target].map(externalText) : [];
      fields[source] = labels.map((label) => /^wcag-(\d+\.\d+\.\d+)$/.exec(label)?.[1]).filter(Boolean).join("; ");
    } else fields[source] = externalText(raw[target]);
  }
  return { fields, status: status || "Unknown", fetchedAt: Date.now() };
}

function adfText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const value = node as { type?: string; text?: string; content?: unknown[] };
  if (value.type === "text") return value.text ?? "";
  return Array.isArray(value.content) ? value.content.map(adfText).join("") : "";
}

function adfSections(document: unknown): Partial<TicketFieldValues> {
  const content = document && typeof document === "object" && Array.isArray((document as { content?: unknown[] }).content)
    ? (document as { content: unknown[] }).content
    : [];
  const labelToField = new Map(Object.entries(TICKET_FIELD_LABELS).map(([field, label]) => [label, field as TicketSourceField]));
  const result: Partial<TicketFieldValues> = {};
  let current: TicketSourceField | undefined;
  for (const node of content) {
    const type = node && typeof node === "object" ? (node as { type?: string }).type : "";
    if (type === "heading") current = labelToField.get(adfText(node).trim());
    else if (current) {
      const next = adfText(node).trim();
      if (next) result[current] = result[current] ? `${result[current]}\n${next}` : next;
    }
  }
  return result;
}

function jiraDescription(fields: MappedTicketField[]): Record<string, unknown> {
  return {
    type: "doc",
    version: 1,
    content: fields.flatMap((field) => [
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: field.label }] },
      { type: "paragraph", content: [{ type: "text", text: field.value }] },
    ]),
  };
}

function jiraAuth(config: StoredJiraConnector): string {
  return `Basic ${Buffer.from(`${config.email}:${config.credential}`).toString("base64")}`;
}

async function fetchJiraIssue(
  config: StoredJiraConnector,
  externalId: string,
  fetchImpl: typeof fetch,
): Promise<{ key: string; url: string; snapshot: TicketExternalSnapshot }> {
  const targets = Array.from(new Set([...Object.values(config.mapping).filter(Boolean), "status"]));
  const body = await responseJson(
    fetchImpl,
    `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(externalId)}?fields=${encodeURIComponent(targets.join(","))}`,
    { headers: { Authorization: jiraAuth(config), Accept: "application/json" } },
    "Jira sync",
  );
  const rawFields = asObject(body.fields ?? {}, "Jira issue fields");
  const status = externalText(rawFields.status);
  const snapshot = snapshotFromFields(config.mapping, rawFields, adfSections(rawFields.description), status);
  const key = externalText(body.key) || externalId;
  return { key, url: `${config.baseUrl}/browse/${encodeURIComponent(key)}`, snapshot };
}

async function createJira(
  config: StoredJiraConnector,
  values: TicketFieldValues,
  fetchImpl: typeof fetch,
): Promise<CreatedTicket> {
  const mapped = mapTicketFieldValues(values, config.mapping);
  const fields: Record<string, unknown> = {
    project: { key: config.projectKey },
    issuetype: { name: config.issueType },
    summary: firstValue(mapped, "summary", values.title).slice(0, 255),
  };
  const description = entriesFor(mapped, "description");
  if (description.length) fields.description = jiraDescription(description);
  for (const entry of mapped.filter((item) => !["summary", "description"].includes(item.target))) {
    if (entry.target === "priority") fields.priority = { name: severityPriority(entry.value) };
    else if (entry.target === "labels") {
      const existing = Array.isArray(fields.labels) ? fields.labels as string[] : ["accessibility", "wcag"];
      const labels = entry.source === "wcagMapping"
        ? entry.value.split(/[,;\s]+/).filter((part) => /^\d+\.\d+\.\d+$/.test(part)).map((part) => `wcag-${part}`)
        : [`${entry.source === "severity" ? "severity-" : ""}${slugLabel(entry.value)}`];
      fields.labels = Array.from(new Set([...existing, ...labels]));
    } else if (entry.target === "assignee") fields.assignee = { accountId: entry.value };
    else fields[entry.target] = entry.value;
  }
  const body = await responseJson(fetchImpl, `${config.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: { Authorization: jiraAuth(config), Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  }, "Jira create");
  const key = externalText(body.key);
  if (!key) throw new Error("Jira did not return an issue key");
  const fetched = await fetchJiraIssue(config, key, fetchImpl);
  return { externalId: key, key, url: fetched.url, snapshot: fetched.snapshot };
}

async function linearGraphql(
  config: StoredLinearConnector,
  fetchImpl: typeof fetch,
  query: string,
  variables: Record<string, unknown>,
  label: string,
): Promise<Record<string, unknown>> {
  const response = await responseJson(fetchImpl, "https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: config.credential, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  }, label);
  if (Array.isArray(response.errors) && response.errors.length) {
    throw new Error(`${label} failed: ${safeError(externalText(response.errors))}`);
  }
  return asObject(response.data ?? {}, `${label} data`);
}

function linearSnapshot(config: StoredLinearConnector, issue: Record<string, unknown>): TicketExternalSnapshot {
  const state = asObject(issue.state ?? {}, "Linear issue state");
  const assignee = issue.assignee && typeof issue.assignee === "object" ? issue.assignee : {};
  const raw = { ...issue, assigneeId: externalText((assignee as Record<string, unknown>).id) };
  const description = externalText(issue.description);
  return snapshotFromFields(config.mapping, raw, ticketMarkdownSectionValues(description), externalText(state.name));
}

async function fetchLinearIssue(
  config: StoredLinearConnector,
  externalId: string,
  fetchImpl: typeof fetch,
): Promise<{ key: string; url: string; snapshot: TicketExternalSnapshot }> {
  const data = await linearGraphql(config, fetchImpl,
    `query TicketIssue($id: String!) { issue(id: $id) { id identifier url title description priority dueDate state { name } assignee { id name } } }`,
    { id: externalId }, "Linear sync");
  const issue = asObject(data.issue, "Linear issue");
  return {
    key: externalText(issue.identifier),
    url: externalText(issue.url),
    snapshot: linearSnapshot(config, issue),
  };
}

async function createLinear(
  config: StoredLinearConnector,
  values: TicketFieldValues,
  fetchImpl: typeof fetch,
): Promise<CreatedTicket> {
  const mapped = mapTicketFieldValues(values, config.mapping);
  const input: Record<string, unknown> = { teamId: config.teamId, title: firstValue(mapped, "title", values.title) };
  const description = entriesFor(mapped, "description");
  if (description.length) input.description = ticketMarkdownSections(description);
  for (const entry of mapped.filter((item) => !["title", "description"].includes(item.target))) {
    if (entry.target === "priority") input.priority = entry.value === "blocker" ? 1 : entry.value === "major" ? 2 : 3;
    else if (entry.target === "labelIds") input.labelIds = entry.value.split(/[,;\s]+/).filter(Boolean);
    else input[entry.target] = entry.value;
  }
  const data = await linearGraphql(config, fetchImpl,
    `mutation TicketCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url title description priority dueDate state { name } assignee { id name } } } }`,
    { input }, "Linear create");
  const result = asObject(data.issueCreate, "Linear create result");
  if (result.success !== true) throw new Error("Linear did not create the issue");
  const issue = asObject(result.issue, "Linear issue");
  return {
    externalId: externalText(issue.id),
    key: externalText(issue.identifier),
    url: externalText(issue.url),
    snapshot: linearSnapshot(config, issue),
  };
}

function githubHeaders(config: StoredGithubConnector): Record<string, string> {
  return {
    Authorization: `Bearer ${config.credential}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function githubSnapshot(config: StoredGithubConnector, issue: Record<string, unknown>): TicketExternalSnapshot {
  const labels = Array.isArray(issue.labels) ? issue.labels.map(externalText) : [];
  const assignees = Array.isArray(issue.assignees) ? issue.assignees.map(externalText) : [];
  const raw = {
    ...issue,
    labels,
    assignees,
    milestone: issue.milestone && typeof issue.milestone === "object"
      ? externalText((issue.milestone as Record<string, unknown>).number)
      : "",
  };
  const body = externalText(issue.body);
  return snapshotFromFields(config.mapping, raw, ticketMarkdownSectionValues(body), externalText(issue.state));
}

async function fetchGithubIssue(
  config: StoredGithubConnector,
  externalId: string,
  fetchImpl: typeof fetch,
): Promise<{ key: string; url: string; snapshot: TicketExternalSnapshot }> {
  if (!/^\d+$/.test(externalId)) throw new Error("Invalid GitHub issue number");
  const issue = await responseJson(fetchImpl,
    `https://api.github.com/repos/${config.repository}/issues/${externalId}`,
    { headers: githubHeaders(config) }, "GitHub sync");
  const number = externalText(issue.number) || externalId;
  return {
    key: `${config.repository}#${number}`,
    url: externalText(issue.html_url),
    snapshot: githubSnapshot(config, issue),
  };
}

async function createGithub(
  config: StoredGithubConnector,
  values: TicketFieldValues,
  fetchImpl: typeof fetch,
): Promise<CreatedTicket> {
  const mapped = mapTicketFieldValues(values, config.mapping);
  const input: Record<string, unknown> = { title: firstValue(mapped, "title", values.title) };
  const bodyFields = entriesFor(mapped, "body");
  if (bodyFields.length) input.body = ticketMarkdownSections(bodyFields);
  for (const entry of mapped.filter((item) => !["title", "body"].includes(item.target))) {
    if (entry.target === "labels" || entry.target === "assignees") {
      const prior = Array.isArray(input[entry.target]) ? input[entry.target] as string[] : [];
      input[entry.target] = Array.from(new Set([...prior, ...entry.value.split(/[,;]+/).map((item) => item.trim()).filter(Boolean)]));
    } else if (entry.target === "milestone") input.milestone = Number(entry.value);
    else input[entry.target] = entry.value;
  }
  const issue = await responseJson(fetchImpl, `https://api.github.com/repos/${config.repository}/issues`, {
    method: "POST",
    headers: githubHeaders(config),
    body: JSON.stringify(input),
  }, "GitHub issue create");
  const number = externalText(issue.number);
  if (!/^\d+$/.test(number)) throw new Error("GitHub did not return an issue number");
  return {
    externalId: number,
    key: `${config.repository}#${number}`,
    url: externalText(issue.html_url),
    snapshot: githubSnapshot(config, issue),
  };
}

export class TicketConnectorService {
  private readonly vaultPath: string;

  constructor(userData: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.vaultPath = join(userData, "ticket-connectors.bin");
  }

  async configuration(): Promise<TicketConnectorConfiguration> {
    const vault = await this.readVault();
    const connectors = (["jira", "linear", "github"] as const).map((id): TicketConnectorPublicConfig => {
      const saved = vault?.connectors[id];
      const base = {
        id,
        label: id === "jira" ? "Jira" : id === "linear" ? "Linear" : "GitHub Issues",
        configured: Boolean(saved),
        credentialHint: saved ? credentialHint(saved.credential) : undefined,
        mapping: saved?.mapping ?? DEFAULT_TICKET_FIELD_MAPPINGS[id],
      };
      if (saved?.id === "jira") return { ...base, baseUrl: saved.baseUrl, email: saved.email, projectKey: saved.projectKey, issueType: saved.issueType };
      if (saved?.id === "linear") return { ...base, teamId: saved.teamId };
      if (saved?.id === "github") return { ...base, repository: saved.repository };
      return base;
    });
    return {
      secureStorageAvailable: safeStorage.isEncryptionAvailable(),
      connectors,
    };
  }

  /** Origins whose credentials/configuration are present in the encrypted vault. */
  async externalOrigins(): Promise<string[]> {
    const connectors = (await this.readVault())?.connectors;
    if (!connectors) return [];
    const origins = new Set<string>();
    if (connectors.jira?.id === "jira") origins.add(connectors.jira.baseUrl);
    if (connectors.linear?.id === "linear") origins.add("https://linear.app");
    if (connectors.github?.id === "github") origins.add("https://github.com");
    return [...origins];
  }

  async saveConnector(input: unknown): Promise<TicketConnectorConfiguration> {
    const value = asObject(input);
    const id = connectorId(value.connector);
    const vault = await this.readVault() ?? emptyVault();
    const prior = vault.connectors[id];
    const token = credential(value.credential, prior?.credential);
    const mapping = mappingFrom(value.mapping, id);
    if (id === "jira") {
      vault.connectors.jira = {
        id,
        credential: token,
        mapping,
        baseUrl: httpsOrigin(value.baseUrl, "Jira base URL"),
        email: text(value.email, "Jira account email", 320),
        projectKey: text(value.projectKey, "Jira project key", 40).toUpperCase(),
        issueType: text(value.issueType ?? "Bug", "Jira issue type", 80),
      };
    } else if (id === "linear") {
      vault.connectors.linear = { id, credential: token, mapping, teamId: text(value.teamId, "Linear team ID", 120) };
    } else {
      const repository = text(value.repository, "GitHub repository", 200);
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("Use a GitHub repository such as owner/repository");
      vault.connectors.github = { id, credential: token, mapping, repository };
    }
    await this.writeVault(vault);
    return this.configuration();
  }

  async removeConnector(input: unknown): Promise<TicketConnectorConfiguration> {
    const id = connectorId(asObject(input).connector);
    const vault = await this.readVault();
    if (!vault) return this.configuration();
    delete vault.connectors[id];
    if (!Object.keys(vault.connectors).length) await rm(this.vaultPath, { force: true });
    else await this.writeVault(vault);
    return this.configuration();
  }

  async create(input: unknown): Promise<FindingTicketLink> {
    const value = asObject(input);
    const id = connectorId(value.connector);
    const fields = fieldsFrom(value.fields);
    const config = (await this.readVault())?.connectors[id];
    if (!config) throw new Error(`Configure ${id === "github" ? "GitHub Issues" : id[0].toUpperCase() + id.slice(1)} before creating a ticket`);
    let created: CreatedTicket;
    if (config.id === "jira") created = await createJira(config, fields, this.fetchImpl);
    else if (config.id === "linear") created = await createLinear(config, fields, this.fetchImpl);
    else created = await createGithub(config, fields, this.fetchImpl);
    if (!created.externalId || !created.key || !created.url) throw new Error("The connector returned an incomplete ticket reference");
    return createFindingTicketLink(id, created.externalId, created.key, created.url, created.snapshot);
  }

  async sync(input: unknown): Promise<TicketExternalSnapshot> {
    const link = asObject(asObject(input).link, "ticket link");
    const id = connectorId(link.connector);
    const externalId = text(link.externalId, "external ticket identifier", 240);
    const config = (await this.readVault())?.connectors[id];
    if (!config) throw new Error("This ticket connector is no longer configured");
    if (config.id === "jira") return (await fetchJiraIssue(config, externalId, this.fetchImpl)).snapshot;
    if (config.id === "linear") return (await fetchLinearIssue(config, externalId, this.fetchImpl)).snapshot;
    return (await fetchGithubIssue(config, externalId, this.fetchImpl)).snapshot;
  }

  private async readVault(): Promise<StoredTicketVault | null> {
    let encrypted: Buffer;
    try { encrypted = await readFile(this.vaultPath); } catch { return null; }
    try {
      if (!safeStorage.isEncryptionAvailable()) return null;
      const value = JSON.parse(safeStorage.decryptString(encrypted)) as Partial<StoredTicketVault>;
      if (value.version !== 1 || !value.connectors || typeof value.connectors !== "object") return null;
      return value as StoredTicketVault;
    } catch {
      return null;
    }
  }

  private async writeVault(vault: StoredTicketVault): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure credential storage is unavailable on this computer");
    const temporaryPath = `${this.vaultPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, safeStorage.encryptString(JSON.stringify(vault)), { mode: 0o600 });
    try { await rename(temporaryPath, this.vaultPath); }
    catch {
      await rm(this.vaultPath, { force: true });
      await rename(temporaryPath, this.vaultPath);
    }
  }
}
