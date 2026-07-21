import type {
  EvidenceCaptureMode,
  EvidencePacketV1,
  EvidencePageV1,
  EvidenceTargetV1,
} from "@accessibility-build/audit-contracts";

export interface CapturedSelection {
  page: EvidencePageV1;
  target: EvidenceTargetV1;
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
