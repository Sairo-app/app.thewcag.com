import { describe, expect, it } from "vitest";
import {
  compactFindingId,
  createFindingId,
  findingIdDate,
  isFindingId,
} from "./finding-id";

describe("finding identities", () => {
  it("creates readable IDs with a UTC date and 130-bit fingerprint", () => {
    const id = createFindingId(
      Date.UTC(2026, 6, 22, 23, 59),
      Uint8Array.from({ length: 26 }, (_, index) => index),
    );

    expect(id).toBe(
      "WCG-F-20260722-01234-56789-ABCDE-FGHJK-MNPQRS",
    );
    expect(isFindingId(id)).toBe(true);
    expect(findingIdDate(id)).toBe("2026-07-22");
    expect(compactFindingId(id)).toBe("WCG-F-20260722-01234…MNPQRS");
  });

  it("rejects malformed dates and ambiguous characters", () => {
    expect(
      isFindingId("WCG-F-20260231-01234-56789-ABCDE-FGHJK-MNPQRS"),
    ).toBe(false);
    expect(
      isFindingId("WCG-F-20260722-01234-56789-ABCDE-FGHIK-MNPQRS"),
    ).toBe(false);
  });

  it("does not repeat across a large allocation sample", () => {
    const ids = new Set(
      Array.from({ length: 10_000 }, () => createFindingId(1_800_000_000_000)),
    );
    expect(ids.size).toBe(10_000);
  });
});
