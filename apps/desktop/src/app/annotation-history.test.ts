import { describe, expect, it } from "vitest";
import { appendUndoSnapshot } from "../lib/annotate/history";

describe("annotation undo history", () => {
  it("records one snapshot for a coalesced text-field edit", () => {
    const baseline = { text: "" };
    const afterFirstKey = appendUndoSnapshot([], baseline, false);
    const afterSecondKey = appendUndoSnapshot(
      afterFirstKey,
      { text: "a" },
      true,
    );

    expect(afterSecondKey).toEqual([baseline]);
  });

  it("starts a new undo entry after the text edit is committed", () => {
    const history = appendUndoSnapshot([], { text: "" }, false);
    expect(appendUndoSnapshot(history, { text: "abc" }, false)).toEqual([
      { text: "" },
      { text: "abc" },
    ]);
  });
});
