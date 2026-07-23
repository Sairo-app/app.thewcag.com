import type { CaptureSavedEvent } from "../shared/desktop";

export type FindingCaptureRole = "evidence" | "before" | "after";

export interface PendingFindingCapture {
  role: FindingCaptureRole;
  sessionId: string;
}

export function captureMatchesPendingSession(
  pending: PendingFindingCapture | null,
  event: CaptureSavedEvent,
): pending is PendingFindingCapture {
  return Boolean(pending && event.sessionId === pending.sessionId);
}

export function cancellationMatchesPendingSession(
  pending: PendingFindingCapture | null,
  sessionId: string,
): pending is PendingFindingCapture {
  return Boolean(pending && sessionId === pending.sessionId);
}
