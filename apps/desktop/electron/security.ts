import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { IpcMainInvokeEvent, WebContents } from "electron";

function rendererDirectory(): string {
  return resolve(import.meta.dirname, "../renderer");
}

export function isTrustedRendererUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl && url.origin === new URL(devUrl).origin) return true;
    if (url.protocol !== "file:") return false;
    const root = rendererDirectory();
    const candidate = resolve(fileURLToPath(url));
    return candidate === root || candidate.startsWith(`${root}${sep}`);
  } catch {
    return false;
  }
}

export function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url || event.sender.getURL();
  if (!isTrustedRendererUrl(url)) throw new Error("Blocked IPC request from an untrusted renderer");
}

export function hardenWebContents(contents: WebContents): void {
  contents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-attach-webview", (event) => event.preventDefault());
}

const APP_ORIGIN = "https://app.thewcag.com";
const CURATED_EXTERNAL_HOSTNAMES = new Set([
  "www.w3.org",
  "w3.org",
  "platform.openai.com",
  "console.anthropic.com",
  "openrouter.ai",
]);

function parsedExternalUrl(raw: unknown, protocols: ReadonlySet<string>): URL {
  if (typeof raw !== "string" || raw.length > 2_048) throw new Error("Invalid external URL");
  const url = new URL(raw);
  if (!protocols.has(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("External URL is not allowed");
  }
  return url;
}

/** Validate a link against fixed trusted hosts and encrypted connector origins. */
export function safeExternalUrl(raw: unknown, configuredOrigins: Iterable<string> = []): string {
  const url = parsedExternalUrl(raw, new Set(["https:"]));
  if (url.origin === APP_ORIGIN || CURATED_EXTERNAL_HOSTNAMES.has(url.hostname.toLowerCase())) {
    return url.toString();
  }
  for (const configuredOrigin of configuredOrigins) {
    try {
      const allowed = new URL(configuredOrigin);
      if (allowed.protocol === "https:" && allowed.origin === url.origin) return url.toString();
    } catch {
      // Ignore malformed values rather than broadening the policy.
    }
  }
  throw new Error("External URL is not allowed");
}

/** Validate an audited-page target before the main process asks for consent. */
export function confirmableExternalUrl(raw: unknown): string {
  const url = parsedExternalUrl(raw, new Set(["http:", "https:"]));
  return url.toString();
}
