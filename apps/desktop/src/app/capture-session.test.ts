import { describe, expect, it } from "vitest";
import type { CaptureSavedEvent } from "../shared/desktop";
import {
  cancellationMatchesPendingSession,
  captureMatchesPendingSession,
  type PendingFindingCapture,
} from "./capture-session";

const pending: PendingFindingCapture = {
  role: "evidence",
  sessionId: "session-requested",
};
const entry = {
  id: "cap-session1",
  title: "Capture",
  createdAt: 1,
  modifiedAt: 1,
  issues: 0,
  width: 1,
  height: 1,
  assetUrl: "thewcag-asset://capture/example",
  thumbnailUrl: null,
} satisfies CaptureSavedEvent;

describe("finding capture sessions", () => {
  it("matches only the capture created by the requested overlay session", () => {
    expect(captureMatchesPendingSession(pending, {
      ...entry,
      sessionId: pending.sessionId,
    })).toBe(true);
    expect(captureMatchesPendingSession(pending, {
      ...entry,
      sessionId: "session-unrelated",
    })).toBe(false);
    expect(captureMatchesPendingSession(pending, entry)).toBe(false);
  });

  it("clears pending state only for its own cancellation", () => {
    expect(cancellationMatchesPendingSession(pending, pending.sessionId)).toBe(true);
    expect(cancellationMatchesPendingSession(pending, "session-unrelated")).toBe(false);
  });
});
