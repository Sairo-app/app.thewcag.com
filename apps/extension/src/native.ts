import {
  NATIVE_PROTOCOL_VERSION,
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

function sendNative(request: NativeRequestV1): Promise<NativeResponseV1> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, request, (response: NativeResponseV1 | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        const message = error.message || "TheWCAG desktop did not respond.";
        reject(new NativeConnectorError(classifyNativeConnectorFailure(message), message));
        return;
      }
      if (!response || response.protocolVersion !== NATIVE_PROTOCOL_VERSION || response.requestId !== request.requestId) {
        reject(new NativeConnectorError("protocol-error", "TheWCAG desktop returned an invalid response."));
        return;
      }
      resolve(response);
    });
  });
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
  if (!response.ok || response.type !== "pong") throw new Error(response.ok ? "TheWCAG desktop returned an unexpected response." : response.message);
  return response.appVersion;
}

export async function listDesktopAudits(): Promise<AuditSummaryV1[]> {
  const response = await sendNative({
    protocolVersion: NATIVE_PROTOCOL_VERSION,
    requestId: crypto.randomUUID(),
    type: "audits:list",
  });
  if (!response.ok || response.type !== "audits:list") throw new Error(response.ok ? "TheWCAG desktop returned an unexpected response." : response.message);
  return response.audits;
}

export async function generateDesktopDraft(evidence: EvidencePacketV1): Promise<AiFindingDraftV1> {
  const response = await sendNative({
    protocolVersion: NATIVE_PROTOCOL_VERSION,
    requestId: crypto.randomUUID(),
    type: "finding:generate",
    evidence,
  });
  if (!response.ok || response.type !== "finding:generated") throw new Error(response.ok ? "TheWCAG desktop returned an unexpected response." : response.message);
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
  if (!response.ok || response.type !== "finding:saved") throw new Error(response.ok ? "TheWCAG desktop returned an unexpected response." : response.message);
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
  if (!response.ok || response.type !== "finding:queued") {
    throw new Error(response.ok ? "TheWCAG desktop returned an unexpected response." : response.message);
  }
  return { findingKey: response.findingKey, draftSource: response.draftSource };
}
