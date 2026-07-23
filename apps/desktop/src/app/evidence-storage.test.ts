import { describe, expect, it } from "vitest";
import {
  STANDALONE_FINDINGS_KEY,
  STANDALONE_FINDING_VIEWS_KEY,
} from "./evidence-storage";

describe("standalone evidence storage", () => {
  it("uses renderer-store-safe keys without colon separators", () => {
    const validStoreKey = /^[a-zA-Z0-9_-]{1,64}$/;
    expect(STANDALONE_FINDINGS_KEY).toBe("standalone-findings");
    expect(STANDALONE_FINDINGS_KEY).toMatch(validStoreKey);
    expect(STANDALONE_FINDING_VIEWS_KEY).toMatch(validStoreKey);
  });
});
