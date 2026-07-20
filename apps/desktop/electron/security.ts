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

export function safeExternalUrl(raw: unknown, allowedOrigin = "https://app.thewcag.com"): string {
  if (typeof raw !== "string" || raw.length > 2_048) throw new Error("Invalid external URL");
  const url = new URL(raw);
  const allowed = new URL(allowedOrigin);
  if (url.protocol !== "https:" || url.origin !== allowed.origin) throw new Error("External URL is not allowed");
  return url.toString();
}
