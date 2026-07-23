import type {
  EvidenceCaptureMode,
  EvidencePacketV1,
  EvidencePageV1,
  EvidenceTargetV1,
} from "@accessibility-build/audit-contracts";

export interface CapturedSelection {
  page: EvidencePageV1;
  target: EvidenceTargetV1;
  omissions?: string[];
}

export const PANEL_PORT_NAME = "thewcag-evidence-panel";

export type PanelPortMessage =
  | { type: "panel-connected"; windowId: number }
  | { type: "evidence-seen"; tabId: number };

export function isPanelPortMessage(value: unknown): value is PanelPortMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.type === "panel-connected"
    ? Number.isInteger(item.windowId) && (item.windowId as number) >= 0
    : item.type === "evidence-seen" && Number.isInteger(item.tabId) && (item.tabId as number) >= 0;
}

export type ExtensionRequest = {
  type: "capture:start";
  mode: EvidenceCaptureMode;
};

export type ExtensionResponse =
  | {
      ok: true;
      evidence: EvidencePacketV1;
    }
  | {
      ok: false;
      cancelled?: boolean;
      message: string;
    };

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.type === "capture:start" && (item.mode === "element" || item.mode === "region");
}
