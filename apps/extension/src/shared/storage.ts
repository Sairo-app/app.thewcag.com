export const EVIDENCE_STORAGE_KEY = "thewcag-current-evidence-v1";
export const DRAFT_STORAGE_KEY = "thewcag-current-draft-v1";
export const AUDIT_STORAGE_KEY = "thewcag-selected-audit-v1";
export const CAPTURE_TAB_STORAGE_KEY = "thewcag-current-capture-tab-v1";
export const QUEUED_FINDING_STORAGE_KEY = "thewcag-queued-finding-v1";
export const SAVED_FINDING_STORAGE_KEY = "thewcag-saved-finding-v1";

export const CAPTURE_TOO_LARGE_MESSAGE = "This capture is too large to store. Capture a smaller region or reduce page zoom, then try again.";

export function isStorageQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /quota|QUOTA_BYTES|storage[^.]*full|exceeded[^.]*storage|max(?:imum)?[^.]*bytes/i.test(message);
}

export function storageWriteFailureMessage(error: unknown): string {
  return isStorageQuotaError(error)
    ? "Changes are not being saved because extension storage is full. Capture a smaller screenshot or start a new capture."
    : "Changes are not being saved because Chrome rejected the local storage update. Reopen TheWCAG and try again.";
}
