import { describe, expect, it } from "vitest";
import {
  AUDIT_TEST_SCRIPTS,
  BUILT_IN_AUDIT_TEMPLATES,
  createTestRun,
} from "./audit-templates";

describe("auditor templates and guided test scripts", () => {
  it("covers every Phase 2 guided-test category", () => {
    expect(new Set(AUDIT_TEST_SCRIPTS.map((script) => script.category))).toEqual(
      new Set([
        "authentication",
        "checkout",
        "forms",
        "media",
        "documents",
        "components",
      ]),
    );
    expect(AUDIT_TEST_SCRIPTS.every((script) => script.steps.length >= 5)).toBe(
      true,
    );
  });

  it("keeps built-in template script references valid", () => {
    const scriptIds = new Set(AUDIT_TEST_SCRIPTS.map((script) => script.id));
    expect(BUILT_IN_AUDIT_TEMPLATES).toHaveLength(8);
    expect(new Set(BUILT_IN_AUDIT_TEMPLATES.map((template) => template.targetType))).toEqual(
      new Set([
        "content-site",
        "web-product",
        "commerce-service",
        "release-regression",
        "desktop-product",
        "mobile-product",
        "document-set",
        "component-library",
      ]),
    );
    expect(
      BUILT_IN_AUDIT_TEMPLATES.every(
        (template) =>
          template.source === "built-in" &&
          Boolean(template.targetType) &&
          Boolean(template.featureIds?.length) &&
          template.sampleItems.length > 0 &&
          template.testScriptIds.every((id) => scriptIds.has(id)),
      ),
    ).toBe(true);
  });

  it("creates an independent planned run with one result per step", () => {
    const script = AUDIT_TEST_SCRIPTS[0];
    const run = createTestRun(script);
    expect(run.scriptId).toBe(script.id);
    expect(run.status).toBe("planned");
    expect(run.steps.map((step) => step.label)).toEqual(script.steps);
    expect(run.steps.every((step) => !step.complete && !step.observation)).toBe(
      true,
    );
  });
});
