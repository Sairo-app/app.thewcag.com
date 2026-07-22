import { describe, expect, it } from "vitest";
import {
  AUDIT_SCOPE_FEATURE_OPTIONS,
  AUDIT_TARGET_TYPE_OPTIONS,
  auditPatchInvalidatesScopeProfile,
  incorporateScopeDiscovery,
  recommendAuditScope,
  scopeProfileFromRecommendation,
} from "./audit-scoper";

describe("built-in audit scoper", () => {
  it("covers every supported product type and guided feature", () => {
    expect(new Set(AUDIT_TARGET_TYPE_OPTIONS.map((option) => option.id))).toEqual(
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
    expect(new Set(AUDIT_SCOPE_FEATURE_OPTIONS.map((feature) => feature.id))).toEqual(
      new Set(["authentication", "checkout", "forms", "media", "documents", "components"]),
    );
  });

  it("detects a transactional service and builds its sample and test matrix", () => {
    const recommendation = recommendAuditScope({
      target: "https://shop.example.com/checkout",
      project: "Store purchase flow",
      goal: "Audit cart, payment validation, account sign in, and order confirmation",
    });
    expect(recommendation.targetType).toBe("commerce-service");
    expect(recommendation.template.id).toBe("commerce-service");
    expect(recommendation.featureIds).toEqual(
      expect.arrayContaining(["authentication", "checkout", "forms", "components"]),
    );
    expect(recommendation.testScriptIds).toEqual(
      expect.arrayContaining(["authentication", "checkout", "forms", "components"]),
    );
    expect(recommendation.sampleItems.length).toBeGreaterThanOrEqual(3);
    expect(recommendation.sampleItems[0].location).toBe("https://shop.example.com/checkout");
  });

  it("recognizes document targets and preserves an auditor override", () => {
    const documentScope = recommendAuditScope({
      target: "https://example.com/reports/annual-report.pdf",
    });
    expect(documentScope.targetType).toBe("document-set");
    expect(documentScope.confidence).toBe("high");

    const overridden = recommendAuditScope({
      target: "https://example.com/reports/annual-report.pdf",
      targetType: "release-regression",
      featureIds: ["components"],
    });
    expect(overridden.targetType).toBe("release-regression");
    expect(overridden.confidence).toBe("high");
    expect(overridden.featureIds).toEqual(["components"]);
    expect(overridden.testScriptIds).toEqual(["components"]);
    expect(overridden.reasons[0]).toContain("selected by the auditor");
  });

  it("does not mistake a native application for a checkout application", () => {
    const recommendation = recommendAuditScope({
      target: "Native Windows desktop application",
    });
    expect(recommendation.targetType).toBe("desktop-product");
    expect(recommendation.featureIds).toEqual(["forms", "components"]);
    expect(recommendation.testScriptIds).toEqual(["forms", "components"]);
  });

  it("creates a portable confirmed scope profile", () => {
    const recommendation = recommendAuditScope({
      target: "Native Windows desktop application",
    });
    const profile = scopeProfileFromRecommendation(recommendation);
    expect(profile.version).toBe(1);
    expect(profile.targetType).toBe("desktop-product");
    expect(profile.templateId).toBe("desktop-product");
    expect(profile.confirmedAt).toBeGreaterThan(0);

    recommendation.featureIds.push("media");
    recommendation.reasons.push("Later mutation");
    expect(profile.featureIds).not.toContain("media");
    expect(profile.reasons).not.toContain("Later mutation");
  });

  it("adds exact discovered template locations without treating detection as auditor confirmation", () => {
    const recommendation = recommendAuditScope({
      target: "https://app.example.com",
      targetType: "web-product",
      featureIds: ["authentication", "forms"],
      targetTypeOrigin: "discovery",
      featureOrigin: "discovery",
    });
    const enriched = incorporateScopeDiscovery(recommendation, {
      requestedUrl: "https://app.example.com/",
      finalUrl: "https://app.example.com/",
      title: "Example workspace",
      targetType: "web-product",
      featureIds: ["authentication", "forms"],
      pages: [{
        url: "https://app.example.com/sign-in",
        title: "Sign in",
        templateKey: "1-segment page · layout 1-1-1-0-0-0",
        signals: ["authentication", "forms"],
      }],
      discoveredUrlCount: 1,
      templateCount: 1,
      warnings: [],
      discoveredAt: Date.now(),
    });
    expect(enriched.confidence).toBe("medium");
    expect(enriched.reasons.join(" ")).toContain("must confirm");
    expect(enriched.sampleItems[0]).toMatchObject({ label: "Sign in", location: "https://app.example.com/sign-in" });
    expect(enriched.sampleItems.find((item) => item.label.includes("Authentication"))?.location).toBe("https://app.example.com/sign-in");
  });

  it("invalidates confirmation only after material scope changes", () => {
    expect(auditPatchInvalidatesScopeProfile({ target: "New target" })).toBe(true);
    expect(auditPatchInvalidatesScopeProfile({ standard: "WCAG 2.2 A" })).toBe(true);
    expect(auditPatchInvalidatesScopeProfile({ auditor: "Audit team" })).toBe(false);
    expect(auditPatchInvalidatesScopeProfile({ excludedScope: "Third party" })).toBe(true);
  });
});
