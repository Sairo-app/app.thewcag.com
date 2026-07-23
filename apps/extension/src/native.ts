import {
  NATIVE_PROTOCOL_VERSION,
  parseNativeResponse,
  type AiFindingDraftV1,
  type AuditSummaryV1,
  type EvidencePacketV1,
  type NativeRequestV1,
  type NativeResponseV1,
} from "@accessibility-build/audit-contracts";

export const NATIVE_HOST = "com.thewcag.app";

export type NativeConnectorFailure =
  | "not-registered"
  | "extension-not-allowed"
  | "host-exited"
  | "timeout"
  | "protocol-error"
  | "unknown";

export class NativeConnectorError extends Error {
  constructor(
    public readonly failure: NativeConnectorFailure,
    message: string,
  ) {
    super(message);
    this.name = "NativeConnectorError";
  }
}

export function classifyNativeConnectorFailure(message: string): NativeConnectorFailure {
  if (/desktop did not respond|timed out/i.test(message)) {
    return "timeout";
  }
  if (/native messaging host.*not found|Specified native messaging host not found|host name is not registered/i.test(message)) {
    return "not-registered";
  }
  if (/access to .* native messaging host .* forbidden|not allowed to connect/i.test(message)) {
    return "extension-not-allowed";
  }
  if (/native host has exited|native messaging host has exited|pipe .* broken|closed before/i.test(message)) {
    return "host-exited";
  }
  if (/error when communicating|invalid response|protocol|message.*size/i.test(message)) {
    return "protocol-error";
  }
  return "unknown";
}

function timeoutFor(request: NativeRequestV1): number {
  return request.type === "finding:generate" || request.type === "finding:queue" ? 60_000 : 10_000;
}

function sendNative(request: NativeRequestV1): Promise<NativeResponseV1> {
  const responsePromise = new Promise<NativeResponseV1>((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, request, (response: unknown) => {
      const error = chrome.runtime.lastError;
      if (error) {
        const message = error.message || "TheWCAG desktop did not respond.";
        reject(new NativeConnectorError(classifyNativeConnectorFailure(message), message));
        return;
      }
      let parsed: NativeResponseV1;
      try {
        parsed = parseNativeResponse(response);
      } catch {
        reject(new NativeConnectorError("protocol-error", "TheWCAG desktop returned an invalid response."));
        return;
      }
      if (parsed.requestId !== request.requestId) {
        reject(new NativeConnectorError("protocol-error", "TheWCAG desktop returned an invalid response."));
        return;
      }
      resolve(parsed);
    });
  });

  const timeoutMs = timeoutFor(request);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new NativeConnectorError(
        "timeout",
        `TheWCAG desktop did not respond within ${timeoutMs / 1_000} seconds.`,
      ));
    }, timeoutMs);
  });
  return Promise.race([responsePromise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
  });
}

function errorFromResponse(response: Extract<NativeResponseV1, { ok: false }>): Error {
  if (response.code === "version-mismatch") {
    const punctuation = /[.!?]$/.test(response.message) ? "" : ".";
    return new Error(`${response.message}${punctuation} Update TheWCAG desktop and this extension, then try again.`);
  }
  return new Error(response.message);
}

function unexpectedResponse(): NativeConnectorError {
  return new NativeConnectorError("protocol-error", "TheWCAG desktop returned an unexpected response.");
}

export async function requestDesktopPermission(): Promise<boolean> {
  return chrome.permissions.request({ permissions: ["nativeMessaging"] });
}

export async function hasDesktopPermission(): Promise<boolean> {
  return chrome.permissions.contains({ permissions: ["nativeMessaging"] });
}

export async function pingDesktop(): Promise<string> {
  const response = await sendNative({
    protocolVersion: NATIVE_PROTOCOL_VERSION,
    requestId: crypto.randomUUID(),
    type: "ping",
  });
  if (!response.ok) throw errorFromResponse(response);
  if (response.type !== "pong") throw unexpectedResponse();
  return response.appVersion;
}

export async function listDesktopAudits(): Promise<AuditSummaryV1[]> {
  const response = await sendNative({
    protocolVersion: NATIVE_PROTOCOL_VERSION,
    requestId: crypto.randomUUID(),
    type: "audits:list",
  });
  if (!response.ok) throw errorFromResponse(response);
  if (response.type !== "audits:list") throw unexpectedResponse();
  return response.audits;
}

export async function generateDesktopDraft(evidence: EvidencePacketV1): Promise<AiFindingDraftV1> {
  const response = await sendNative({
    protocolVersion: NATIVE_PROTOCOL_VERSION,
    requestId: crypto.randomUUID(),
    type: "finding:generate",
    evidence,
  });
  if (!response.ok) throw errorFromResponse(response);
  if (response.type !== "finding:generated") throw unexpectedResponse();
  return response.draft;
}

export async function saveDesktopFinding(
  auditId: string,
  evidence: EvidencePacketV1,
  draft: AiFindingDraftV1,
): Promise<string> {
  const response = await sendNative({
    protocolVersion: NATIVE_PROTOCOL_VERSION,
    requestId: crypto.randomUUID(),
    type: "finding:save",
    auditId,
    evidence,
    draft,
  });
  if (!response.ok) throw errorFromResponse(response);
  if (response.type !== "finding:saved") throw unexpectedResponse();
  return response.findingKey;
}

export async function queueDesktopFinding(
  auditId: string,
  evidence: EvidencePacketV1,
): Promise<{ findingKey: string; draftSource: "local" | "ai" }> {
  const response = await sendNative({
    protocolVersion: NATIVE_PROTOCOL_VERSION,
    requestId: crypto.randomUUID(),
    type: "finding:queue",
    auditId,
    evidence,
  });
  if (!response.ok) throw errorFromResponse(response);
  if (response.type !== "finding:queued") throw unexpectedResponse();
  return { findingKey: response.findingKey, draftSource: response.draftSource };
}
