import {
  NATIVE_PROTOCOL_VERSION,
  type AiFindingDraftV1,
  type AuditSummaryV1,
  type EvidencePacketV1,
  type NativeRequestV1,
  type NativeResponseV1,
} from "@accessibility-build/audit-contracts";

export const NATIVE_HOST = "com.thewcag.app";

function sendNative(request: NativeRequestV1): Promise<NativeResponseV1> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, request, (response: NativeResponseV1 | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message || "TheWCAG desktop did not respond."));
        return;
      }
      if (!response || response.protocolVersion !== NATIVE_PROTOCOL_VERSION || response.requestId !== request.requestId) {
        reject(new Error("TheWCAG desktop returned an invalid response."));
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
