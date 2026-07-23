import { describe, expect, it } from "vitest";
import { retainFindingSelection } from "./finding-selection";

describe("finding bulk selection", () => {
  it("preserves existing findings and drops only records removed by refresh", () => {
    expect(
      [...retainFindingSelection(new Set(["keep", "removed"]), [
        { key: "keep" },
        { key: "new" },
      ])],
    ).toEqual(["keep"]);
  });
});
