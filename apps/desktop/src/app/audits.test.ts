import { describe, expect, it } from "vitest";
import { auditStoreKey, createAuditProject } from "./audits";

describe("audit workspaces", () => {
  it("creates isolated, valid audit identifiers", () => {
    const first = createAuditProject(" Checkout release ");
    const second = createAuditProject("Checkout release");
    expect(first.project).toBe("Checkout release");
    expect(first.id).toMatch(/^aud-[a-z0-9-]{6,36}$/);
    expect(first.id).not.toBe(second.id);
    expect(auditStoreKey(first.id, "findings")).toBe(`findings-${first.id}`);
  });

  it("rejects unsafe audit identifiers", () => {
    expect(() => auditStoreKey("../workspace", "reports")).toThrow();
  });
});
