import {
  ContractValidationError,
  EVIDENCE_EDITABLE_LIMITS,
  isFindingId,
  parseEvidencePacket,
  type AiFindingDraftV1,
  type EvidencePacketV1,
} from "@accessibility-build/audit-contracts";

export { EVIDENCE_EDITABLE_LIMITS };

type EditableEvidenceField = keyof typeof EVIDENCE_EDITABLE_LIMITS;

export function clampEvidencePatch(
  patch: Partial<EvidencePacketV1>,
): Partial<EvidencePacketV1> {
  const bounded = { ...patch };
  for (const field of Object.keys(EVIDENCE_EDITABLE_LIMITS) as EditableEvidenceField[]) {
    const value = bounded[field];
    if (typeof value === "string") {
      bounded[field] = value.slice(0, EVIDENCE_EDITABLE_LIMITS[field]);
    }
  }
  return bounded;
}

export function restoreEvidencePacket(value: unknown): {
  evidence: EvidencePacketV1;
  recoveredFields: EditableEvidenceField[];
} {
  try {
    return { evidence: parseEvidencePacket(value), recoveredFields: [] };
  } catch (error) {
    if (!(error instanceof ContractValidationError) ||
      !value || typeof value !== "object" || Array.isArray(value)) {
      throw error;
    }

    const raw = value as Record<string, unknown>;
    const failedField = error.path === "evidence.observation"
      ? "observation"
      : error.path === "evidence.taskContext"
        ? "taskContext"
        : null;
    if (!failedField || typeof raw[failedField] !== "string" ||
      raw[failedField].length <= EVIDENCE_EDITABLE_LIMITS[failedField]) {
      throw error;
    }

    const recoveredFields = (Object.keys(EVIDENCE_EDITABLE_LIMITS) as EditableEvidenceField[])
      .filter((field) => typeof raw[field] === "string" &&
        raw[field].length > EVIDENCE_EDITABLE_LIMITS[field]);
    const evidence = parseEvidencePacket(clampEvidencePatch(raw as Partial<EvidencePacketV1>));
    return { evidence, recoveredFields };
  }
}

function storageSignature(value: unknown): string | undefined {
  return JSON.stringify(value);
}

export type LastWrittenStorage = Record<string, string>;

export interface SavedFindingMarker {
  key: string;
  findingId: string;
  auditId: string;
}

export function restoreSavedFindingMarker(
  value: unknown,
  currentFindingId: string | undefined,
): SavedFindingMarker | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.key !== "string" || !item.key || item.key.length > 64 ||
    !isFindingId(item.findingId) || item.findingId !== currentFindingId ||
    typeof item.auditId !== "string" || !/^aud-[a-z0-9-]{6,36}$/.test(item.auditId)
  ) {
    return null;
  }
  return { key: item.key, findingId: item.findingId, auditId: item.auditId };
}

export function rememberStorageWrite(
  lastWritten: LastWrittenStorage,
  values: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(values)) {
    const signature = storageSignature(value);
    if (signature !== undefined) lastWritten[key] = signature;
  }
}

export function consumeOwnStorageEcho(
  lastWritten: LastWrittenStorage,
  key: string,
  value: unknown,
): boolean {
  const signature = storageSignature(value);
  if (signature === undefined || lastWritten[key] !== signature) return false;
  delete lastWritten[key];
  return true;
}

export function draftPersistenceAction(
  storageRestored: boolean,
  draft: AiFindingDraftV1 | null,
): "none" | "set" | "remove" {
  if (!storageRestored) return "none";
  return draft ? "set" : "remove";
}
